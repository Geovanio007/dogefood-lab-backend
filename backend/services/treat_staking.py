"""
DogeFood Lab — Treat Staking ("Stake Your Treats")

Players lock up to 5 already-collected treats to earn real-time points
yield, scaled by the treat's rarity tier. Staking a treat costs a flat DOGE
fee, paid through the existing NOWPayments hosted-invoice flow already used
for extra lives and the auto-mixer subscription (see server.py's
create_nowpayments_invoice / nowpayments_ipn_webhook) — this module has no
NOWPayments/httpx access itself, it only owns the treat_stakes collection
and the accrual math.

Payout is fully bounded and predictable at any instant:
    principal * apy * elapsed_seconds / YEAR_SECONDS
so total outstanding liability across every active stake can always be
computed directly, which matters for "the platform can afford it" to stay
true as this scales rather than becoming an open-ended promise.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict
import uuid

MAX_STAKED_TREATS = 5
STAKE_COST_DOGE = 30
YEAR_SECONDS = 365 * 24 * 3600

# Principal (points) + APY per rarity tier. Higher tiers are strictly more
# attractive to stake, which ties this feature back into the core
# ingredient-mixing loop instead of being a disconnected side vault.
TIERS = {
    "Common":    {"principal": 50,   "apy": 0.40},
    "Uncommon":  {"principal": 120,  "apy": 0.55},
    "Rare":      {"principal": 250,  "apy": 0.75},
    "Epic":      {"principal": 500,  "apy": 1.00},
    "Legendary": {"principal": 1000, "apy": 1.40},
    "Mythic":    {"principal": 2000, "apy": 2.00},
}
DEFAULT_TIER = {"principal": 50, "apy": 0.40}  # fallback for an unrecognized rarity string


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value


def get_tier(rarity: str) -> dict:
    return TIERS.get((rarity or "").strip().title(), DEFAULT_TIER)


def _rate_per_second(stake: dict) -> float:
    principal = stake.get("principal", DEFAULT_TIER["principal"])
    apy = stake.get("apy", DEFAULT_TIER["apy"])
    return (principal * apy) / YEAR_SECONDS


def _preview_accrued(stake: dict, now: Optional[datetime] = None) -> float:
    """Live estimate for display only (fractional) — not what actually gets
    credited. See _claim_internal for the real, whole-point-safe credit."""
    if stake.get("status") != "active":
        return 0.0
    since = _parse_dt(stake.get("last_claim_at") or stake.get("staked_at"))
    if not since:
        return 0.0
    now = now or _utcnow()
    elapsed = max(0.0, (now - since).total_seconds())
    return _rate_per_second(stake) * elapsed


async def count_active_stakes(db, player_address: str) -> int:
    return await db.treat_stakes.count_documents({
        "player_address": player_address,
        "status": {"$in": ["pending", "active"]},
    })


async def is_treat_staked(db, treat_id: str) -> bool:
    existing = await db.treat_stakes.find_one({
        "treat_id": treat_id,
        "status": {"$in": ["pending", "active"]},
    })
    return existing is not None


async def create_pending_stake(db, player_address: str, treat: dict) -> dict:
    """Creates the pending treat_stakes doc. Caller (server.py) still needs
    to create the NOWPayments invoice and store its id/url on this doc —
    kept out of this module since it has no NOWPayments/httpx access."""
    tier = get_tier(treat.get("rarity"))
    stake = {
        "id": str(uuid.uuid4()),
        "player_address": player_address,
        "treat_id": treat["id"],
        "treat_name": treat.get("name"),
        "treat_image": treat.get("image"),
        "rarity": treat.get("rarity"),
        "principal": tier["principal"],
        "apy": tier["apy"],
        "cost_doge": STAKE_COST_DOGE,
        "status": "pending",
        "payment_provider": "nowpayments",
        "nowpayments_invoice_id": None,
        "nowpayments_invoice_url": None,
        "nowpayments_payment_id": None,
        "staked_at": None,
        "last_claim_at": None,
        "claimed_total": 0,
        "unstaked_at": None,
        "created_at": _utcnow(),
        "updated_at": _utcnow(),
    }
    await db.treat_stakes.insert_one(stake)
    return stake


async def activate_stake(db, stake_id: str, nowpayments_payment_id) -> Optional[dict]:
    """Called from the IPN webhook once NOWPayments reports status=finished."""
    stake = await db.treat_stakes.find_one({"id": stake_id})
    if not stake or stake["status"] != "pending":
        return None
    now = _utcnow()
    await db.treat_stakes.update_one(
        {"id": stake_id},
        {"$set": {
            "status": "active",
            "staked_at": now,
            "last_claim_at": now,
            "payment_confirmed": True,
            "nowpayments_payment_id": nowpayments_payment_id,
            "updated_at": now,
        }}
    )
    return await db.treat_stakes.find_one({"id": stake_id}, {"_id": 0})


async def get_player_stakes(db, player_address: str) -> List[dict]:
    stakes = await db.treat_stakes.find(
        {"player_address": player_address, "status": {"$in": ["pending", "active"]}},
        {"_id": 0}
    ).sort("created_at", 1).to_list(length=MAX_STAKED_TREATS + 5)
    now = _utcnow()
    for s in stakes:
        s["rate_per_min"] = round(_rate_per_second(s) * 60, 4)
        s["accrued_preview"] = round(_preview_accrued(s, now), 4)
    return stakes


async def _claim_internal(db, stake: dict, now: datetime) -> int:
    """Credits whole points earned since last_claim_at, advancing the clock
    only by the time that whole amount represents. Any fractional remainder
    keeps accruing toward the next claim instead of being discarded — so
    claiming often vs. rarely earns the same total, points are an integer
    field on Player, and nothing is ever lost to rounding."""
    if stake.get("status") != "active":
        return 0
    since = _parse_dt(stake.get("last_claim_at") or stake.get("staked_at"))
    if not since:
        return 0
    rate = _rate_per_second(stake)
    if rate <= 0:
        return 0

    elapsed = max(0.0, (now - since).total_seconds())
    whole = int(elapsed * rate)
    if whole <= 0:
        return 0

    time_consumed = whole / rate
    new_since = since + timedelta(seconds=time_consumed)

    await db.treat_stakes.update_one(
        {"id": stake["id"]},
        {"$set": {"last_claim_at": new_since, "updated_at": now}, "$inc": {"claimed_total": whole}}
    )
    await db.players.update_one(
        {"address": stake["player_address"]},
        {"$inc": {"points": whole}}
    )
    return whole


async def claim_stake(db, stake_id: str, player_address: str) -> dict:
    stake = await db.treat_stakes.find_one({"id": stake_id, "player_address": player_address})
    if not stake:
        raise ValueError("stake not found")
    if stake.get("status") != "active":
        raise ValueError("stake is not active")
    claimed = await _claim_internal(db, stake, _utcnow())
    return {"claimed": claimed, "stake_id": stake_id}


async def unstake(db, stake_id: str, player_address: str) -> dict:
    stake = await db.treat_stakes.find_one({"id": stake_id, "player_address": player_address})
    if not stake:
        raise ValueError("stake not found")
    if stake.get("status") not in ("active", "pending"):
        raise ValueError("stake already unstaked")

    now = _utcnow()
    claimed = 0
    if stake["status"] == "active":
        claimed = await _claim_internal(db, stake, now)

    await db.treat_stakes.update_one(
        {"id": stake_id},
        {"$set": {"status": "unstaked", "unstaked_at": now, "updated_at": now}}
    )
    return {"unstaked": True, "final_claim": claimed, "stake_id": stake_id}
