"""
Lab Launcher on-chain indexer.

This backend has no existing pattern for reading on-chain EVM state — the
LAB rewards flow (see merkle_tree.py) works the other way around: the
backend computes everything off-chain and the frontend submits proofs
on-chain itself. Lab Launcher's discovery/sorting/trade-history features
can't work that way (you can't ask an RPC node for "tokens sorted by
volume"), so this is a new capability for this codebase: a background
poller that reads BondingCurve/GraduationManager/RoyaltyDistributor/
GamePaymentGateway/LaunchToken event logs over plain JSON-RPC and mirrors
them into Mongo.

Why raw JSON-RPC over httpx instead of web3.py: there's no web3.py or
eth_abi in requirements.txt, and the existing Solana integration in
server.py already calls RPC nodes directly with httpx rather than pulling
in a chain SDK — this follows that same precedent instead of adding a new
dependency. Every event used here is small enough (no arrays, at most a
couple of dynamic strings) that hand-decoding the ABI is ~30 lines and one
less dependency to keep in sync with a chain nobody has SDK support for yet.

Single-writer assumption: this indexer is meant to run as exactly one
asyncio background task in one process (matching kernel_scheduler_loop /
arena_system.run_heat_event_scheduler elsewhere in this backend). Holder
balances are updated via read-modify-write rather than an atomic Mongo
$inc, which is only safe with a single writer — if this ever needs to run
as more than one instance, switch lab_launcher_holdings.balance to
bson.Decimal128 and use $inc instead.
"""
import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config — every address is optional so the indexer can run (as a no-op) on
# a backend that hasn't been wired up to a deployment yet, instead of
# crashing the whole app at import time.
# ---------------------------------------------------------------------------
DOGEOS_RPC_URL = os.environ.get("DOGEOS_RPC_URL", "")

CONTRACTS = {
    "factory": os.environ.get("LAB_LAUNCHER_FACTORY_ADDRESS", ""),
    "bonding_curve": os.environ.get("LAB_LAUNCHER_BONDING_CURVE_ADDRESS", ""),
    "graduation_manager": os.environ.get("LAB_LAUNCHER_GRADUATION_MANAGER_ADDRESS", ""),
    "royalty_distributor": os.environ.get("LAB_LAUNCHER_ROYALTY_DISTRIBUTOR_ADDRESS", ""),
    "game_payment_gateway": os.environ.get("LAB_LAUNCHER_GAME_PAYMENT_GATEWAY_ADDRESS", ""),
    "treasury": os.environ.get("LAB_LAUNCHER_TREASURY_ADDRESS", ""),
    "lab_token": os.environ.get("LAB_TOKEN_ADDRESS", ""),
}

POLL_INTERVAL_SECONDS = int(os.environ.get("LAB_LAUNCHER_POLL_INTERVAL_SECONDS", "30"))
MAX_BLOCK_RANGE_PER_CALL = 2000  # keep individual eth_getLogs calls small
DOGE_DECIMALS = 10**18
BURN_ADDRESS = "0x000000000000000000000000000000000000dead"

# Block to start indexing from on a totally fresh sync_state (e.g. the block
# LaunchpadFactory was deployed at). Defaults to 0 - safe, but means the
# first poll after deploying to a chain with a long history will walk the
# whole thing in MAX_BLOCK_RANGE_PER_CALL-sized chunks. Set this once you
# know the deployment block to skip straight past chain history that can't
# contain any Lab Launcher events anyway.
START_BLOCK = int(os.environ.get("LAB_LAUNCHER_START_BLOCK", "0"))

# ---------------------------------------------------------------------------
# Event topic0 hashes — keccak256 of the exact event signature declared in
# contracts/contracts/*.sol. Recomputed and length-checked against
# ethers.utils.id(...) for each signature; two contracts each declare their
# own differently-shaped "TokenRegistered" event, so these are NOT
# interchangeable even though the names collide.
# ---------------------------------------------------------------------------
TOPIC_TOKEN_LAUNCHED = "0x75a476a2211bd39944d125b89ece62ac0af7b3a027064bb5e062b36b8da7845c"        # Factory: TokenLaunched(address,address,string,string,uint256,uint256)
TOPIC_CURVE_TOKEN_REGISTERED = "0xdcb7b407b171095d9d7a73945217bc35ee774619b7e8d9fb154f6ae9eb250d0c"  # BondingCurve: TokenRegistered(address,address,uint256,uint256)
TOPIC_TRADE = "0xf7dd8a134438de4c59401760e24ef5c6cc9c74583b2b022085697f3021e59768"                  # BondingCurve: Trade(address,address,bool,uint256,uint256,uint256)
TOPIC_GRADUATION_TRIGGERED = "0xbb00277448ed2809994104443b72235926e562f752aa44d8655c5fef73f36969"   # BondingCurve: GraduationTriggered(address,uint256,uint256)
TOPIC_TOKEN_GRADUATED = "0xe0c01cf91b3ada998e6163978b21351c02e42caef18c922614cff4f09800d32b"        # GraduationManager: TokenGraduated(address,address,address,uint256,uint256,uint256)
TOPIC_ROYALTY_CLAIMED = "0xd1b893da855ca6a7c9cfbaff142da78c734a39d4811ad711fe7acfd6e5e433a4"        # RoyaltyDistributor: RoyaltyClaimed(address,address,uint256)
TOPIC_PAYMENT_RECEIVED = "0x62b4265ef816f751a94c5c93fa40a90302c6924509b973ed4094dcf30c6c61ed"       # GamePaymentGateway: PaymentReceived(uint256,address,address,uint256,string)
TOPIC_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"                # ERC20: Transfer(address,address,uint256)


# ---------------------------------------------------------------------------
# Minimal ABI decoding helpers. Every event here is either all-static
# fields, or has one or two dynamic `string` fields at the end - there are
# no dynamic arrays anywhere, so this covers everything without eth_abi.
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


def _decode_bool(data: bytes, word_index: int) -> bool:
    return _decode_uint(data, word_index) != 0


def _decode_string(data: bytes, head_word_index: int) -> str:
    """Decode a dynamic `string` param whose head word holds a byte offset
    (measured from byte 0 of `data`) to a [length][utf8 bytes] block."""
    offset = _decode_uint(data, head_word_index)
    length = int.from_bytes(data[offset:offset + 32], "big")
    raw = data[offset + 32:offset + 32 + length]
    return raw.decode("utf-8", errors="replace")


def _topic_address(topic_hex: str) -> str:
    # Every address this module writes to Mongo goes through this function,
    # which always lowercases. Raw eth_getLogs responses are lowercase
    # already, but anything derived from ethers.js / a frontend / a person
    # typing an address into a URL will usually be EIP-55 checksummed
    # (mixed-case) - callers (routes, admin scripts) MUST .lower() any
    # address before querying lab_launcher_tokens/_holdings/etc., or a
    # checksummed lookup will silently miss a real, correctly-indexed row.
    return _decode_address_word(_hex_to_bytes(topic_hex))


def _topic_uint(topic_hex: str) -> int:
    return int.from_bytes(_hex_to_bytes(topic_hex), "big")


def _wei_to_doge_str(wei: int) -> str:
    """Store DOGE amounts as decimal strings (not float) so nothing gets
    silently rounded - amounts can exceed float53 precision once a token's
    18-decimal balances get into the billions."""
    return f"{wei / DOGE_DECIMALS:.8f}"


class LabLauncherIndexer:
    def __init__(self, db):
        self.db = db
        self.enabled = bool(DOGEOS_RPC_URL and CONTRACTS["bonding_curve"] and CONTRACTS["factory"])
        if not self.enabled:
            logger.warning(
                "⚠️ Lab Launcher indexer disabled - DOGEOS_RPC_URL / "
                "LAB_LAUNCHER_FACTORY_ADDRESS / LAB_LAUNCHER_BONDING_CURVE_ADDRESS "
                "not all set. Set these once contracts are deployed."
            )
        self._http = httpx.AsyncClient(timeout=30.0)
        self._rpc_id = 0
        # Addresses that hold tokens as part of protocol mechanics, not as a
        # real participant - excluded from holder counts / top-holder lists.
        self._non_holder_addresses = {
            a.lower() for a in CONTRACTS.values() if a
        } | {BURN_ADDRESS}

    async def close(self):
        await self._http.aclose()

    # -- low-level RPC -------------------------------------------------
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

    async def _get_logs(self, address, topics, from_block: int, to_block: int) -> list:
        """Fetch logs in chunks of MAX_BLOCK_RANGE_PER_CALL so a long gap
        (e.g. after the indexer was off for a while) can't send one
        enormous eth_getLogs call that a public RPC endpoint would reject."""
        logs = []
        start = from_block
        while start <= to_block:
            end = min(start + MAX_BLOCK_RANGE_PER_CALL - 1, to_block)
            params = {
                "fromBlock": hex(start),
                "toBlock": hex(end),
                "topics": topics,
            }
            if address:
                params["address"] = address
            chunk = await self._rpc("eth_getLogs", [params])
            logs.extend(chunk)
            start = end + 1
        return logs

    # -- sync cursor -----------------------------------------------------
    async def _get_cursor(self, key: str) -> int:
        doc = await self.db.lab_launcher_sync_state.find_one({"_id": key})
        if doc and "last_synced_block" in doc:
            return doc["last_synced_block"]
        # First run for this event type: start from START_BLOCK - 1 so the
        # very first poll covers [START_BLOCK, latest] inclusive.
        return START_BLOCK - 1

    async def _set_cursor(self, key: str, block: int):
        await self.db.lab_launcher_sync_state.update_one(
            {"_id": key},
            {"$set": {"last_synced_block": block, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )

    # -- per-event-type sync ----------------------------------------------
    async def sync_factory_events(self, latest: int):
        cursor_key = "factory_token_launched"
        from_block = await self._get_cursor(cursor_key) + 1
        if from_block > latest:
            return
        logs = await self._get_logs(CONTRACTS["factory"], [TOPIC_TOKEN_LAUNCHED], from_block, latest)
        for log in logs:
            data = _hex_to_bytes(log["data"])
            token = _topic_address(log["topics"][1])
            creator = _topic_address(log["topics"][2])
            name = _decode_string(data, 0)
            symbol = _decode_string(data, 1)
            total_supply = _decode_uint(data, 2)
            await self.db.lab_launcher_tokens.update_one(
                {"_id": token},
                {
                    "$setOnInsert": {
                        "_id": token,
                        "token_address": token,
                        "creator_wallet": creator,
                        "name": name,
                        "symbol": symbol,
                        "total_supply": str(total_supply),
                        "description": None,
                        "logo": None,
                        "website": None,
                        "telegram": None,
                        "twitter": None,
                        "status": "bonding",
                        "graduation_target_doge": None,
                        "real_doge_reserve_doge": "0.00000000",
                        "bonding_progress_bps": 0,
                        "volume_doge": "0.00000000",
                        "trade_count": 0,
                        "holders": 0,
                        "last_price_doge": "0.00000000",
                        "market_cap_doge": "0.00000000",
                        "dex_pair": None,
                        "verified": False,
                        "favorites_count": 0,
                        "total_fees_generated_doge": "0.00000000",
                        "created_at": datetime.fromtimestamp(int(log.get("blockTimestamp", "0x0"), 16), tz=timezone.utc)
                        if log.get("blockTimestamp") else datetime.now(timezone.utc),
                        "graduated_at": None,
                        "creation_tx_hash": log["transactionHash"],
                    }
                },
                upsert=True,
            )
        await self._set_cursor(cursor_key, latest)

    async def sync_bonding_curve_events(self, latest: int):
        address = CONTRACTS["bonding_curve"]

        # TokenRegistered - fills in graduation_target_doge once known
        cursor_key = "curve_token_registered"
        from_block = await self._get_cursor(cursor_key) + 1
        if from_block <= latest:
            logs = await self._get_logs(address, [TOPIC_CURVE_TOKEN_REGISTERED], from_block, latest)
            for log in logs:
                data = _hex_to_bytes(log["data"])
                token = _topic_address(log["topics"][1])
                graduation_target = _decode_uint(data, 1)
                await self.db.lab_launcher_tokens.update_one(
                    {"_id": token},
                    {"$set": {"graduation_target_doge": _wei_to_doge_str(graduation_target)}},
                )
            await self._set_cursor(cursor_key, latest)

        # Trade - the busiest event type; drives volume/price/market cap/progress
        cursor_key = "curve_trade"
        from_block = await self._get_cursor(cursor_key) + 1
        if from_block <= latest:
            logs = await self._get_logs(address, [TOPIC_TRADE], from_block, latest)
            for log in logs:
                await self._apply_trade(log)
            await self._set_cursor(cursor_key, latest)

        # GraduationTriggered - curve side of graduation (BondingCurve marks
        # the token graduated the instant it hands off to GraduationManager,
        # even before the DEX pair actually exists)
        cursor_key = "curve_graduation_triggered"
        from_block = await self._get_cursor(cursor_key) + 1
        if from_block <= latest:
            logs = await self._get_logs(address, [TOPIC_GRADUATION_TRIGGERED], from_block, latest)
            for log in logs:
                token = _topic_address(log["topics"][1])
                await self.db.lab_launcher_tokens.update_one(
                    {"_id": token}, {"$set": {"status": "graduating"}}
                )
            await self._set_cursor(cursor_key, latest)

    async def _apply_trade(self, log: dict):
        data = _hex_to_bytes(log["data"])
        token = _topic_address(log["topics"][1])
        trader = _topic_address(log["topics"][2])
        is_buy = _decode_bool(data, 0)
        doge_amount = _decode_uint(data, 1)
        token_amount = _decode_uint(data, 2)
        fee = _decode_uint(data, 3)

        trade_doc = {
            "token_address": token,
            "trader": trader,
            "is_buy": is_buy,
            "doge_amount": _wei_to_doge_str(doge_amount),
            "token_amount": str(token_amount),
            "fee_doge": _wei_to_doge_str(fee),
            "price_doge": f"{(doge_amount / DOGE_DECIMALS) / (token_amount / DOGE_DECIMALS):.12f}" if token_amount else "0",
            "tx_hash": log["transactionHash"],
            "log_index": int(log["logIndex"], 16),
            "block_number": int(log["blockNumber"], 16),
            "timestamp": datetime.now(timezone.utc),
        }
        try:
            await self.db.lab_launcher_trades.insert_one(trade_doc)
        except Exception:
            # duplicate (tx_hash, log_index) - already processed this log,
            # e.g. after a restart re-scanned part of an already-synced range
            return

        token_doc = await self.db.lab_launcher_tokens.find_one({"_id": token})
        if not token_doc:
            return
        new_volume = float(token_doc.get("volume_doge", "0")) + (doge_amount / DOGE_DECIMALS)
        new_fees = float(token_doc.get("total_fees_generated_doge", "0")) + (fee / DOGE_DECIMALS)
        reserve_delta = (doge_amount - fee) / DOGE_DECIMALS if is_buy else -(doge_amount / DOGE_DECIMALS)
        new_reserve = max(0.0, float(token_doc.get("real_doge_reserve_doge", "0")) + reserve_delta)
        target = token_doc.get("graduation_target_doge")
        progress_bps = 10000
        if target and float(target) > 0:
            progress_bps = min(10000, int((new_reserve / float(target)) * 10000))
        price = (doge_amount / DOGE_DECIMALS) / (token_amount / DOGE_DECIMALS) if token_amount else 0
        total_supply = float(token_doc.get("total_supply", "0")) / DOGE_DECIMALS

        await self.db.lab_launcher_tokens.update_one(
            {"_id": token},
            {
                "$set": {
                    "volume_doge": f"{new_volume:.8f}",
                    "total_fees_generated_doge": f"{new_fees:.8f}",
                    "real_doge_reserve_doge": f"{new_reserve:.8f}",
                    "bonding_progress_bps": progress_bps,
                    "last_price_doge": f"{price:.12f}",
                    "market_cap_doge": f"{price * total_supply:.8f}",
                },
                "$inc": {"trade_count": 1},
            },
        )

    async def sync_graduation_events(self, latest: int):
        address = CONTRACTS["graduation_manager"]
        if not address:
            return
        cursor_key = "graduation_manager_token_graduated"
        from_block = await self._get_cursor(cursor_key) + 1
        if from_block > latest:
            return
        logs = await self._get_logs(address, [TOPIC_TOKEN_GRADUATED], from_block, latest)
        for log in logs:
            data = _hex_to_bytes(log["data"])
            token = _topic_address(log["topics"][1])
            pair = _topic_address(log["topics"][2])
            await self.db.lab_launcher_tokens.update_one(
                {"_id": token},
                {
                    "$set": {
                        "status": "graduated",
                        "dex_pair": pair,
                        "graduated_at": datetime.now(timezone.utc),
                        "bonding_progress_bps": 10000,
                    }
                },
            )
        await self._set_cursor(cursor_key, latest)

    async def sync_royalty_events(self, latest: int):
        address = CONTRACTS["royalty_distributor"]
        if not address:
            return
        cursor_key = "royalty_distributor_claimed"
        from_block = await self._get_cursor(cursor_key) + 1
        if from_block > latest:
            return
        logs = await self._get_logs(address, [TOPIC_ROYALTY_CLAIMED], from_block, latest)
        for log in logs:
            data = _hex_to_bytes(log["data"])
            token = _topic_address(log["topics"][1])
            creator = _topic_address(log["topics"][2])
            amount = _decode_uint(data, 0)
            doc = {
                "token_address": token,
                "creator_wallet": creator,
                "amount": str(amount),
                "tx_hash": log["transactionHash"],
                "log_index": int(log["logIndex"], 16),
                "timestamp": datetime.now(timezone.utc),
            }
            try:
                await self.db.lab_launcher_royalty_claims.insert_one(doc)
            except Exception:
                pass
        await self._set_cursor(cursor_key, latest)

    async def sync_payment_events(self, latest: int):
        address = CONTRACTS["game_payment_gateway"]
        if not address:
            return
        cursor_key = "game_payment_gateway_payment_received"
        from_block = await self._get_cursor(cursor_key) + 1
        if from_block > latest:
            return
        logs = await self._get_logs(address, [TOPIC_PAYMENT_RECEIVED], from_block, latest)
        for log in logs:
            data = _hex_to_bytes(log["data"])
            payment_id = _topic_uint(log["topics"][1])
            payer = _topic_address(log["topics"][2])
            currency = _decode_address(data, 0)
            amount = _decode_uint(data, 1)
            feature = _decode_string(data, 2)
            doc = {
                "payment_id": payment_id,
                "payer_wallet": payer,
                "currency": None if currency == "0x0000000000000000000000000000000000000000" else currency,
                "amount": str(amount),
                "feature": feature,
                "tx_hash": log["transactionHash"],
                "log_index": int(log["logIndex"], 16),
                "timestamp": datetime.now(timezone.utc),
            }
            try:
                await self.db.lab_launcher_game_payments.insert_one(doc)
            except Exception:
                pass
        await self._set_cursor(cursor_key, latest)

    async def sync_transfer_events(self, latest: int):
        """Holder balances for every launched token. Uses an address-array
        filter (all known token addresses) rather than scanning Transfer
        logs chain-wide, so this stays cheap as more tokens launch."""
        tokens = await self.db.lab_launcher_tokens.distinct("_id")
        if not tokens:
            return
        cursor_key = "launch_token_transfers"
        from_block = await self._get_cursor(cursor_key) + 1
        if from_block > latest:
            return
        logs = await self._get_logs(tokens, [TOPIC_TRANSFER], from_block, latest)
        touched_tokens = set()
        for log in logs:
            token = log["address"]
            # Normalize to however this token is keyed in lab_launcher_tokens
            token_doc = await self.db.lab_launcher_tokens.find_one(
                {"_id": {"$regex": f"^{token}$", "$options": "i"}}
            )
            token_key = token_doc["_id"] if token_doc else token
            frm = _topic_address(log["topics"][1])
            to = _topic_address(log["topics"][2])
            value = _decode_uint(_hex_to_bytes(log["data"]), 0)
            zero = "0x0000000000000000000000000000000000000000"
            if frm != zero:
                await self._adjust_balance(token_key, frm, -value)
            if to != zero:
                await self._adjust_balance(token_key, to, value)
            touched_tokens.add(token_key)
        for token_key in touched_tokens:
            holder_count = await self.db.lab_launcher_holdings.count_documents(
                {
                    "token_address": token_key,
                    "balance": {"$ne": "0"},
                    "wallet": {"$nin": list(self._non_holder_addresses)},
                }
            )
            await self.db.lab_launcher_tokens.update_one(
                {"_id": token_key}, {"$set": {"holders": holder_count}}
            )
        await self._set_cursor(cursor_key, latest)

    async def _adjust_balance(self, token: str, wallet: str, delta: int):
        doc = await self.db.lab_launcher_holdings.find_one({"token_address": token, "wallet": wallet})
        current = int(doc["balance"]) if doc else 0
        new_balance = max(0, current + delta)
        await self.db.lab_launcher_holdings.update_one(
            {"token_address": token, "wallet": wallet},
            {"$set": {"balance": str(new_balance)}},
            upsert=True,
        )

    # -- top-level poll ----------------------------------------------------
    async def poll_once(self):
        if not self.enabled:
            return
        latest = await self._latest_block()
        for sync_fn in (
            self.sync_factory_events,
            self.sync_bonding_curve_events,
            self.sync_graduation_events,
            self.sync_royalty_events,
            self.sync_payment_events,
            self.sync_transfer_events,
        ):
            try:
                await sync_fn(latest)
            except Exception as e:
                logger.error(f"Lab Launcher indexer: {sync_fn.__name__} failed: {e}")

    async def run_forever(self):
        if not self.enabled:
            return
        logger.info("🚀 Lab Launcher indexer started")
        while True:
            try:
                await self.poll_once()
            except Exception as e:
                logger.error(f"Lab Launcher indexer: poll_once failed: {e}")
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
