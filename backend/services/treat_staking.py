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
DAY_SECONDS = 24 * 3600

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

# Loyalty bonus: the longer a treat has been continuously staked (measured
# from the original staked_at — individual claims don't reset it), the
# bigger the bonus on every future claim from that stake. Always-on, unlike
# Happy Hour / Golden Hour which are time-window bonuses (see below).
# (days, bonus_percent) — checked longest-first.
LOYALTY_TIERS = [
    (90, 0.35),
    (30, 0.20),
    (7,  0.10),
    (1,  0.05),
    (0,  0.0),
]


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


def get_loyalty_bonus_percent(staked_days: float) -> float:
    for threshold_days, bonus in LOYALTY_TIERS:
        if staked_days >= threshold_days:
            return bonus
    return 0.0


def _base_rate_per_second(stake: dict) -> float:
    principal = stake.get("principal", DEFAULT_TIER["principal"])
    apy = stake.get("apy", DEFAULT_TIER["apy"])
    return (principal * apy) / YEAR_SECONDS


def _loyalty_info(stake: dict, now: datetime) -> dict:
    staked_at = _parse_dt(stake.get("staked_at"))
    staked_days = max(0.0, (now - staked_at).total_seconds() / DAY_SECONDS) if staked_at else 0.0
    percent = get_loyalty_bonus_percent(staked_days)
    next_threshold = next((d for d, _ in reversed(LOYALTY_TIERS) if d > staked_days), None)
    return {
        "percent": percent,
        "staked_days": round(staked_days, 2),
        "days_to_next_tier": round(next_threshold - staked_days, 2) if next_threshold is not None else None,
    }


def _effective_rate_per_second(stake: dict, now: datetime, happy_hour_bonus_percent: float, golden_hour_active: bool) -> float:
    """Base rarity rate, boosted by the always-on loyalty bonus plus whichever
    time-window bonuses are currently active. Used for both the live-preview
    ticker and the rate_per_min the UI displays, so what a player sees ticking
    up matches what an actual claim would apply right now."""
    rate = _base_rate_per_second(stake)
    rate *= (1 + _loyalty_info(stake, now)["percent"])
    if happy_hour_bonus_percent:
        rate *= (1 + happy_hour_bonus_percent)
    if golden_hour_active:
        rate *= 2
    return rate


def _preview_accrued(stake: dict, now: datetime, happy_hour_bonus_percent: float = 0.0, golden_hour_active: bool = False) -> float:
    """Live estimate for display only (fractional) — not what actually gets
    credited. See _claim_internal for the real, whole-point-safe credit."""
    if stake.get("status") != "active":
        return 0.0
    since = _parse_dt(stake.get("last_claim_at") or stake.get("staked_at"))
    if not since:
        return 0.0
    elapsed = max(0.0, (now - since).total_seconds())
    return _effective_rate_per_second(stake, now, happy_hour_bonus_percent, golden_hour_active) * elapsed


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


async def get_player_stakes(db, player_address: str, happy_hour_bonus_percent: float = 0.0, golden_hour_active: bool = False) -> List[dict]:
    stakes = await db.treat_stakes.find(
        {"player_address": player_address, "status": {"$in": ["pending", "active"]}},
        {"_id": 0}
    ).sort("created_at", 1).to_list(length=MAX_STAKED_TREATS + 5)
    now = _utcnow()
    for s in stakes:
        if s.get("status") == "active":
            loyalty = _loyalty_info(s, now)
            s["loyalty_bonus_percent"] = round(loyalty["percent"] * 100, 1)
            s["staked_days"] = loyalty["staked_days"]
            s["days_to_next_loyalty_tier"] = loyalty["days_to_next_tier"]
        s["happy_hour_active"] = bool(happy_hour_bonus_percent)
        s["golden_hour_active"] = golden_hour_active
        # rate_per_min / accrued_preview are bonus-inclusive: loyalty always,
        # Happy Hour / Golden Hour only while actually active right now.
        s["rate_per_min"] = round(_effective_rate_per_second(s, now, happy_hour_bonus_percent, golden_hour_active) * 60, 4)
        s["accrued_preview"] = round(_preview_accrued(s, now, happy_hour_bonus_percent, golden_hour_active), 4)
    return stakes


_EMPTY_CLAIM = {"base": 0, "loyalty_bonus": 0, "happy_hour_bonus": 0, "golden_hour_bonus": 0, "total": 0}


async def _claim_internal(db, stake: dict, now: datetime, happy_hour_bonus_percent: float = 0.0, golden_hour_active: bool = False) -> dict:
    """Credits points earned since last_claim_at, then layers bonuses on top
    of that base amount. The accrual clock only ever advances by the time the
    BASE (pre-bonus) amount represents — bonuses add points without touching
    the clock, so nothing is ever lost to rounding regardless of claim
    frequency or which bonuses happened to be active.

    Bonus order matches how collect_treat applies these same two bonuses to
    treat-collection rewards, for consistency: loyalty and Happy Hour add a
    percentage, then Golden Hour doubles the running total."""
    if stake.get("status") != "active":
        return dict(_EMPTY_CLAIM)
    since = _parse_dt(stake.get("last_claim_at") or stake.get("staked_at"))
    if not since:
        return dict(_EMPTY_CLAIM)
    rate = _base_rate_per_second(stake)
    if rate <= 0:
        return dict(_EMPTY_CLAIM)

    elapsed = max(0.0, (now - since).total_seconds())
    base = int(elapsed * rate)
    if base <= 0:
        return dict(_EMPTY_CLAIM)

    # Advance the clock only by the time the BASE amount represents.
    time_consumed = base / rate
    new_since = since + timedelta(seconds=time_consumed)

    loyalty_pct = _loyalty_info(stake, now)["percent"]
    loyalty_bonus = int(base * loyalty_pct)

    running = base + loyalty_bonus
    happy_hour_bonus = int(running * happy_hour_bonus_percent) if happy_hour_bonus_percent else 0
    running += happy_hour_bonus

    golden_hour_bonus = running if golden_hour_active else 0
    running += golden_hour_bonus

    total = running

    await db.treat_stakes.update_one(
        {"id": stake["id"]},
        {"$set": {"last_claim_at": new_since, "updated_at": now}, "$inc": {"claimed_total": total}}
    )
    await db.players.update_one(
        {"address": stake["player_address"]},
        {"$inc": {"points": total}}
    )
    return {"base": base, "loyalty_bonus": loyalty_bonus, "happy_hour_bonus": happy_hour_bonus,
            "golden_hour_bonus": golden_hour_bonus, "total": total}


async def claim_stake(db, stake_id: str, player_address: str, happy_hour_bonus_percent: float = 0.0, golden_hour_active: bool = False) -> dict:
    stake = await db.treat_stakes.find_one({"id": stake_id, "player_address": player_address})
    if not stake:
        raise ValueError("stake not found")
    if stake.get("status") != "active":
        raise ValueError("stake is not active")
    result = await _claim_internal(db, stake, _utcnow(), happy_hour_bonus_percent, golden_hour_active)
    return {**result, "stake_id": stake_id}


async def unstake(db, stake_id: str, player_address: str, happy_hour_bonus_percent: float = 0.0, golden_hour_active: bool = False) -> dict:
    stake = await db.treat_stakes.find_one({"id": stake_id, "player_address": player_address})
    if not stake:
        raise ValueError("stake not found")
    if stake.get("status") not in ("active", "pending"):
        raise ValueError("stake already unstaked")

    now = _utcnow()
    claim_result = dict(_EMPTY_CLAIM)
    if stake["status"] == "active":
        claim_result = await _claim_internal(db, stake, now, happy_hour_bonus_percent, golden_hour_active)

    await db.treat_stakes.update_one(
        {"id": stake_id},
        {"$set": {"status": "unstaked", "unstaked_at": now, "updated_at": now}}
    )
    return {"unstaked": True, "final_claim": claim_result, "stake_id": stake_id}
