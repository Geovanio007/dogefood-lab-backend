"""
Lab Launcher API routes.

Lives as a sibling to server.py rather than being folded into it directly.
server.py defines its api_router and calls app.include_router(api_router)
for its ~150 existing routes inline; server.py itself is too large to safely
reproduce in full for a review/paste workflow, so this instead exposes a
small factory function server.py calls once at startup, matching the
services/*.py pattern already used for business logic (just applied to
routes too, since there's no existing precedent for routes living outside
server.py to follow more closely). See the bottom of this file for the
exact three lines server.py needs.

Every address in path/query/body params is lowercased before hitting Mongo
- see the comment on _topic_address in lab_launcher_indexer.py for why.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field


class TokenMetadataIn(BaseModel):
    creator_wallet: str = Field(..., description="Must match the token's on-chain creator")
    description: Optional[str] = None
    logo: Optional[str] = None
    website: Optional[str] = None
    telegram: Optional[str] = None
    twitter: Optional[str] = None


class FavoriteIn(BaseModel):
    wallet: str


class VerificationApplyIn(BaseModel):
    wallet: str
    website: Optional[str] = None
    telegram: Optional[str] = None
    twitter: Optional[str] = None
    note: Optional[str] = Field(None, description="Anything the creator wants a reviewer to see")


class VerificationReviewIn(BaseModel):
    approve: bool
    reason: Optional[str] = None


DISCOVERY_TABS = {
    "trending": [("volume_doge", -1)],  # simple proxy for "trending" until a time-windowed volume field exists
    "new": [("created_at", -1)],
    "graduated": [("graduated_at", -1)],
    "highest_volume": [("volume_doge", -1)],
    "most_holders": [("holders", -1)],
    "community_favorites": [("favorites_count", -1)],
}

SORT_FIELDS = {
    "volume": "volume_doge",
    "market_cap": "market_cap_doge",
    "holders": "holders",
    "newest": "created_at",
    "graduated": "graduated_at",
}


def _numeric_sort(field: str):
    """lab_launcher_tokens stores DOGE amounts as fixed-point strings (see
    _wei_to_doge_str) so nothing gets silently rounded - but that means a
    plain Mongo sort on that field would sort lexicographically, not
    numerically ("9.0" > "10.0" as strings). Sort in Python instead for the
    handful of fields where that matters."""
    return field in ("volume_doge", "market_cap_doge")


def create_lab_launcher_router(db, admin_dependency) -> APIRouter:
    router = APIRouter(prefix="/api/lab-launcher", tags=["lab-launcher"])

    # ---- token metadata (off-chain fields set right after on-chain create) --
    @router.post("/tokens/{token_address}/metadata")
    async def set_token_metadata(token_address: str, body: TokenMetadataIn):
        token_address = token_address.lower()
        token = await db.lab_launcher_tokens.find_one({"_id": token_address})
        if not token:
            raise HTTPException(
                status_code=404,
                detail="Token not found yet - the indexer usually picks up a new "
                "token within one poll cycle of the on-chain create tx confirming. Try again shortly.",
            )
        if token["creator_wallet"].lower() != body.creator_wallet.lower():
            raise HTTPException(status_code=403, detail="Only this token's creator can set its metadata")

        update = {k: v for k, v in body.dict(exclude={"creator_wallet"}).items() if v is not None}
        if update:
            await db.lab_launcher_tokens.update_one({"_id": token_address}, {"$set": update})
        return await db.lab_launcher_tokens.find_one({"_id": token_address})

    # ---- discovery ---------------------------------------------------------
    @router.get("/tokens")
    async def list_tokens(
        tab: Optional[str] = Query(None, description="trending | new | graduated | highest_volume | most_holders | community_favorites"),
        sort: Optional[str] = Query(None, description="volume | market_cap | holders | newest | graduated"),
        search: Optional[str] = Query(None, description="matches name or symbol, case-insensitive"),
        status: Optional[str] = Query(None, description="bonding | graduating | graduated"),
        limit: int = Query(20, le=100),
        offset: int = Query(0, ge=0),
    ):
        query = {}
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"symbol": {"$regex": search, "$options": "i"}},
            ]
        if status:
            query["status"] = status
        if tab == "graduated":
            query["status"] = "graduated"

        sort_spec = None
        if tab and tab in DISCOVERY_TABS and not sort:
            sort_spec = DISCOVERY_TABS[tab]
        elif sort and sort in SORT_FIELDS:
            sort_spec = [(SORT_FIELDS[sort], -1)]

        cursor = db.lab_launcher_tokens.find(query)
        field = sort_spec[0][0] if sort_spec else None
        if sort_spec and not _numeric_sort(field):
            cursor = cursor.sort(sort_spec)
            docs = await cursor.skip(offset).limit(limit).to_list(limit)
        else:
            # numeric-as-string fields: pull the filtered set, sort in
            # Python, then paginate - fine at this data scale, and avoids
            # storing a duplicate numeric column purely for sorting.
            docs = await cursor.to_list(10000)
            if sort_spec:
                docs.sort(key=lambda d: float(d.get(field, 0) or 0), reverse=True)
            docs = docs[offset:offset + limit]

        return {"tokens": docs, "count": len(docs)}

    # ---- token profile -------------------------------------------------
    @router.get("/tokens/{token_address}")
    async def get_token(token_address: str):
        token_address = token_address.lower()
        token = await db.lab_launcher_tokens.find_one({"_id": token_address})
        if not token:
            raise HTTPException(status_code=404, detail="Token not found")

        large_wallet_alert = False
        top_holder_pct = 0.0
        holdings = await db.lab_launcher_holdings.find({"token_address": token_address}).to_list(10000)
        total_supply = float(token.get("total_supply", "0"))
        if holdings and total_supply > 0:
            top = max(holdings, key=lambda h: int(h["balance"]))
            top_holder_pct = round((int(top["balance"]) / total_supply) * 100, 2)
            large_wallet_alert = top_holder_pct >= 10.0

        return {
            **token,
            "anti_rug": {
                # True by construction, not a claim: LaunchToken has no
                # owner/mint/pause functions at all, and graduation burns LP
                # to the dead address instead of merely locking it - see
                # LaunchToken.sol / GraduationManager.sol.
                "ownership_renounced": True,
                "liquidity_locked": token["status"] == "graduated",
                "contract_verified": True,  # every token is the same audited LaunchToken bytecode from one factory
                "creator_wallet": token["creator_wallet"],
                "top_holder_pct": top_holder_pct,
                "large_wallet_alert": large_wallet_alert,
            },
        }

    @router.get("/tokens/{token_address}/trades")
    async def get_token_trades(token_address: str, limit: int = Query(50, le=200), offset: int = Query(0, ge=0)):
        token_address = token_address.lower()
        cursor = db.lab_launcher_trades.find({"token_address": token_address}, {"_id": 0}).sort([("timestamp", -1)])
        trades = await cursor.skip(offset).limit(limit).to_list(limit)
        return {"trades": trades, "count": len(trades)}

    @router.get("/tokens/{token_address}/holders")
    async def get_token_holders(token_address: str, limit: int = Query(50, le=200)):
        token_address = token_address.lower()
        holdings = await db.lab_launcher_holdings.find(
            {"token_address": token_address, "balance": {"$ne": "0"}}
        ).to_list(10000)
        holdings.sort(key=lambda h: int(h["balance"]), reverse=True)
        token = await db.lab_launcher_tokens.find_one({"_id": token_address})
        total_supply = float(token["total_supply"]) if token else 0
        top = holdings[:limit]
        return {
            "holders": [
                {
                    "wallet": h["wallet"],
                    "balance": h["balance"],
                    "pct": round((int(h["balance"]) / total_supply) * 100, 4) if total_supply else 0,
                }
                for h in top
            ],
            "total_holders": len(holdings),
        }

    # ---- creator dashboard -----------------------------------------------
    @router.get("/creators/{wallet}/dashboard")
    async def creator_dashboard(wallet: str):
        wallet = wallet.lower()
        tokens = await db.lab_launcher_tokens.find({"creator_wallet": wallet}).to_list(1000)
        royalty_claims = await db.lab_launcher_royalty_claims.find({"creator_wallet": wallet}).to_list(10000)
        token_addresses = [t["_id"] for t in tokens]
        game_purchase_count = 0
        if token_addresses:
            game_purchase_count = await db.lab_launcher_game_payments.count_documents(
                {"currency": {"$in": token_addresses}}
            )

        claims_by_token = {}
        for c in royalty_claims:
            claims_by_token.setdefault(c["token_address"], 0)
            claims_by_token[c["token_address"]] += int(c["amount"])

        return {
            "wallet": wallet,
            "tokens": [
                {
                    "token_address": t["_id"],
                    "name": t["name"],
                    "symbol": t["symbol"],
                    "status": t["status"],
                    "market_cap_doge": t["market_cap_doge"],
                    "volume_doge": t["volume_doge"],
                    "holders": t["holders"],
                    "total_royalties_claimed": str(claims_by_token.get(t["_id"], 0)),
                }
                for t in tokens
            ],
            "total_tokens_created": len(tokens),
            "total_royalty_claims": len(royalty_claims),
            "in_game_purchases_using_creator_tokens": game_purchase_count,
        }

    @router.get("/creators/{wallet}/royalty-claims")
    async def creator_royalty_claims(wallet: str, limit: int = Query(50, le=200), offset: int = Query(0, ge=0)):
        wallet = wallet.lower()
        cursor = db.lab_launcher_royalty_claims.find({"creator_wallet": wallet}, {"_id": 0}).sort([("timestamp", -1)])
        claims = await cursor.skip(offset).limit(limit).to_list(limit)
        return {"claims": claims, "count": len(claims)}

    # ---- community favorites ----------------------------------------------
    @router.post("/tokens/{token_address}/favorite")
    async def toggle_favorite(token_address: str, body: FavoriteIn):
        token_address = token_address.lower()
        wallet = body.wallet.lower()
        token = await db.lab_launcher_tokens.find_one({"_id": token_address})
        if not token:
            raise HTTPException(status_code=404, detail="Token not found")

        existing = await db.lab_launcher_favorites.find_one({"token_address": token_address, "wallet": wallet})
        if existing:
            await db.lab_launcher_favorites.delete_one({"_id": existing["_id"]})
            await db.lab_launcher_tokens.update_one({"_id": token_address}, {"$inc": {"favorites_count": -1}})
            return {"favorited": False}
        else:
            await db.lab_launcher_favorites.insert_one({"token_address": token_address, "wallet": wallet})
            await db.lab_launcher_tokens.update_one({"_id": token_address}, {"$inc": {"favorites_count": 1}})
            return {"favorited": True}

    # ---- verification (manual review, matching the spec's "requirements
    # reviewed by a human" framing rather than an auto-evaluated score) -----
    @router.post("/tokens/{token_address}/verification/apply")
    async def apply_for_verification(token_address: str, body: VerificationApplyIn):
        token_address = token_address.lower()
        token = await db.lab_launcher_tokens.find_one({"_id": token_address})
        if not token:
            raise HTTPException(status_code=404, detail="Token not found")
        if token["creator_wallet"].lower() != body.wallet.lower():
            raise HTTPException(status_code=403, detail="Only this token's creator can apply for verification")
        if token.get("verified"):
            raise HTTPException(status_code=400, detail="Already verified")

        await db.lab_launcher_verification_requests.update_one(
            {"token_address": token_address, "status": "pending"},
            {
                "$set": {
                    "token_address": token_address,
                    "creator_wallet": body.wallet.lower(),
                    "website": body.website,
                    "telegram": body.telegram,
                    "twitter": body.twitter,
                    "note": body.note,
                    "status": "pending",
                    "submitted_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        return {"status": "pending"}

    @router.get("/verification/pending")
    async def list_pending_verifications(_: None = admin_dependency):
        docs = await db.lab_launcher_verification_requests.find({"status": "pending"}, {"_id": 0}).to_list(500)
        return {"requests": docs, "count": len(docs)}

    @router.post("/tokens/{token_address}/verification/review")
    async def review_verification(token_address: str, body: VerificationReviewIn, _: None = admin_dependency):
        token_address = token_address.lower()
        request = await db.lab_launcher_verification_requests.find_one(
            {"token_address": token_address, "status": "pending"}
        )
        if not request:
            raise HTTPException(status_code=404, detail="No pending verification request for this token")

        new_status = "approved" if body.approve else "rejected"
        await db.lab_launcher_verification_requests.update_one(
            {"_id": request["_id"]},
            {"$set": {"status": new_status, "reason": body.reason, "reviewed_at": datetime.now(timezone.utc)}},
        )
        if body.approve:
            await db.lab_launcher_tokens.update_one({"_id": token_address}, {"$set": {"verified": True}})
        return {"status": new_status}

    # ---- game payments ------------------------------------------------
    @router.get("/payments")
    async def list_game_payments(
        wallet: Optional[str] = Query(None),
        feature: Optional[str] = Query(None),
        limit: int = Query(50, le=200),
        offset: int = Query(0, ge=0),
    ):
        query = {}
        if wallet:
            query["payer_wallet"] = wallet.lower()
        if feature:
            query["feature"] = feature
        cursor = db.lab_launcher_game_payments.find(query, {"_id": 0}).sort([("timestamp", -1)])
        payments = await cursor.skip(offset).limit(limit).to_list(limit)
        return {"payments": payments, "count": len(payments)}

    return router


# ---------------------------------------------------------------------------
# server.py hook-in (3 lines, added right after the existing
# app.include_router(api_router) call near the end of the file):
#
#   from lab_launcher_routes import create_lab_launcher_router
#   from services.lab_launcher_indexer import LabLauncherIndexer
#   lab_launcher_indexer = LabLauncherIndexer(db)
#   app.include_router(create_lab_launcher_router(db, Depends(verify_admin)))
#
# and inside delayed_startup(), alongside the other asyncio.create_task(...)
# calls:
#
#   asyncio.create_task(lab_launcher_indexer.run_forever())
# ---------------------------------------------------------------------------
