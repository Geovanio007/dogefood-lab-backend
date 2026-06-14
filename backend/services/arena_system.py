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

ENTRY_FEE_POINTS      = 50
ARENA_DURATION_HOURS  = 24
CHAT_COOLDOWN_SECONDS = 3
CHAT_MAX_LENGTH       = 220
PREDICTION_COST       = 20

# Prize pool split percentages by rank (must sum <= 100)
# Remainder after rank 1-5 + range goes to mystery pool
PRIZE_SPLIT = {1: 0.50, 2: 0.20, 3: 0.12, 4: 0.08, 5: 0.05}
PRIZE_RANGE_SHARE  = 0.03   # ranks 6-20 share this slice equally
PRIZE_MYSTERY_PCT  = 0.02   # ~2% split among ~10% random players below rank 20

RANKS_FOR_INGREDIENTS_MIN = 6
RANKS_FOR_INGREDIENTS_MAX = 20

# Heat events — rotate every ~30 minutes
HEAT_EVENTS = [
    {"id": "golden_hour", "name": "Golden Hour",    "blurb": "All point gains x2",              "color": "#facc15", "intensity": "high"},
    {"id": "lab_surge",   "name": "Lab Surge",      "blurb": "Rare ingredient drops active",    "color": "#38bdf8", "intensity": "mid"},
    {"id": "overclock",   "name": "Overclock Mode", "blurb": "Mix timers reduced 50%",          "color": "#fb923c", "intensity": "high"},
    {"id": "crit_state",  "name": "Critical Mix",   "blurb": "Higher rarity odds for 30 min",  "color": "#ec4899", "intensity": "extreme"},
    {"id": "idle_calm",   "name": "Calm Phase",     "blurb": "Standard rates — strategize",    "color": "#94a3b8", "intensity": "low"},
]
HEAT_EVENT_DURATION_MIN = 30

_BANNED_PATTERNS = [re.compile(r"\b(spam|scam|hack)\b", re.IGNORECASE)]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _current_window_start() -> datetime:
    n = _utcnow()
    return n.replace(hour=0, minute=0, second=0, microsecond=0)


def _strip_id(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


def _parse_dt(val) -> datetime:
    """Safely parse a datetime value that may be a string or datetime object."""
    if val is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    if hasattr(val, "timestamp"):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


# ─── Arena lifecycle ────────────────────────────────────────────────────────

async def get_or_create_current_arena(db) -> dict:
    """Returns the active arena document, settling and rolling over if expired.

    Uses an atomic findOneAndUpdate to claim the settle lock so concurrent
    requests cannot double-settle the same arena.
    """
    now = _utcnow()

    # Look for active arena
    active = await db.arena_sessions.find_one({"status": "active"}, {"_id": 0})

    if active:
        ends_at = _parse_dt(active.get("ends_at"))
        if ends_at > now:
            return active   # still running — fast path

        # Expired: atomically claim the settle lock by flipping status to
        # "settling".  Only the request that wins this update proceeds.
        claimed = await db.arena_sessions.find_one_and_update(
            {"id": active["id"], "status": "active"},
            {"$set": {"status": "settling"}},
            return_document=True,
        )
        if claimed:
            # We won the race — do the settle
            await settle_arena(db, active["id"])
        else:
            # Another request is already settling — just wait and fall through
            # to create a new arena below (find_one will return None or settling doc)
            pass

    # No active arena (or we just settled one) — create a fresh one
    # Guard: check again in case another concurrent request already created it
    still_active = await db.arena_sessions.find_one({"status": "active"}, {"_id": 0})
    if still_active:
        return still_active

    started = _current_window_start()
    ends    = started + timedelta(hours=ARENA_DURATION_HOURS)
    arena   = {
        "id":                   str(uuid.uuid4()),
        "started_at":           started.isoformat(),
        "ends_at":              ends.isoformat(),
        "status":               "active",
        "prize_pool":           0,
        "entries_count":        0,
        "heat_event":           _pick_heat_event(started),
        "heat_event_started_at": started.isoformat(),
    }
    await db.arena_sessions.insert_one(dict(arena))
    arena.pop("_id", None)
    return arena


async def settle_arena(db, arena_id: str) -> dict:
    """
    Finalize an arena:
      1. Distribute the actual prize_pool by percentage split (not hardcoded amounts)
      2. Settle pending predictions: rank-1 winner's predictors get 3× payout
      3. Mark arena as 'settled' with ISO timestamp

    The race condition is handled upstream in get_or_create_current_arena via
    the atomic 'settling' status flip — by the time we get here we are the
    only coroutine running this for this arena_id.
    """
    arena = await db.arena_sessions.find_one(
        {"id": arena_id, "status": "settling"}, {"_id": 0}
    )
    if not arena:
        # Already settled or doesn't exist
        return {}

    prize_pool = int(arena.get("prize_pool", 0))

    entries = await db.arena_entries.find(
        {"arena_id": arena_id}, {"_id": 0}
    ).sort("points", -1).to_list(length=10000)

    rewards = []

    if entries:
        # ── Ranked rewards from prize pool ────────────────────────────────
        for idx, entry in enumerate(entries):
            rank = idx + 1
            addr = entry["player_address"]
            reward_pts = 0
            reward_kind = "points"

            if rank in PRIZE_SPLIT and prize_pool > 0:
                reward_pts = max(1, round(prize_pool * PRIZE_SPLIT[rank]))
            elif RANKS_FOR_INGREDIENTS_MIN <= rank <= RANKS_FOR_INGREDIENTS_MAX and prize_pool > 0:
                # Split PRIZE_RANGE_SHARE equally among ranks 6-20
                range_count = RANKS_FOR_INGREDIENTS_MAX - RANKS_FOR_INGREDIENTS_MIN + 1
                reward_pts  = max(1, round(prize_pool * PRIZE_RANGE_SHARE / range_count))
                reward_kind = "points+ingredient"

            if reward_pts > 0:
                await db.players.update_one(
                    {"address": addr},
                    {"$inc": {"points": reward_pts}}
                )
                rewards.append({
                    "address":  addr,
                    "nickname": entry.get("nickname") or "Anonymous",
                    "rank":     rank,
                    "points":   reward_pts,
                    "kind":     reward_kind,
                })

        # ── Mystery drop (~2% of pool to ~10% of lower-ranked players) ───
        mystery_pool_pts = max(0, round(prize_pool * PRIZE_MYSTERY_PCT))
        lower_players    = entries[RANKS_FOR_INGREDIENTS_MAX:]
        if lower_players and mystery_pool_pts > 0:
            mystery_count = max(1, len(lower_players) // 10)
            mystery_per   = max(1, mystery_pool_pts // mystery_count)
            for winner in random.sample(lower_players, min(mystery_count, len(lower_players))):
                await db.players.update_one(
                    {"address": winner["player_address"]},
                    {"$inc": {"points": mystery_per}}
                )
                rewards.append({
                    "address":  winner["player_address"],
                    "nickname": winner.get("nickname") or "Anonymous",
                    "rank":     None,
                    "points":   mystery_per,
                    "kind":     "mystery",
                })

        # ── Settle predictions ────────────────────────────────────────────
        winner_addr = entries[0]["player_address"]
        preds = await db.arena_predictions.find(
            {"arena_id": arena_id, "status": "pending"}, {"_id": 0}
        ).to_list(length=10000)

        for p in preds:
            won    = p["target_address"] == winner_addr
            payout = p["cost"] * 3 if won else 0
            if payout:
                await db.players.update_one(
                    {"address": p["predictor_address"]},
                    {"$inc": {"points": payout}}
                )
                # Activity feed — prediction win
                try:
                    _pred_player = await db.players.find_one(
                        {"address": p["predictor_address"]}, {"_id": 0, "nickname": 1}
                    )
                    _pred_nick = (_pred_player or {}).get("nickname") or "Anonymous"
                    await db.activity_feed.insert_one({
                        "id":              str(uuid.uuid4()),
                        "activity_type":   "arena_prediction",
                        "type":            "arena_prediction",
                        "player_address":  p["predictor_address"],
                        "player_nickname": _pred_nick,
                        "treat_name":      f"🔮 Prediction Win +{payout} pts",
                        "prize_label":     f"Prediction Win +{payout} pts",
                        "points_reward":   payout,
                        "xp_reward":       0,
                        "rarity":          None,
                        "emoji":           "crystal_ball",
                        "created_at":      _utcnow().isoformat(),
                    })
                except Exception:
                    pass

            await db.arena_predictions.update_one(
                {"id": p["id"]},
                {"$set": {
                    "status":      "won" if won else "lost",
                    "payout":      payout,
                    "settled_at":  _utcnow().isoformat(),
                }}
            )

        # ── Activity feed — single summary entry for the whole settlement ──
        # Writing one entry per ranked player floods the feed every cycle.
        # Instead write one summary showing the winner and total rewarded.
        try:
            if rewards:
                winner_reward = next((r for r in rewards if r.get("rank") == 1), rewards[0])
                total_rewarded = sum(r["points"] for r in rewards)
                await db.activity_feed.insert_one({
                    "id":              str(uuid.uuid4()),
                    "activity_type":   "arena_settled",
                    "type":            "arena_settled",
                    "player_address":  winner_reward["address"],
                    "player_nickname": winner_reward.get("nickname") or "Anonymous",
                    "treat_name":      f"🏆 Arena Settled — {winner_reward.get('nickname') or 'Anonymous'} wins!",
                    "prize_label":     f"Arena Winner +{winner_reward['points']} pts",
                    "points_reward":   winner_reward["points"],
                    "xp_reward":       0,
                    "rarity":          None,
                    "emoji":           "trophy",
                    "participants":    len(entries),
                    "total_rewarded":  total_rewarded,
                    "created_at":      _utcnow().isoformat(),
                })
        except Exception:
            pass

    # ── Mark settled ──────────────────────────────────────────────────────
    await db.arena_sessions.update_one(
        {"id": arena_id},
        {"$set": {
            "status":         "settled",
            "settled_at":     _utcnow().isoformat(),
            "winner_address": entries[0]["player_address"] if entries else None,
            "final_rewards":  rewards,
            "prize_pool_paid": prize_pool,
        }}
    )
    result = await db.arena_sessions.find_one({"id": arena_id}, {"_id": 0})
    return result or {}


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
        "id":            str(uuid.uuid4()),
        "arena_id":      arena["id"],
        "player_address": player_address,
        "nickname":      nickname or player.get("nickname") or "Anonymous",
        "points":        0,
        "points_at_join": player.get("points", 0) - ENTRY_FEE_POINTS,
        "win_streak":    0,
        "is_streaming":  False,
        "joined_at":     _utcnow().isoformat(),
        "last_active_at": _utcnow().isoformat(),
    }
    await db.arena_entries.insert_one(dict(entry))

    await db.arena_sessions.update_one(
        {"id": arena["id"]},
        {"$inc": {"prize_pool": ENTRY_FEE_POINTS, "entries_count": 1}}
    )

    arena = await db.arena_sessions.find_one({"id": arena["id"]}, {"_id": 0})
    return {"arena": arena, "entry": entry, "already_joined": False}


async def credit_arena_score(db, player_address: str, points_delta: int, treat_rarity: Optional[str] = None) -> None:
    """Called by treat collection flow to credit arena score."""
    arena = await db.arena_sessions.find_one({"status": "active"}, {"_id": 0})
    if not arena:
        return
    update = {"$inc": {"points": points_delta}, "$set": {"last_active_at": _utcnow().isoformat()}}
    if treat_rarity and treat_rarity.lower() in ("legendary", "mythic"):
        update["$inc"]["win_streak"] = 1
    await db.arena_entries.update_one(
        {"arena_id": arena["id"], "player_address": player_address},
        update
    )


async def get_leaderboard(db, limit: int = 50) -> dict:
    arena = await get_or_create_current_arena(db)
    cursor = db.arena_entries.find(
        {"arena_id": arena["id"]}, {"_id": 0}
    ).sort("points", -1).limit(limit)
    entries = await cursor.to_list(length=limit)
    ranked  = [{**e, "rank": idx + 1} for idx, e in enumerate(entries)]
    top     = ranked[0] if ranked else None
    return {
        "arena":   arena,
        "top":     top,
        "entries": ranked,
        "now":     _utcnow().isoformat(),
    }


# ─── Heat events ────────────────────────────────────────────────────────────

def _pick_heat_event(seed_dt: datetime) -> dict:
    rng = random.Random(int(seed_dt.timestamp()) // (HEAT_EVENT_DURATION_MIN * 60))
    return rng.choice(HEAT_EVENTS)


async def get_or_rotate_heat_event(db) -> dict:
    arena = await get_or_create_current_arena(db)
    started = _parse_dt(arena.get("heat_event_started_at") or arena["started_at"])
    elapsed_min = (_utcnow() - started).total_seconds() / 60.0
    if elapsed_min >= HEAT_EVENT_DURATION_MIN:
        new_event = _pick_heat_event(_utcnow())
        new_start = _utcnow()
        await db.arena_sessions.update_one(
            {"id": arena["id"]},
            {"$set": {"heat_event": new_event, "heat_event_started_at": new_start.isoformat()}}
        )
        arena["heat_event"]            = new_event
        arena["heat_event_started_at"] = new_start.isoformat()
        started                        = new_start
    return {
        "event":        arena["heat_event"],
        "started_at":   started.isoformat() if hasattr(started, "isoformat") else str(started),
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
    text  = _sanitize_chat(text)
    if not text:
        raise ValueError("empty message")

    last = await db.arena_chat.find_one(
        {"arena_id": arena["id"], "player_address": player_address},
        sort=[("created_at", -1)],
        projection={"_id": 0, "created_at": 1}
    )
    if last:
        last_dt = _parse_dt(last["created_at"])
        if (_utcnow() - last_dt).total_seconds() < CHAT_COOLDOWN_SECONDS:
            raise ValueError(f"slow down — wait {CHAT_COOLDOWN_SECONDS}s between messages")

    entry = await db.arena_entries.find_one(
        {"arena_id": arena["id"], "player_address": player_address},
        {"_id": 0, "points": 1}
    )
    badge = "competitor" if entry else "spectator"

    msg = {
        "id":             str(uuid.uuid4()),
        "arena_id":       arena["id"],
        "player_address": player_address,
        "nickname":       nickname or "Anonymous",
        "badge":          badge,
        "text":           text,
        "created_at":     _utcnow().isoformat(),
    }
    await db.arena_chat.insert_one(dict(msg))
    msg.pop("_id", None)
    return msg


async def get_chat(db, limit: int = 40) -> List[dict]:
    arena  = await get_or_create_current_arena(db)
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
        "id":                str(uuid.uuid4()),
        "arena_id":          arena["id"],
        "predictor_address": predictor_address,
        "target_address":    target_address,
        "cost":              PREDICTION_COST,
        "payout_multiplier": 3,
        "status":            "pending",
        "created_at":        _utcnow().isoformat(),
    }
    await db.arena_predictions.insert_one(dict(pred))
    pred.pop("_id", None)
    return pred


async def get_user_prediction(db, predictor_address: str) -> Optional[dict]:
    arena = await db.arena_sessions.find_one({"status": "active"}, {"_id": 0})
    if not arena:
        return None
    return await db.arena_predictions.find_one(
        {"arena_id": arena["id"], "predictor_address": predictor_address},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    
