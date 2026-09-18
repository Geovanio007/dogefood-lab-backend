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
import asyncio
import logging

logger = logging.getLogger(__name__)

ENTRY_FEE_POINTS = 50
ARENA_DURATION_HOURS = 24
CHAT_COOLDOWN_SECONDS = 3
CHAT_MAX_LENGTH = 220
PREDICTION_COST = 20

# Duel system — power_score is a combat rating built from an entrant's treat
# rarity mix during the current arena window. Rarity weights mirror the
# frontend's RARITY_XP scale (ShibaGrowth.jsx) so "power" tracks the same
# sense of rarity the player already sees on their Shiba.
RARITY_POWER = {"Common": 5, "Uncommon": 12, "Rare": 25, "Epic": 50, "Legendary": 100, "Mythic": 200}
DUEL_TICKETS_PER_DAY = 5
DUEL_WIN_POINTS = 15
DUEL_LOSS_POINTS = 3
DUEL_WIN_PROB_FLOOR = 0.15   # even a big underdog keeps a real shot
DUEL_WIN_PROB_CEIL = 0.85    # even a big favorite can be upset
DUEL_LOG_MAX = 20            # entries kept per player, newest last

# Reward structure (in points). Mystery drop fires for ~10% of remaining entrants.
REWARDS_BY_RANK = {1: 420, 2: 250, 3: 150, 4: 100, 5: 75}
RANKS_FOR_INGREDIENTS_MIN = 6
RANKS_FOR_INGREDIENTS_MAX = 20

# Divisions — a persistent, cross-arena rating (players.arena_trophies) that
# never resets with the daily 24h arena window. Each arena's rewards are now
# distributed WITHIN each division rather than one global top-20, so a newer
# player in Pup League has real winners' odds instead of always racing whales
# in Mythic League for the same 5 slots. Names mirror the existing Shiba
# growth-stage art (ShibaGrowth.jsx) for a consistent theme.
DIVISIONS = [
    {"id": "pup",    "name": "Pup League",    "min_trophies": 0,    "emoji": "\U0001F43E", "color": "#94a3b8"},
    {"id": "shiba",  "name": "Shiba League",  "min_trophies": 300,  "emoji": "\U0001F9B4", "color": "#38bdf8"},
    {"id": "alpha",  "name": "Alpha League",  "min_trophies": 1000, "emoji": "\u26A1",      "color": "#a78bfa"},
    {"id": "mythic", "name": "Mythic League", "min_trophies": 2500, "emoji": "\U0001F451", "color": "#facc15"},
]
# Lower divisions pay a smaller slice of the full-pool reward table so total
# payout stays bounded even though 4 divisions now pay out instead of 1.
# Tune these once real entry-fee volume per division is known.
DIVISION_REWARD_SCALE = {"mythic": 1.0, "alpha": 0.6, "shiba": 0.35, "pup": 0.2}
DIVISION_CONSOLATION_BASE = 35
DIVISION_MYSTERY_BASE = 20

TROPHIES_DUEL_WIN = 8
TROPHIES_DUEL_LOSS = 2
TROPHIES_PARTICIPATION = 1        # awarded once at settlement just for having joined
TROPHIES_PER_REWARD_POINT = 0.12  # settlement cash rewards convert partially to trophies

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


def _today_str() -> str:
    return _utcnow().strftime("%Y-%m-%d")


def _parse_dt(value) -> datetime:
    """Coerce a stored datetime (or ISO string) to an aware UTC datetime."""
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value


def _current_window_start() -> datetime:
    """Round to the most recent 24h UTC boundary so arenas always reset on the hour 00:00 UTC."""
    n = _utcnow()
    return n.replace(hour=0, minute=0, second=0, microsecond=0)


def _strip_id(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


def get_division(trophies: int) -> dict:
    """Highest division whose min_trophies threshold the player has cleared."""
    chosen = DIVISIONS[0]
    for d in DIVISIONS:
        if trophies >= d["min_trophies"]:
            chosen = d
    return chosen


def _next_division(current_id: str) -> Optional[dict]:
    idx = next((i for i, d in enumerate(DIVISIONS) if d["id"] == current_id), None)
    if idx is None or idx + 1 >= len(DIVISIONS):
        return None
    return DIVISIONS[idx + 1]


async def _trophies_by_address(db, addresses: List[str]) -> Dict[str, int]:
    if not addresses:
        return {}
    players_list = await db.players.find(
        {"address": {"$in": addresses}}, {"_id": 0, "address": 1, "arena_trophies": 1}
    ).to_list(length=len(addresses))
    return {p["address"]: p.get("arena_trophies", 0) for p in players_list}


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
    """Finalize an arena: rank entries WITHIN each player's trophy division,
    distribute rewards, award trophies (which carry over to the next arena),
    and mark settled."""
    arena = await db.arena_sessions.find_one({"id": arena_id}, {"_id": 0})
    if not arena or arena.get("status") == "settled":
        return arena or {}

    entries = await db.arena_entries.find(
        {"arena_id": arena_id}, {"_id": 0}
    ).sort("points", -1).to_list(length=10000)

    if not entries:
        await db.arena_sessions.update_one(
            {"id": arena_id},
            {"$set": {"status": "settled", "settled_at": _utcnow(), "final_rewards": []}}
        )
        return await db.arena_sessions.find_one({"id": arena_id}, {"_id": 0})

    trophies_by_addr = await _trophies_by_address(db, [e["player_address"] for e in entries])

    # Bucket by division. `entries` is already points-sorted, so each bucket
    # comes out points-sorted too — no re-sort needed.
    buckets: Dict[str, list] = {}
    for e in entries:
        division_id = get_division(trophies_by_addr.get(e["player_address"], 0))["id"]
        buckets.setdefault(division_id, []).append(e)

    rewards = []
    rewarded_addrs = set()

    for division_id, group in buckets.items():
        scale = DIVISION_REWARD_SCALE.get(division_id, 0.2)
        for idx, entry in enumerate(group):
            rank = idx + 1
            reward_points = round(REWARDS_BY_RANK.get(rank, 0) * scale)
            reward_kind = "points"
            if RANKS_FOR_INGREDIENTS_MIN <= rank <= RANKS_FOR_INGREDIENTS_MAX:
                reward_points = max(10, round(DIVISION_CONSOLATION_BASE * scale))
                reward_kind = "points+ingredient"
            if reward_points:
                trophy_gain = max(1, round(reward_points * TROPHIES_PER_REWARD_POINT))
                await db.players.update_one(
                    {"address": entry["player_address"]},
                    {"$inc": {"points": reward_points, "arena_trophies": trophy_gain}}
                )
                rewards.append({
                    "address": entry["player_address"],
                    "nickname": entry.get("nickname"),
                    "rank": rank,
                    "division": division_id,
                    "points": reward_points,
                    "trophies": trophy_gain,
                    "kind": reward_kind,
                })
                rewarded_addrs.add(entry["player_address"])

        # Mystery drop within this division's unrewarded tail
        tail = group[RANKS_FOR_INGREDIENTS_MAX:]
        if tail:
            mystery_count = max(1, len(tail) // 10)
            for winner in random.sample(tail, min(mystery_count, len(tail))):
                mystery_points = max(5, round(DIVISION_MYSTERY_BASE * scale))
                await db.players.update_one(
                    {"address": winner["player_address"]},
                    {"$inc": {"points": mystery_points, "arena_trophies": 2}}
                )
                rewards.append({
                    "address": winner["player_address"],
                    "nickname": winner.get("nickname"),
                    "rank": None,
                    "division": division_id,
                    "points": mystery_points,
                    "trophies": 2,
                    "kind": "mystery",
                })
                rewarded_addrs.add(winner["player_address"])

    # Everyone else still gets a small trophy for showing up — keeps daily
    # participation worth something even on a bad-luck day.
    unrewarded = [e["player_address"] for e in entries if e["player_address"] not in rewarded_addrs]
    if unrewarded:
        await db.players.update_many(
            {"address": {"$in": unrewarded}},
            {"$inc": {"arena_trophies": TROPHIES_PARTICIPATION}}
        )

    # Predictions stay global — it's bragging rights on the arena's outright #1.
    winner_addr = entries[0]["player_address"]
    preds = await db.arena_predictions.find(
        {"arena_id": arena_id, "status": "pending"}, {"_id": 0}
    ).to_list(length=10000)
    for p in preds:
        won = p["target_address"] == winner_addr
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
        # Duel system
        "power_score": 0,
        "duel_wins": 0,
        "duel_losses": 0,
        "duel_streak": 0,
        "duel_tickets_used": 0,
        "duel_tickets_date": _today_str(),
        "duel_log": [],
    }
    await db.arena_entries.insert_one(dict(entry))

    await db.arena_sessions.update_one(
        {"id": arena["id"]},
        {"$inc": {"prize_pool": ENTRY_FEE_POINTS, "entries_count": 1}}
    )

    arena = await db.arena_sessions.find_one({"id": arena["id"]}, {"_id": 0})
    return {"arena": arena, "entry": entry, "already_joined": False}


async def credit_arena_score(db, player_address: str, points_delta: int, treat_rarity: Optional[str] = None) -> None:
    """Called when a player collects a treat — auto-credits arena rank score and
    duel power_score. This is the entrant's only source of ranking points outside
    of dueling, so it must fire on every collected treat, not just legendary/mythic."""
    arena = await db.arena_sessions.find_one({"status": "active"}, {"_id": 0})
    if not arena:
        return
    update = {"$inc": {"points": points_delta}, "$set": {"last_active_at": _utcnow()}}
    # Normalize rarity casing (rarity is stored Title-case, e.g. "Legendary")
    rarity_key = next((r for r in RARITY_POWER if treat_rarity and r.lower() == treat_rarity.lower()), None)
    if rarity_key:
        update["$inc"]["power_score"] = RARITY_POWER[rarity_key]
    if treat_rarity and treat_rarity.lower() in ("legendary", "mythic"):
        update["$inc"]["win_streak"] = 1
    res = await db.arena_entries.update_one(
        {"arena_id": arena["id"], "player_address": player_address},
        update
    )
    if res.matched_count == 0:
        # player isn't in the arena; nothing to do
        return


async def get_leaderboard(db, limit: int = 50, division: Optional[str] = None) -> dict:
    arena = await get_or_create_current_arena(db)
    # Fetch a generous pool un-limited by `limit` since division filtering
    # happens in Python after a trophies lookup, not at the Mongo query level.
    entries = await db.arena_entries.find(
        {"arena_id": arena["id"]}, {"_id": 0}
    ).sort("points", -1).to_list(length=2000)

    if division:
        trophies_by_addr = await _trophies_by_address(db, [e["player_address"] for e in entries])
        entries = [
            e for e in entries
            if get_division(trophies_by_addr.get(e["player_address"], 0))["id"] == division
        ]

    entries = entries[:limit]
    ranked = [
        {**e, "rank": idx + 1}
        for idx, e in enumerate(entries)
    ]
    top = ranked[0] if ranked else None
    return {
        "arena": arena,
        "top": top,
        "entries": ranked,
        "division": division,
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


async def get_active_heat_event_id(db) -> str:
    """Thin id-only accessor. Several call sites just need to compare the
    active event's id against a string (e.g. `== "lab_surge"`) without the
    full rotate/timing payload get_or_rotate_heat_event returns."""
    data = await get_or_rotate_heat_event(db)
    event = data.get("event") if isinstance(data, dict) else None
    return (event or {}).get("id", "idle_calm")


async def run_heat_event_scheduler(db, interval_seconds: int = 60):
    """Background loop: proactively keeps the heat event rotated on a timer
    instead of relying only on the lazy check inside get_or_rotate_heat_event.
    Errors are caught per-tick so a transient DB hiccup never kills the loop —
    this is started once as a fire-and-forget asyncio task at server startup."""
    while True:
        try:
            await get_or_rotate_heat_event(db)
        except Exception as e:
            logger.warning(f"Heat event scheduler tick failed (non-fatal): {e}")
        await asyncio.sleep(interval_seconds)


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


# ─── Duels ──────────────────────────────────────────────────────────────────
# Asynchronous, instant-resolve PvP. No live opponent needed — a challenger is
# matched against the current snapshot of another entrant's power_score and the
# outcome resolves immediately. Tickets refill once per UTC day.

async def _reset_tickets_if_new_day(db, arena_id: str, entry: dict) -> dict:
    today = _today_str()
    if entry.get("duel_tickets_date") != today:
        await db.arena_entries.update_one(
            {"arena_id": arena_id, "player_address": entry["player_address"]},
            {"$set": {"duel_tickets_used": 0, "duel_tickets_date": today}}
        )
        entry = {**entry, "duel_tickets_used": 0, "duel_tickets_date": today}
    return entry


async def get_duel_state(db, player_address: str) -> dict:
    arena = await get_or_create_current_arena(db)
    entry = await db.arena_entries.find_one(
        {"arena_id": arena["id"], "player_address": player_address}, {"_id": 0}
    )
    if not entry:
        return {"joined": False}
    entry = await _reset_tickets_if_new_day(db, arena["id"], entry)
    tickets_left = max(0, DUEL_TICKETS_PER_DAY - entry.get("duel_tickets_used", 0))
    return {
        "joined": True,
        "power_score": entry.get("power_score", 0),
        "duel_wins": entry.get("duel_wins", 0),
        "duel_losses": entry.get("duel_losses", 0),
        "duel_streak": entry.get("duel_streak", 0),
        "tickets_left": tickets_left,
        "tickets_per_day": DUEL_TICKETS_PER_DAY,
        "log": list(reversed(entry.get("duel_log", [])))[:10],
    }


async def _find_opponent(db, arena_id: str, player_address: str, my_power: int) -> Optional[dict]:
    others = await db.arena_entries.find(
        {"arena_id": arena_id, "player_address": {"$ne": player_address}}, {"_id": 0}
    ).to_list(length=2000)
    if not others:
        return None
    # Closest power_score match first (keeps duels competitive); pick randomly
    # among the 5 closest so it's not the exact same opponent every time.
    others.sort(key=lambda o: abs(o.get("power_score", 0) - my_power))
    pool = others[:5]
    return random.choice(pool)


async def challenge_duel(db, player_address: str) -> dict:
    """Spends one duel ticket, resolves an instant asynchronous PvP duel against
    a power-matched opponent, and credits both the arena rank score and the
    player's real points balance with the outcome."""
    arena = await get_or_create_current_arena(db)
    entry = await db.arena_entries.find_one(
        {"arena_id": arena["id"], "player_address": player_address}, {"_id": 0}
    )
    if not entry:
        raise ValueError("join the arena before dueling")

    entry = await _reset_tickets_if_new_day(db, arena["id"], entry)
    tickets_used = entry.get("duel_tickets_used", 0)
    if tickets_used >= DUEL_TICKETS_PER_DAY:
        raise ValueError("no duel tickets left — more tomorrow")

    my_power = entry.get("power_score", 0)
    opponent = await _find_opponent(db, arena["id"], player_address, my_power)
    if not opponent:
        raise ValueError("no opponents available yet — invite a friend to the arena")

    opp_power = opponent.get("power_score", 0)
    win_prob = 0.5 if (my_power + opp_power) == 0 else my_power / (my_power + opp_power)
    win_prob = max(DUEL_WIN_PROB_FLOOR, min(DUEL_WIN_PROB_CEIL, win_prob))
    won = random.random() < win_prob
    reward = DUEL_WIN_POINTS if won else DUEL_LOSS_POINTS
    opponent_name = opponent.get("nickname") or opponent["player_address"][:8]

    log_entry = {
        "opponent": opponent_name,
        "result": "win" if won else "loss",
        "points": reward,
        "my_power": my_power,
        "opponent_power": opp_power,
        "at": _utcnow().isoformat(),
    }

    update = {
        "$inc": {
            "points": reward,  # feeds the same arena leaderboard rank
            "duel_wins": 1 if won else 0,
            "duel_losses": 0 if won else 1,
            "duel_tickets_used": 1,
        },
        "$set": {"last_active_at": _utcnow(), "duel_tickets_date": entry["duel_tickets_date"]},
        "$push": {"duel_log": {"$each": [log_entry], "$slice": -DUEL_LOG_MAX}},
    }
    if won:
        update["$inc"]["duel_streak"] = 1
    else:
        update["$set"]["duel_streak"] = 0

    await db.arena_entries.update_one(
        {"arena_id": arena["id"], "player_address": player_address}, update
    )
    # Real, spendable points too — a duel should pay out immediately, not just
    # move a rank number. Trophies are persistent and carry into the next arena.
    trophy_gain = TROPHIES_DUEL_WIN if won else TROPHIES_DUEL_LOSS
    await db.players.update_one(
        {"address": player_address},
        {"$inc": {"points": reward, "arena_trophies": trophy_gain}}
    )

    return {
        "result": "win" if won else "loss",
        "points_awarded": reward,
        "trophies_awarded": trophy_gain,
        "my_power": my_power,
        "opponent": {"nickname": opponent_name, "power_score": opp_power},
        "win_probability": round(win_prob, 3),
        "tickets_left": max(0, DUEL_TICKETS_PER_DAY - (tickets_used + 1)),
    }


async def get_division_info(db, player_address: str) -> dict:
    """Live division standing: persistent trophies + where the player currently
    ranks within their division for today's still-active arena."""
    player = await db.players.find_one({"address": player_address}, {"_id": 0, "arena_trophies": 1})
    trophies = (player or {}).get("arena_trophies", 0)
    division = get_division(trophies)
    nxt = _next_division(division["id"])
    trophies_to_next = max(0, nxt["min_trophies"] - trophies) if nxt else 0

    arena = await get_or_create_current_arena(db)
    entries = await db.arena_entries.find(
        {"arena_id": arena["id"]}, {"_id": 0}
    ).sort("points", -1).to_list(length=2000)
    trophies_by_addr = await _trophies_by_address(db, [e["player_address"] for e in entries])
    division_entries = [
        e for e in entries
        if get_division(trophies_by_addr.get(e["player_address"], 0))["id"] == division["id"]
    ]
    my_rank = next(
        (i + 1 for i, e in enumerate(division_entries) if e["player_address"] == player_address),
        None
    )

    return {
        "division": division,
        "trophies": trophies,
        "next_division": nxt,
        "trophies_to_next": trophies_to_next,
        "division_rank": my_rank,
        "division_size": len(division_entries),
    }
