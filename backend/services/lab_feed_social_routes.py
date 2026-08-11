"""
LabFeedSocial API routes.

Sibling to server.py, same reasoning as lab_launcher_routes.py (see that
file's docstring): server.py is too large to safely reproduce in full for
a review/paste workflow, so this exposes a small factory function server.py
calls once at startup instead.

These are ADDITIVE - the existing free/instant /api/lab-notes/{id}/like
and /comment endpoints are untouched and still work exactly as before.
Nothing here changes until the frontend is switched over to call these
instead (see LabFeedSocial phase notes). That's deliberate: shipping this
on its own should never be able to break the live app.

What each endpoint is for:
  GET  /{note_id}/auth        - before submitting an on-chain like/comment,
                                 the frontend calls this to get the postId
                                 and (if needed) a registration signature.
  POST /{note_id}/like-tx      - called right after the frontend submits a
  POST /{note_id}/comment-tx    signed on-chain tx, to record it as pending.
                                 Neither of these increments any counts -
                                 only services/lab_feed_social_indexer.py
                                 does that, and only once it has actually
                                 observed the confirming event.
  GET  /status (admin)        - configuration + indexer health.
"""
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from eth_utils import keccak

from services import lab_feed_social_signer as signer
from services import lab_feed_social_indexer as indexer_module


def _is_wallet_address(address: Optional[str]) -> bool:
    """lab_notes.author_address can be a real 0x wallet, or a Telegram-only
    pseudo-address (TG_...) / GUEST_USER for players who never connected a
    wallet - matches the same check TipModal already applies client-side
    for tipping, now enforced here too since a signature/tx over a
    non-address would be meaningless."""
    return bool(address) and address.startswith("0x") and len(address) == 42


class LikeTxIn(BaseModel):
    player_address: str
    tx_hash: str


class CommentTxIn(BaseModel):
    player_address: str
    comment_id: str  # bytes32 hex, matches what was submitted on-chain
    comment_hash: str  # bytes32 hex = keccak256(content.strip().encode("utf-8"))
    content: str
    tx_hash: str


def create_lab_feed_social_router(db) -> APIRouter:
    router = APIRouter(prefix="/api/lab-feed-social", tags=["lab-feed-social"])

    @router.get("/{note_id}/auth")
    async def get_onchain_auth(note_id: str):
        note = await db.lab_notes.find_one({"id": note_id})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")

        author = note.get("author_address", "")
        if not _is_wallet_address(author):
            raise HTTPException(
                status_code=400,
                detail="This post's author hasn't connected a wallet, so on-chain "
                "likes/comments can't be sent to them yet.",
            )
        if not signer.is_configured():
            raise HTTPException(status_code=503, detail="On-chain interactions aren't configured yet")

        post_id = signer.compute_post_id(author, note_id)
        post_id_hex = "0x" + post_id.hex()

        # Idempotent - always the same value for this (author, note_id), so
        # repeat calls just re-set the same thing. This is what lets the
        # indexer map an event's postId back to a lab_notes document later.
        await db.lab_notes.update_one({"id": note_id}, {"$set": {"onchain_post_id": post_id_hex}})

        registration_signature = signer.sign_registration(post_id, author)

        return {
            "post_id": post_id_hex,
            "author": author,
            "registration_signature": registration_signature,
            "contract_address": signer.LABFEED_SOCIAL_CONTRACT_ADDRESS,
            "chain_id": signer.LABFEED_SOCIAL_CHAIN_ID,
        }

    @router.post("/{note_id}/like-tx")
    async def record_like_tx(note_id: str, body: LikeTxIn):
        note = await db.lab_notes.find_one({"id": note_id})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")

        await db.lab_notes_onchain_interactions.update_one(
            {"tx_hash": body.tx_hash},
            {
                "$setOnInsert": {
                    "tx_hash": body.tx_hash,
                    "note_id": note_id,
                    "kind": "like",
                    "player_address": body.player_address.lower(),
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        return {"status": "pending"}

    @router.post("/{note_id}/comment-tx")
    async def record_comment_tx(note_id: str, body: CommentTxIn):
        note = await db.lab_notes.find_one({"id": note_id})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")

        expected_hash = "0x" + keccak(body.content.strip().encode("utf-8")).hex()
        if expected_hash.lower() != body.comment_hash.lower():
            raise HTTPException(
                status_code=400,
                detail="comment_hash doesn't match keccak256(content.strip()) - "
                "this must be the exact hash submitted on-chain.",
            )

        await db.lab_notes_onchain_interactions.update_one(
            {"tx_hash": body.tx_hash},
            {
                "$setOnInsert": {
                    "tx_hash": body.tx_hash,
                    "note_id": note_id,
                    "kind": "comment",
                    "player_address": body.player_address.lower(),
                    "comment_id": body.comment_id,
                    "comment_hash": body.comment_hash,
                    "content": body.content,
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        return {"status": "pending"}

    @router.get("/status")
    async def onchain_status():
        configured = signer.is_configured() and indexer_module.LABFEED_SOCIAL_CONTRACT_ADDRESS != ""
        rpc_reachable = False
        rpc_error = None
        latest_block = None
        if indexer_module.DOGEOS_RPC_URL:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        indexer_module.DOGEOS_RPC_URL,
                        json={"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []},
                    )
                    resp.raise_for_status()
                    latest_block = int(resp.json()["result"], 16)
                    rpc_reachable = True
            except Exception as e:
                rpc_error = str(e)

        sync_state = await db.lab_notes_onchain_sync_state.find().to_list(20)
        pending_count = await db.lab_notes_onchain_interactions.count_documents({"status": "pending"})
        confirmed_count = await db.lab_notes_onchain_interactions.count_documents({"status": "confirmed"})

        return {
            "configured": configured,
            "registrar_address": signer.registrar_address(),
            "contract_address": indexer_module.LABFEED_SOCIAL_CONTRACT_ADDRESS,
            "rpc_reachable": rpc_reachable,
            "rpc_error": rpc_error,
            "latest_chain_block": latest_block,
            "sync_cursors": [{"key": s["_id"], "last_synced_block": s.get("last_synced_block")} for s in sync_state],
            "pending_interactions": pending_count,
            "confirmed_interactions": confirmed_count,
        }

    return router


# ---------------------------------------------------------------------------
# server.py hook-in (matching the lab_launcher_routes.py convention - add
# these lines right after the existing lab_launcher wiring near the end of
# the file):
#
#   from lab_feed_social_routes import create_lab_feed_social_router
#   from services.lab_feed_social_indexer import LabFeedSocialIndexer, ensure_indexes as ensure_lab_feed_social_indexes
#   lab_feed_social_indexer = LabFeedSocialIndexer(db)
#   app.include_router(create_lab_feed_social_router(db))
#
# inside delayed_startup(), alongside the other asyncio.create_task(...) calls:
#
#   await ensure_lab_feed_social_indexes(db)
#   asyncio.create_task(lab_feed_social_indexer.run_forever())
# ---------------------------------------------------------------------------
