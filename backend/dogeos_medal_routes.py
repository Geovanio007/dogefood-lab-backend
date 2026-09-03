"""
HeistMedal API routes.

Sibling to server.py - same convention as lab_launcher_routes.py /
lab_feed_social_routes.py.

What each endpoint is for:
  GET  /api/dogeos-medal/config              - contract address/chain id the
                                                frontend needs to build the
                                                on-chain claimMedal() tx.
  GET  /api/dogeos-medal/eligibility/{wallet} - has this wallet created a Lab
                                                Launcher token? Is the
                                                campaign still open? Has it
                                                already claimed on-chain?
                                                (best-effort - see note below)
                                                Drives what the My Treats
                                                page shows: locked / ready to
                                                claim / already claimed /
                                                campaign closed.
  POST /api/dogeos-medal/claim-signature      - the real "give me my
                                                signature" call. Frontend
                                                calls this, then submits the
                                                returned signature to
                                                HeistMedal.claimMedal()
                                                itself via wagmi (backend
                                                never spends gas here).
  POST /api/dogeos-medal/admin/close-campaign - stops new signatures being
  POST /api/dogeos-medal/admin/open-campaign    issued, immediately. This is
                                                the FastAPI stop switch
                                                Bruno asked for.

Two-layer shutoff, both documented here so it's clear which is which:
  1. This close-campaign endpoint flips a Mongo flag. Once flipped, this
     backend will never hand out another valid claim signature - the
     practical effect is nobody NEW can claim, immediately, no gas, no
     wallet needed on the backend.
  2. HeistMedal.sol also has its own on-chain `campaignOpen` switch
     (owner-only). That owner key deliberately never lives on this backend
     (same reasoning as keeping the registrar signer separate from
     admin/treasury in LabFeedSocial - see dogeos_medal_signer.py) - it's
     yours to flip directly (e.g. from the block explorer's "Write
     Contract" tab, or a one-off script) if you ever want to guarantee even
     an already-issued-but-unredeemed signature can't be submitted anymore.
     Layer 1 is what actually stops the campaign in practice; layer 2 is a
     manual belt-and-suspenders option that's entirely yours to use, not
     something this backend can do for you.

On-chain claim counts: without a small indexer (the same shape as
lab_launcher_indexer.py) watching MedalClaimed events, this backend can't
know the *true* on-chain claimed count or definitively say "wallet X has
already claimed" - hasClaimed lives only on-chain. eligibility/{wallet}
below reports what it *can* know (created a token, campaign open/closed,
whether we've issued a signature before) and is honest about that gap
rather than guessing.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from services import dogeos_medal_signer as signer


def create_dogeos_medal_router(db, admin_dep) -> APIRouter:
    router = APIRouter(prefix="/api/dogeos-medal", tags=["dogeos-medal"])

    async def _campaign_open() -> bool:
        doc = await db.heist_medal_config.find_one({"_id": "campaign"})
        # Defaults open - matches "campaignOpen = true" in the contract's
        # constructor, so the two stay in sync unless explicitly closed.
        return True if doc is None else bool(doc.get("open", True))

    @router.get("/config")
    async def config():
        return {
            "contract_address": signer.HEIST_MEDAL_CONTRACT_ADDRESS or None,
            "chain_id": signer.HEIST_MEDAL_CHAIN_ID,
            "configured": signer.is_configured(),
            "campaign_open": await _campaign_open(),
        }

    @router.get("/eligibility/{wallet}")
    async def eligibility(wallet: str):
        if not (wallet.startswith("0x") and len(wallet) == 42):
            raise HTTPException(status_code=400, detail="Not a wallet address")

        token = await db.lab_launcher_tokens.find_one({"creator_wallet": wallet.lower()})
        campaign_open = await _campaign_open()
        prior_issue = await db.heist_medal_signature_log.find_one({"wallet": wallet.lower()})

        return {
            "wallet": wallet.lower(),
            "created_lab_launcher_token": token is not None,
            "token_address": token.get("_id") if token else None,
            "campaign_open": campaign_open,
            "signature_previously_issued": prior_issue is not None,
            "note": "hasClaimed is on-chain only - this doesn't confirm whether the "
            "mint transaction itself was ever submitted, only whether this backend "
            "has issued this wallet a valid signature before.",
        }

    @router.post("/claim-signature")
    async def claim_signature(body: dict):
        wallet = (body.get("wallet") or "").strip()
        if not (wallet.startswith("0x") and len(wallet) == 42):
            raise HTTPException(status_code=400, detail="Not a wallet address")
        if not signer.is_configured():
            raise HTTPException(status_code=503, detail="Medal signer isn't configured yet")
        if not await _campaign_open():
            raise HTTPException(status_code=403, detail="The heist medal campaign is closed")

        token = await db.lab_launcher_tokens.find_one({"creator_wallet": wallet.lower()})
        if not token:
            raise HTTPException(
                status_code=403,
                detail="This wallet hasn't created a Lab Launcher token yet - that's what "
                "the heist medal is for.",
            )

        signature = signer.sign_claim(wallet)
        await db.heist_medal_signature_log.update_one(
            {"wallet": wallet.lower()},
            {
                "$set": {"wallet": wallet.lower(), "last_issued_at": datetime.now(timezone.utc).isoformat()},
                "$setOnInsert": {"first_issued_at": datetime.now(timezone.utc).isoformat()},
            },
            upsert=True,
        )
        return {
            "wallet": wallet.lower(),
            "signature": signature,
            "contract_address": signer.HEIST_MEDAL_CONTRACT_ADDRESS,
            "chain_id": signer.HEIST_MEDAL_CHAIN_ID,
        }

    @router.post("/admin/close-campaign", dependencies=[admin_dep])
    async def close_campaign():
        await db.heist_medal_config.update_one(
            {"_id": "campaign"},
            {"$set": {"open": False, "closed_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        return {"campaign_open": False}

    @router.post("/admin/open-campaign", dependencies=[admin_dep])
    async def open_campaign():
        await db.heist_medal_config.update_one(
            {"_id": "campaign"},
            {"$set": {"open": True}, "$unset": {"closed_at": ""}},
            upsert=True,
        )
        return {"campaign_open": True}

    return router


# ---------------------------------------------------------------------------
# server.py hook-in (add alongside the dogeos_quest_routes wiring):
#
#   from dogeos_medal_routes import create_dogeos_medal_router
#   app.include_router(create_dogeos_medal_router(db, Depends(verify_admin)))
# ---------------------------------------------------------------------------
