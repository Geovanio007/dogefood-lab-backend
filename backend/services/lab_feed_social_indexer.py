"""
LabFeedSocial on-chain indexer.

Same shape as services/lab_launcher_indexer.py (see that file's docstring
for why this backend uses raw JSON-RPC over httpx rather than web3.py) -
this is the equivalent poller for contracts/contracts/LabFeedSocial.sol:
PostRegistered / PostLiked / PostCommented.

The blockchain is the source of truth here, matching the original design
brief: this module is the only thing that increments lab_notes.likes_count
/ comments_count / earnings_doge for on-chain interactions, and it only
does so after actually observing the confirming event - never from a
frontend-submitted tx_hash alone (see lab_feed_social_routes.py's
like-tx/comment-tx endpoints, which record a *pending* row and nothing
more; this module is what flips it to confirmed).

Idempotency: every processed log is first inserted into
lab_notes_onchain_events under a *real* unique index on
(tx_hash, log_index) - see ensure_indexes() below. If a restart re-scans
part of an already-processed range, that insert raises a duplicate-key
error, which is caught, and the derived lab_notes update is skipped along
with it. (lab_launcher_indexer.py leans on this same insert-then-derive
pattern; this module additionally creates the index it relies on rather
than assuming one already exists.)

Reverse lookup: postId is keccak256(author ++ noteId) - a one-way hash, so
an event alone can't be mapped back to a lab_notes document. Whichever
lab-notes route first calls sign_registration() for a note also persists
the resulting postId onto that note as onchain_post_id (see
lab_feed_social_routes.py); this indexer looks notes up by that field.
"""
import os
import asyncio
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config - optional, so a backend that hasn't been wired up to a deployment
# yet still starts fine (the indexer just no-ops), same convention as
# lab_launcher_indexer.py.
# ---------------------------------------------------------------------------
DOGEOS_RPC_URL = os.environ.get("DOGEOS_RPC_URL", "")
LABFEED_SOCIAL_CONTRACT_ADDRESS = os.environ.get("LABFEED_SOCIAL_CONTRACT_ADDRESS", "")
POLL_INTERVAL_SECONDS = int(os.environ.get("LABFEED_SOCIAL_POLL_INTERVAL_SECONDS", "20"))
MAX_BLOCK_RANGE_PER_CALL = 2000
START_BLOCK = int(os.environ.get("LABFEED_SOCIAL_START_BLOCK", "0"))
DOGE_DECIMALS = 10**18

# topic0 = keccak256("EventName(type1,type2,...)"), taken directly from the
# compiled ABI (ethers Interface.getEventTopic) rather than typed by hand -
# see LabFeedSocial.sol for the source of truth these must match.
TOPIC_POST_REGISTERED = "0x3ce72d7c573d8c04ae49a2f1398261fc96fb86cc920b534891bb17e48ff484c6"   # PostRegistered(bytes32,address)
TOPIC_POST_LIKED = "0x2d8c1a11e79689aa4b04c08887f818d3b538a91e9a76511cbbc8a1a646e94f0f"        # PostLiked(bytes32,address,address,uint256,uint256)
TOPIC_POST_COMMENTED = "0x8f08c7eb9fcd0ace726efb812634adff905339a1203cac2393953eb1a2539a06"    # PostCommented(bytes32,bytes32,address,address,bytes32,uint256,uint256)


async def ensure_indexes(db):
    """Call once at startup (alongside the app's other create_index calls).
    Safe to call every boot - create_index is a no-op if the index already
    matches."""
    await db.lab_notes_onchain_events.create_index(
        [("tx_hash", 1), ("log_index", 1)], unique=True
    )
    await db.lab_notes_onchain_events.create_index([("post_id", 1)])
    await db.lab_notes_onchain_interactions.create_index([("tx_hash", 1)])
    await db.lab_notes_onchain_interactions.create_index(
        [("note_id", 1), ("player_address", 1), ("kind", 1)]
    )
    await db.lab_notes.create_index("onchain_post_id", sparse=True)


# ---------------------------------------------------------------------------
# Minimal ABI decoding - every field here is a static (fixed-width) type,
# so this is the same word-slicing approach as lab_launcher_indexer.py,
# with no dynamic-type handling needed at all.
# ---------------------------------------------------------------------------
def _hex_to_bytes(h: str) -> bytes:
    return bytes.fromhex(h[2:] if h.startswith("0x") else h)


def _word(data: bytes, word_index: int) -> bytes:
    start = word_index * 32
    return data[start:start + 32]


def _decode_uint(data: bytes, word_index: int) -> int:
    return int.from_bytes(_word(data, word_index), "big")


def _decode_address_word(word: bytes) -> str:
    return "0x" + word[12:].hex()


def _decode_address(data: bytes, word_index: int) -> str:
    return _decode_address_word(_word(data, word_index))


def _topic_address(topic_hex: str) -> str:
    return _decode_address_word(_hex_to_bytes(topic_hex))


def _wei_to_doge_float(wei: int) -> float:
    return wei / DOGE_DECIMALS


class LabFeedSocialIndexer:
    def __init__(self, db):
        self.db = db
        self.enabled = bool(DOGEOS_RPC_URL and LABFEED_SOCIAL_CONTRACT_ADDRESS)
        if not self.enabled:
            logger.warning(
                "⚠️ LabFeedSocial indexer disabled - DOGEOS_RPC_URL / "
                "LABFEED_SOCIAL_CONTRACT_ADDRESS not both set."
            )
        self._http = httpx.AsyncClient(timeout=30.0)
        self._rpc_id = 0

    async def close(self):
        await self._http.aclose()

    # -- low-level RPC (same as lab_launcher_indexer.py) -------------------
    async def _rpc(self, method: str, params: list):
        self._rpc_id += 1
        payload = {"jsonrpc": "2.0", "id": self._rpc_id, "method": method, "params": params}
        resp = await self._http.post(DOGEOS_RPC_URL, json=payload)
        resp.raise_for_status()
        body = resp.json()
        if "error" in body:
            raise RuntimeError(f"RPC error on {method}: {body['error']}")
        return body["result"]

    async def _latest_block(self) -> int:
        return int(await self._rpc("eth_blockNumber", []), 16)

    async def _get_logs(self, topics, from_block: int, to_block: int) -> list:
        logs = []
        start = from_block
        while start <= to_block:
            end = min(start + MAX_BLOCK_RANGE_PER_CALL - 1, to_block)
            params = {
                "address": LABFEED_SOCIAL_CONTRACT_ADDRESS,
                "fromBlock": hex(start),
                "toBlock": hex(end),
                "topics": topics,
            }
            chunk = await self._rpc("eth_getLogs", [params])
            logs.extend(chunk)
            start = end + 1
        return logs

    # -- sync cursor ---------------------------------------------------------
    async def _get_cursor(self, key: str) -> int:
        doc = await self.db.lab_notes_onchain_sync_state.find_one({"_id": key})
        if doc and "last_synced_block" in doc:
            return doc["last_synced_block"]
        return START_BLOCK - 1

    async def _set_cursor(self, key: str, block: int):
        await self.db.lab_notes_onchain_sync_state.update_one(
            {"_id": key},
            {"$set": {"last_synced_block": block, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )

    # -- recording a raw event, idempotently --------------------------------
    async def _record_event(self, log: dict, event: str, fields: dict) -> bool:
        """Returns True if this is the first time this exact log has been
        seen (caller should apply derived updates), False if it's a
        reprocessed duplicate (caller should skip them)."""
        doc = {
            "tx_hash": log["transactionHash"],
            "log_index": int(log["logIndex"], 16),
            "block_number": int(log["blockNumber"], 16),
            "event": event,
            "indexed_at": datetime.now(timezone.utc),
            **fields,
        }
        try:
            await self.db.lab_notes_onchain_events.insert_one(doc)
            return True
        except Exception:
            return False  # duplicate (tx_hash, log_index) - already processed

    async def _apply_note_credit(self, post_id_hex: str, likes_delta: int, comments_delta: int, creator_amount_doge: float):
        inc = {}
        if likes_delta:
            inc["likes_count"] = likes_delta
        if comments_delta:
            inc["comments_count"] = comments_delta
        if creator_amount_doge:
            inc["earnings_doge"] = creator_amount_doge
        if not inc:
            return
        result = await self.db.lab_notes.update_one({"onchain_post_id": post_id_hex}, {"$inc": inc})
        if result.matched_count == 0:
            logger.warning(f"LabFeedSocial indexer: no lab_notes document has onchain_post_id={post_id_hex}")

    async def _persist_confirmed_comment(self, post_id_hex: str, comment_id_hex: str, commenter: str):
        """Once a PostCommented event is confirmed, write the actual comment
        text into lab_note_comments - the same collection/shape the existing
        GET /api/lab-notes/{id}/comments endpoint already reads from, so it
        shows up with no changes needed anywhere else. The text itself was
        already stored (as a pending interaction) by
        lab_feed_social_routes.py's /comment-tx endpoint when the
        transaction was first submitted - this just promotes it once the
        chain confirms it actually happened."""
        note = await self.db.lab_notes.find_one({"onchain_post_id": post_id_hex})
        if not note:
            return
        interaction = await self.db.lab_notes_onchain_interactions.find_one({
            "note_id": note["id"], "kind": "comment", "comment_id": comment_id_hex,
        })
        if not interaction:
            logger.warning(f"LabFeedSocial indexer: confirmed comment {comment_id_hex} has no matching pending record")
            return
        if await self.db.lab_note_comments.find_one({"id": comment_id_hex}):
            return  # already persisted (defensive - shouldn't happen given the event-level dedupe)
        player = await self.db.players.find_one({"address": commenter}, {"_id": 0})
        nickname = (player or {}).get("nickname") or "Scientist"
        await self.db.lab_note_comments.insert_one({
            "id": comment_id_hex,
            "note_id": note["id"],
            "author_address": commenter,
            "author_nickname": nickname,
            "content": (interaction.get("content") or "")[:280],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    async def _mark_interaction_confirmed(self, tx_hash: str, extra: dict):
        await self.db.lab_notes_onchain_interactions.update_one(
            {"tx_hash": tx_hash},
            {"$set": {"status": "confirmed", "confirmed_at": datetime.now(timezone.utc), **extra}},
        )

    # -- per-event-type sync --------------------------------------------------
    async def sync_registered_events(self, latest: int):
        cursor_key = "post_registered"
        from_block = await self._get_cursor(cursor_key) + 1
        if from_block > latest:
            return
        logs = await self._get_logs([TOPIC_POST_REGISTERED], from_block, latest)
        for log in logs:
            post_id_hex = log["topics"][1]
            author = _topic_address(log["topics"][2])
            await self._record_event(log, "PostRegistered", {"post_id": post_id_hex, "author": author})
        await self._set_cursor(cursor_key, latest)

    async def sync_liked_events(self, latest: int):
        cursor_key = "post_liked"
        from_block = await self._get_cursor(cursor_key) + 1
        if from_block > latest:
            return
        logs = await self._get_logs([TOPIC_POST_LIKED], from_block, latest)
        for log in logs:
            post_id_hex = log["topics"][1]
            author = _topic_address(log["topics"][2])
            liker = _topic_address(log["topics"][3])
            data = _hex_to_bytes(log["data"])
            creator_amount = _decode_uint(data, 0)
            platform_fee = _decode_uint(data, 1)

            is_new = await self._record_event(log, "PostLiked", {
                "post_id": post_id_hex,
                "author": author,
                "liker": liker,
                "creator_amount_wei": str(creator_amount),
                "platform_fee_wei": str(platform_fee),
            })
            if not is_new:
                continue

            creator_amount_doge = _wei_to_doge_float(creator_amount)
            await self._apply_note_credit(post_id_hex, likes_delta=1, comments_delta=0, creator_amount_doge=creator_amount_doge)
            await self._mark_interaction_confirmed(log["transactionHash"], {
                "creator_amount_doge": creator_amount_doge,
                "platform_fee_doge": _wei_to_doge_float(platform_fee),
                "block_number": int(log["blockNumber"], 16),
            })
        await self._set_cursor(cursor_key, latest)

    async def sync_commented_events(self, latest: int):
        cursor_key = "post_commented"
        from_block = await self._get_cursor(cursor_key) + 1
        if from_block > latest:
            return
        logs = await self._get_logs([TOPIC_POST_COMMENTED], from_block, latest)
        for log in logs:
            post_id_hex = log["topics"][1]
            comment_id_hex = log["topics"][2]
            author = _topic_address(log["topics"][3])
            data = _hex_to_bytes(log["data"])
            commenter = _decode_address(data, 0)
            comment_hash_hex = "0x" + _word(data, 1).hex()
            creator_amount = _decode_uint(data, 2)
            platform_fee = _decode_uint(data, 3)

            is_new = await self._record_event(log, "PostCommented", {
                "post_id": post_id_hex,
                "comment_id": comment_id_hex,
                "author": author,
                "commenter": commenter,
                "comment_hash": comment_hash_hex,
                "creator_amount_wei": str(creator_amount),
                "platform_fee_wei": str(platform_fee),
            })
            if not is_new:
                continue

            creator_amount_doge = _wei_to_doge_float(creator_amount)
            await self._apply_note_credit(post_id_hex, likes_delta=0, comments_delta=1, creator_amount_doge=creator_amount_doge)
            await self._persist_confirmed_comment(post_id_hex, comment_id_hex, commenter)
            await self._mark_interaction_confirmed(log["transactionHash"], {
                "creator_amount_doge": creator_amount_doge,
                "platform_fee_doge": _wei_to_doge_float(platform_fee),
                "block_number": int(log["blockNumber"], 16),
            })
        await self._set_cursor(cursor_key, latest)

    # -- top-level poll --------------------------------------------------------
    async def poll_once(self):
        if not self.enabled:
            return
        latest = await self._latest_block()
        for sync_fn in (self.sync_registered_events, self.sync_liked_events, self.sync_commented_events):
            try:
                await sync_fn(latest)
            except Exception as e:
                logger.error(f"LabFeedSocial indexer: {sync_fn.__name__} failed: {e}")

    async def run_forever(self):
        if not self.enabled:
            return
        logger.info("🚀 LabFeedSocial indexer started")
        while True:
            try:
                await self.poll_once()
            except Exception as e:
                logger.error(f"LabFeedSocial indexer: poll_once failed: {e}")
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
