"""
DogeFood Lab — Lab Arena System (Phase 1)
24h rolling arena with leaderboard, entry fees, prize pool, chat, predictions,
and "Heat Events". No streaming yet (Phase 2).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict
import uuid
import random
import re

ENTRY_FEE_POINTS = 50
ARENA_DURATION_HOURS = 24
CHAT_COOLDOWN_SECONDS = 3
CHAT_MAX_LENGTH = 220
PREDICTION_COST = 20

# Reward structure (in points). Mystery drop fires for ~10% of remaining entrants.
REWARDS_BY_RANK = {1: 420, 2: 250, 3: 150, 4: 100, 5: 75}
RANKS_FOR_INGREDIENTS_MIN = 6
RANKS_FOR_INGREDIENTS_MAX = 20

# Heat events — rotate every ~30 minutes
HEAT_EVENTS = [
    {"id": "golden_hour",  "name": "Golden Hour",   "blurb": "All point gains x2", "color": "#facc15", "intensity": "high"},
    {"id": "lab_surge",    "name": "Lab Surge",     "blurb": "Rare ingredient drops active", "color": "#38bdf8", "intensity": "mid"},
    {"id": "overclock",    "name": "Overclock Mode","blurb": "Mix timers reduced 50%", "color": "#fb923c", "intensity": "high"},
    {"id": "crit_state",   "name": "Critical Mix",  "blurb": "Higher rarity odds for 30 min", "color": "#ec4899", "intensity": "extreme"},
    {"id": "idle_calm",    "name": "Calm Phase",    "blurb": "Standard rates — strategize", "color": "#94a3b8", "intensity": "low"},
]
HEAT_EVENT_DURATION_MIN = 30

# Anti-spam profanity stub (extend as needed)
_BANNED_PATTERNS = [re.compile(r"\b(spam|scam|hack)\b", re.IGNORECASE)]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _current_window_start() -> datetime:
    """Round to the most recent 24h UTC boundary so arenas always reset on the hour 00:00 UTC."""
    n = _utcnow()
    return n.replace(hour=0, minute=0, second=0, microsecond=0)


def _strip_id(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


# ─── Arena lifecycle ────────────────────────────────────────────────────────

async def get_or_create_current_arena(db) -> dict:
    """Returns the active arena document. If the previous one expired, settles it
    and creates a fresh one (lazy reset — no scheduler required)."""
    now = _utcnow()
    active = await db.arena_sessions.find_one({"status": "active"}, {"_id": 0})

    if active:
        ends_at = active["ends_at"]
        if isinstance(ends_at, str):
            ends_at = datetime.fromisoformat(ends_at.replace("Z", "+00:00"))
        if ends_at.tzinfo is None:
            ends_at = ends_at.replace(tzinfo=timezone.utc)
        if ends_at > now:
            return active
        # expired — settle and roll
        await settle_arena(db, active["id"])

    started = _current_window_start()
    ends = started + timedelta(hours=ARENA_DURATION_HOURS)
    arena = {
        "id": str(uuid.uuid4()),
        "started_at": started,
        "ends_at": ends,
        "status": "active",
        "prize_pool": 0,
        "entries_count": 0,
        "heat_event": _pick_heat_event(started),
        "heat_event_started_at": started,
    }
    await db.arena_sessions.insert_one(dict(arena))
    return _strip_id(arena)


async def settle_arena(db, arena_id: str) -> dict:
    """Finalize an arena: rank entries, distribute rewards, mark settled."""
    arena = await db.arena_sessions.find_one({"id": arena_id}, {"_id": 0})
    if not arena or arena.get("status") == "settled":
        return arena or {}

    entries = await db.arena_entries.find(
        {"arena_id": arena_id}, {"_id": 0}
    ).sort("points", -1).to_list(length=10000)

    rewards = []
    for idx, entry in enumerate(entries):
        rank = idx + 1
        reward_points = REWARDS_BY_RANK.get(rank, 0)
        reward_kind = "points"
        if rank >= RANKS_FOR_INGREDIENTS_MIN and rank <= RANKS_FOR_INGREDIENTS_MAX:
            reward_points = 35
            reward_kind = "points+ingredient"
        if reward_points:
            rewards.append({
                "address": entry["player_address"],
                "nickname": entry.get("nickname"),
                "rank": rank,
                "points": reward_points,
                "kind": reward_kind,
            })
            # Credit points to the player
            await db.players.update_one(
                {"address": entry["player_address"]},
                {"$inc": {"points": reward_points}}
            )

    # Mystery drop on ~10% random surviving entrants below top 20
    pool = entries[RANKS_FOR_INGREDIENTS_MAX:]
    if pool:
        mystery_count = max(1, len(pool) // 10)
        for winner in random.sample(pool, min(mystery_count, len(pool))):
            await db.players.update_one(
                {"address": winner["player_address"]},
                {"$inc": {"points": 20}}
            )
            rewards.append({
                "address": winner["player_address"],
                "nickname": winner.get("nickname"),
                "rank": None,
                "points": 20,
                "kind": "mystery",
            })

    # Settle predictions: anyone who picked the rank-1 winner gets 3x payout
    winner_addr = entries[0]["player_address"] if entries else None
    preds = await db.arena_predictions.find(
        {"arena_id": arena_id, "status": "pending"}, {"_id": 0}
    ).to_list(length=10000)
    for p in preds:
        won = winner_addr and p["target_address"] == winner_addr
        payout = p["cost"] * 3 if won else 0
        if payout:
            await db.players.update_one(
                {"address": p["predictor_address"]},
                {"$inc": {"points": payout}}
            )
        await db.arena_predictions.update_one(
            {"id": p["id"]},
            {"$set": {"status": "won" if won else "lost", "payout": payout}}
        )

    await db.arena_sessions.update_one(
        {"id": arena_id},
        {"$set": {"status": "settled", "settled_at": _utcnow(), "final_rewards": rewards}}
    )
    return await db.arena_sessions.find_one({"id": arena_id}, {"_id": 0})


# ─── Entries / leaderboard ──────────────────────────────────────────────────

async def join_arena(db, player_address: str, nickname: Optional[str]) -> dict:
    """Deducts ENTRY_FEE_POINTS from the player and creates/returns their entry."""
    if not player_address:
        raise ValueError("player_address required")

    arena = await get_or_create_current_arena(db)
    existing = await db.arena_entries.find_one(
        {"arena_id": arena["id"], "player_address": player_address}, {"_id": 0}
    )
    if existing:
        return {"arena": arena, "entry": existing, "already_joined": True}

    player = await db.players.find_one({"address": player_address}, {"_id": 0})
    if not player:
        raise ValueError("player not found")
    if player.get("points", 0) < ENTRY_FEE_POINTS:
        raise ValueError(f"need {ENTRY_FEE_POINTS} points to enter the arena")

    await db.players.update_one(
        {"address": player_address},
        {"$inc": {"points": -ENTRY_FEE_POINTS}}
    )

    entry = {
        "id": str(uuid.uuid4()),
        "arena_id": arena["id"],
        "player_address": player_address,
        "nickname": nickname or player.get("nickname") or player_address[:8],
        "points": 0,
        "win_streak": 0,
        "is_streaming": False,
        "joined_at": _utcnow(),
        "last_active_at": _utcnow(),
    }
    await db.arena_entries.insert_one(dict(entry))

    await db.arena_sessions.update_one(
        {"id": arena["id"]},
        {"$inc": {"prize_pool": ENTRY_FEE_POINTS, "entries_count": 1}}
    )

    arena = await db.arena_sessions.find_one({"id": arena["id"]}, {"_id": 0})
    return {"arena": arena, "entry": entry, "already_joined": False}


async def credit_arena_score(db, player_address: str, points_delta: int, treat_rarity: Optional[str] = None) -> None:
    """Called by treat creation flow when a player mints a treat — auto-credits arena score."""
    arena = await db.arena_sessions.find_one({"status": "active"}, {"_id": 0})
    if not arena:
        return
    update = {"$inc": {"points": points_delta}, "$set": {"last_active_at": _utcnow()}}
    if treat_rarity and treat_rarity.lower() in ("legendary", "mythic"):
        update["$inc"]["win_streak"] = 1
    res = await db.arena_entries.update_one(
        {"arena_id": arena["id"], "player_address": player_address},
        update
    )
    if res.matched_count == 0:
        # player isn't in the arena; nothing to do
        return


async def get_leaderboard(db, limit: int = 50) -> dict:
    arena = await get_or_create_current_arena(db)
    cursor = db.arena_entries.find(
        {"arena_id": arena["id"]}, {"_id": 0}
    ).sort("points", -1).limit(limit)
    entries = await cursor.to_list(length=limit)
    ranked = [
        {**e, "rank": idx + 1}
        for idx, e in enumerate(entries)
    ]
    top = ranked[0] if ranked else None
    return {
        "arena": arena,
        "top": top,
        "entries": ranked,
        "now": _utcnow().isoformat(),
    }


# ─── Heat events ────────────────────────────────────────────────────────────

def _pick_heat_event(seed_dt: datetime) -> dict:
    rng = random.Random(int(seed_dt.timestamp()) // (HEAT_EVENT_DURATION_MIN * 60))
    return rng.choice(HEAT_EVENTS)


async def get_or_rotate_heat_event(db) -> dict:
    arena = await get_or_create_current_arena(db)
    started = arena.get("heat_event_started_at") or arena["started_at"]
    if isinstance(started, str):
        started = datetime.fromisoformat(started.replace("Z", "+00:00"))
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    elapsed_min = (_utcnow() - started).total_seconds() / 60.0
    if elapsed_min >= HEAT_EVENT_DURATION_MIN:
        new_event = _pick_heat_event(_utcnow())
        new_start = _utcnow()
        await db.arena_sessions.update_one(
            {"id": arena["id"]},
            {"$set": {"heat_event": new_event, "heat_event_started_at": new_start}}
        )
        arena["heat_event"] = new_event
        arena["heat_event_started_at"] = new_start
        started = new_start
    return {
        "event": arena["heat_event"],
        "started_at": started.isoformat(),
        "duration_min": HEAT_EVENT_DURATION_MIN,
    }


# ─── Chat ───────────────────────────────────────────────────────────────────

def _sanitize_chat(text: str) -> str:
    text = text.strip()[:CHAT_MAX_LENGTH]
    for pat in _BANNED_PATTERNS:
        text = pat.sub("***", text)
    return text


async def post_chat(db, player_address: str, nickname: str, text: str) -> dict:
    arena = await get_or_create_current_arena(db)
    text = _sanitize_chat(text)
    if not text:
        raise ValueError("empty message")

    last = await db.arena_chat.find_one(
        {"arena_id": arena["id"], "player_address": player_address},
        sort=[("created_at", -1)],
        projection={"_id": 0, "created_at": 1}
    )
    if last:
        last_dt = last["created_at"]
        if isinstance(last_dt, str):
            last_dt = datetime.fromisoformat(last_dt.replace("Z", "+00:00"))
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        if (_utcnow() - last_dt).total_seconds() < CHAT_COOLDOWN_SECONDS:
            raise ValueError(f"slow down — wait {CHAT_COOLDOWN_SECONDS}s between messages")

    # Optional rank badge
    entry = await db.arena_entries.find_one(
        {"arena_id": arena["id"], "player_address": player_address},
        {"_id": 0, "points": 1}
    )
    badge = "competitor" if entry else "spectator"

    msg = {
        "id": str(uuid.uuid4()),
        "arena_id": arena["id"],
        "player_address": player_address,
        "nickname": nickname or player_address[:8],
        "badge": badge,
        "text": text,
        "created_at": _utcnow(),
    }
    await db.arena_chat.insert_one(dict(msg))
    return msg


async def get_chat(db, limit: int = 40) -> List[dict]:
    arena = await get_or_create_current_arena(db)
    cursor = db.arena_chat.find(
        {"arena_id": arena["id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(limit)
    msgs = await cursor.to_list(length=limit)
    return list(reversed(msgs))


# ─── Predictions ────────────────────────────────────────────────────────────

async def place_prediction(db, predictor_address: str, target_address: str) -> dict:
    if predictor_address == target_address:
        raise ValueError("cannot predict yourself")
    arena = await get_or_create_current_arena(db)

    existing = await db.arena_predictions.find_one(
        {"arena_id": arena["id"], "predictor_address": predictor_address, "status": "pending"},
        {"_id": 0}
    )
    if existing:
        raise ValueError("you already have an active prediction this arena")

    player = await db.players.find_one({"address": predictor_address}, {"_id": 0})
    if not player:
        raise ValueError("player not found")
    if player.get("points", 0) < PREDICTION_COST:
        raise ValueError(f"need {PREDICTION_COST} points to predict")

    await db.players.update_one(
        {"address": predictor_address},
        {"$inc": {"points": -PREDICTION_COST}}
    )

    pred = {
        "id": str(uuid.uuid4()),
        "arena_id": arena["id"],
        "predictor_address": predictor_address,
        "target_address": target_address,
        "cost": PREDICTION_COST,
        "payout_multiplier": 3,
        "status": "pending",
        "created_at": _utcnow(),
    }
    await db.arena_predictions.insert_one(dict(pred))
    return pred


async def get_user_prediction(db, predictor_address: str) -> Optional[dict]:
    arena = await db.arena_sessions.find_one({"status": "active"}, {"_id": 0})
    if not arena:
        return None
    return await db.arena_predictions.find_one(
        {"arena_id": arena["id"], "predictor_address": predictor_address},
        {"_id": 0}
    )
