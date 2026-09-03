"""
DogeOS "Grand Heist" questline - External Rule reporting.

Sibling to server.py, same reasoning as lab_launcher_routes.py /
lab_feed_social_routes.py: this stays out of server.py's 12k lines so it can
be reviewed and pasted as a single new file instead of a scattered diff.

What this does
--------------
Six of the heist's quests are DogeOS "External Rule" quests: DogeOS doesn't
watch our database directly, so *we* have to notice when a player becomes
eligible and POST that to DogeOS's mark-eligible endpoint with our partner
API key (see onchain-demo-partner/web/app/api/partner-complete-quest/route.ts
for the reference implementation this mirrors - same request shape, same
header, same idea, just server-to-server here instead of triggered from a
browser button).

Rather than hook into six different existing endpoints scattered across
server.py (collect_treat, create_lab_note, the spin claim, ...), this runs
as one more periodic background loop - same pattern as
lab_launcher_indexer.run_forever() / lab_feed_social_indexer.run_forever()
already do. It repeatedly scans wallet-connected players, evaluates each of
the six conditions against data that already exists (treats, lab_notes,
spin_wheel_history, lab_launcher_tokens), and reports anything newly true.
This is deliberately read-only against gameplay data - it never writes to
players/treats/lab_notes, only to its own dogeos_quest_reports bookkeeping
collection.

Identity mapping (per Bruno's answer): DogeOS quests run on wallet identity,
so a player only participates once players.address is a real 0x wallet -
guest players and un-linked Telegram players are not evaluated. Note that
POST /players/link-wallet (Telegram -> wallet linking) overwrites
players.address in place with the wallet address, so a Telegram player who
links a wallet is automatically covered here with no special-casing needed.

Campaign window (per Bruno's DF-01 answer: any day is fine, the player just
has to come back once the treat is ready): HEIST_CAMPAIGN_START is used as a
floor so a veteran player can't get free credit for a treat/note/spin they
did months before this campaign existed - each condition's qualifying event
must have happened on or after that date. There is no "must be a different
calendar day" requirement anywhere; the treat brew timer (2-5h) is what
naturally separates the two treats in practice.

Env vars (all optional - anything unset just makes that quest no-op safely,
same convention as LAB_LAUNCHER_*_ADDRESS in lab_launcher_indexer.py):

  DOGEOS_API_URL                     e.g. https://quest-api-staging.dogeos.com
  DOGEOS_PARTNER_API_KEY             from DogeOS admin -> API Keys
  HEIST_CAMPAIGN_START                ISO date, e.g. 2026-09-15
  HEIST_CAMPAIGN_END                  ISO date, e.g. 2026-09-29 (optional; if
                                       set, the evaluator stops scanning after this)
  HEIST_QUEST_POLL_INTERVAL_SECONDS   default 120

  Per-quest DogeOS quest UUIDs (from DogeOS admin -> Quests, one per quest -
  these don't exist until DogeOS creates the quests, so leave blank until then):
    DOGEOS_QUEST_ID_SIGN_ON        - "Sign On as a Scientist"      (DF-02)
    DOGEOS_QUEST_ID_FIRST_BATCH    - "Brew the First Batch"        (DF-03)
    DOGEOS_QUEST_ID_PUBLISH_NOTE   - "Publish the Lab Note"        (DF-04)
    DOGEOS_QUEST_ID_DAILY_SPIN     - "Take the Daily Spin"         (DF-11)
    DOGEOS_QUEST_ID_RETURN_BATCH   - "Mix the Return Batch"        (DF-12)
    DOGEOS_QUEST_ID_LAB_LAUNCHER   - "Launch a Lab Token" sidequest (DF-13)

Until a given DOGEOS_QUEST_ID_* is set, that quest's evaluator still runs and
still records the result in dogeos_quest_reports as "eligible_but_unreported"
- so you can verify the *logic* (who would qualify, and when) before DogeOS
has published the quest and handed you its UUID. Nothing is lost: the next
poll after you add the ID reports it for real.
"""
import os
import re
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

DOGEOS_API_URL = os.environ.get("DOGEOS_API_URL", "").rstrip("/")
DOGEOS_PARTNER_API_KEY = os.environ.get("DOGEOS_PARTNER_API_KEY", "")

HEIST_CAMPAIGN_START = os.environ.get("HEIST_CAMPAIGN_START", "2020-01-01")
HEIST_CAMPAIGN_END = os.environ.get("HEIST_CAMPAIGN_END", "")  # blank = open-ended
POLL_INTERVAL_SECONDS = int(os.environ.get("HEIST_QUEST_POLL_INTERVAL_SECONDS", "120"))

QUEST_IDS = {
    "sign_on": os.environ.get("DOGEOS_QUEST_ID_SIGN_ON", ""),
    "first_batch": os.environ.get("DOGEOS_QUEST_ID_FIRST_BATCH", ""),
    "publish_note": os.environ.get("DOGEOS_QUEST_ID_PUBLISH_NOTE", ""),
    "daily_spin": os.environ.get("DOGEOS_QUEST_ID_DAILY_SPIN", ""),
    "return_batch": os.environ.get("DOGEOS_QUEST_ID_RETURN_BATCH", ""),
    "lab_launcher": os.environ.get("DOGEOS_QUEST_ID_LAB_LAUNCHER", ""),
}

QUEST_LABELS = {
    "sign_on": "Sign On as a Scientist",
    "first_batch": "Brew the First Batch",
    "publish_note": "Publish the Lab Note",
    "daily_spin": "Take the Daily Spin",
    "return_batch": "Mix the Return Batch",
    "lab_launcher": "Launch a Lab Token (sidequest)",
}

# Evaluation order matters: publish_note depends on first_batch's timestamp,
# return_batch depends on publish_note's timestamp.
QUEST_ORDER = ["sign_on", "first_batch", "publish_note", "daily_spin", "return_batch", "lab_launcher"]


def is_wallet_address(address) -> bool:
    """Real 0x wallet - excludes guest_*, TG_*/tg_* pseudo-addresses."""
    return bool(address) and isinstance(address, str) and address.lower().startswith("0x") and len(address) == 42


def _ci_regex(value: str) -> dict:
    return {"$regex": f"^{re.escape(value)}$", "$options": "i"}


def is_configured() -> bool:
    return bool(DOGEOS_API_URL and DOGEOS_PARTNER_API_KEY)


async def _mark_eligible(quest_key: str, wallet_address: str, metadata: dict) -> tuple[bool, str]:
    """POSTs to DogeOS's mark-eligible endpoint, mirroring
    onchain-demo-partner/web/app/api/partner-complete-quest/route.ts exactly:
    same URL shape, same X-Partner-API-Key header, same body shape.
    Returns (ok, detail)."""
    quest_id = QUEST_IDS.get(quest_key, "")
    if not quest_id:
        return False, "quest_id_not_set"
    if not is_configured():
        return False, "dogeos_api_not_configured"

    url = f"{DOGEOS_API_URL}/v2/partner-api/quests/{quest_id}/mark-eligible"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                headers={"Content-Type": "application/json", "X-Partner-API-Key": DOGEOS_PARTNER_API_KEY},
                json={
                    "walletAddress": wallet_address,
                    "metadata": {**metadata, "source": "dogefood-lab-heist", "markedAt": datetime.now(timezone.utc).isoformat()},
                },
            )
        if resp.status_code >= 200 and resp.status_code < 300:
            return True, "reported"
        return False, f"dogeos_rejected_{resp.status_code}: {resp.text[:300]}"
    except Exception as e:
        return False, f"request_failed: {str(e)[:300]}"


async def _record_result(db, wallet: str, quest_key: str, ok: bool, detail: str, evidence: dict):
    """Idempotency bookkeeping. One doc per (wallet, quest_key) - see
    ensure_indexes() for the unique index that makes double-inserts a no-op
    rather than a duplicate. A doc with status already "reported" is never
    touched again - once DogeOS has it, we're done with that quest for that
    wallet. A doc that's "eligible_but_unreported" (quest_id not set yet)
    gets upgraded to "reported" automatically once you add the quest ID and
    the next poll runs, since callers only call this when evidence changed
    or the previous attempt didn't succeed."""
    status = "reported" if ok else ("eligible_but_unreported" if detail == "quest_id_not_set" else "error")
    await db.dogeos_quest_reports.update_one(
        {"wallet": wallet.lower(), "quest_key": quest_key},
        {
            "$set": {
                "wallet": wallet.lower(),
                "quest_key": quest_key,
                "quest_label": QUEST_LABELS.get(quest_key, quest_key),
                "status": status,
                "detail": detail,
                "evidence": evidence,
                "last_attempt_at": datetime.now(timezone.utc).isoformat(),
            },
            "$setOnInsert": {"first_eligible_at": datetime.now(timezone.utc).isoformat()},
        },
        upsert=True,
    )


async def _already_reported(db, wallet: str, quest_key: str) -> bool:
    doc = await db.dogeos_quest_reports.find_one({"wallet": wallet.lower(), "quest_key": quest_key, "status": "reported"})
    return doc is not None


async def ensure_indexes(db):
    await db.dogeos_quest_reports.create_index([("wallet", 1), ("quest_key", 1)], unique=True)


# ---------------------------------------------------------------------------
# Per-quest eligibility checks. Each returns (eligible: bool, evidence: dict,
# qualifying_timestamp: str | None) - the timestamp feeds the next quest in
# the chain (publish_note needs first_batch's timestamp; return_batch needs
# publish_note's timestamp).
# ---------------------------------------------------------------------------

async def _check_sign_on(db, player: dict):
    # Identity mapping itself: having a real wallet on file IS the "Sign On
    # as a Scientist" condition (create/activate a profile + map it to the
    # DogeOS quest wallet). No timestamp gating - this can be true the
    # moment they connect, campaign or not.
    return True, {"address": player["address"]}, None


async def _check_first_batch(db, wallet: str):
    treat = await db.treats.find_one(
        {
            "creator_address": _ci_regex(wallet),
            "brewing_status": "collected",
            "collected_at": {"$gte": HEIST_CAMPAIGN_START},
        },
        sort=[("collected_at", 1)],
    )
    if not treat:
        return False, {}, None
    return True, {"treat_id": treat.get("id"), "collected_at": treat.get("collected_at")}, treat.get("collected_at")


async def _check_publish_note(db, wallet: str, first_batch_ts: str):
    if not first_batch_ts:
        return False, {}, None
    note = await db.lab_notes.find_one(
        {
            "author_address": _ci_regex(wallet),
            "content": {"$exists": True, "$ne": ""},
            "image_url": {"$exists": True, "$ne": None, "$ne": ""},
            "created_at": {"$gt": first_batch_ts},
        },
        sort=[("created_at", 1)],
    )
    if not note:
        return False, {}, None
    return True, {"note_id": note.get("id"), "created_at": note.get("created_at")}, note.get("created_at")


async def _check_daily_spin(db, wallet: str):
    spin = await db.spin_wheel_history.find_one(
        {"player_address": _ci_regex(wallet), "spun_at": {"$gte": HEIST_CAMPAIGN_START}},
        sort=[("spun_at", 1)],
    )
    if not spin:
        return False, {}, None
    return True, {"spun_at": spin.get("spun_at")}, None


async def _check_return_batch(db, wallet: str, publish_note_ts: str, first_treat_id: str):
    if not publish_note_ts:
        return False, {}, None
    treat = await db.treats.find_one(
        {
            "creator_address": _ci_regex(wallet),
            "brewing_status": "collected",
            "collected_at": {"$gt": publish_note_ts},
            "id": {"$ne": first_treat_id},
        },
        sort=[("collected_at", 1)],
    )
    if not treat:
        return False, {}, None
    return True, {"treat_id": treat.get("id"), "collected_at": treat.get("collected_at")}, None


async def _check_lab_launcher(db, wallet: str):
    token = await db.lab_launcher_tokens.find_one({"creator_wallet": wallet.lower()})
    if not token:
        return False, {}, None
    return True, {"token_address": token.get("_id"), "name": token.get("name")}, None


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

async def evaluate_player(db, wallet: str) -> dict:
    """Evaluate + report all six quests for one wallet, right now (no
    polling wait). Safe to call repeatedly - already-reported quests are
    skipped instantly, everything else is idempotent. Used by both the
    background loop and the on-demand /evaluate/{wallet} endpoint testers
    can hit right after performing an action."""
    if not is_wallet_address(wallet):
        return {"wallet": wallet, "error": "not_a_wallet_address", "results": {}}

    results = {}
    first_batch_ts = None
    publish_note_ts = None
    first_treat_id = None

    for quest_key in QUEST_ORDER:
        if await _already_reported(db, wallet, quest_key):
            results[quest_key] = {"status": "reported", "detail": "already_reported"}
            # Still need timestamps for downstream quests even when this one
            # was reported on a previous pass.
            if quest_key == "first_batch":
                doc = await db.dogeos_quest_reports.find_one({"wallet": wallet.lower(), "quest_key": "first_batch"})
                first_batch_ts = (doc or {}).get("evidence", {}).get("collected_at")
                first_treat_id = (doc or {}).get("evidence", {}).get("treat_id")
            elif quest_key == "publish_note":
                doc = await db.dogeos_quest_reports.find_one({"wallet": wallet.lower(), "quest_key": "publish_note"})
                publish_note_ts = (doc or {}).get("evidence", {}).get("created_at")
            continue

        if quest_key == "sign_on":
            player = await db.players.find_one({"address": _ci_regex(wallet)})
            eligible, evidence, _ = await _check_sign_on(db, player or {"address": wallet})
        elif quest_key == "first_batch":
            eligible, evidence, ts = await _check_first_batch(db, wallet)
            if eligible:
                first_batch_ts = ts
                first_treat_id = evidence.get("treat_id")
        elif quest_key == "publish_note":
            eligible, evidence, ts = await _check_publish_note(db, wallet, first_batch_ts)
            if eligible:
                publish_note_ts = ts
        elif quest_key == "daily_spin":
            eligible, evidence, _ = await _check_daily_spin(db, wallet)
        elif quest_key == "return_batch":
            eligible, evidence, _ = await _check_return_batch(db, wallet, publish_note_ts, first_treat_id)
        elif quest_key == "lab_launcher":
            eligible, evidence, _ = await _check_lab_launcher(db, wallet)
        else:
            continue

        if not eligible:
            results[quest_key] = {"status": "not_yet_eligible"}
            continue

        ok, detail = await _mark_eligible(quest_key, wallet, evidence)
        await _record_result(db, wallet, quest_key, ok, detail, evidence)
        results[quest_key] = {"status": "reported" if ok else detail, "evidence": evidence}

    return {"wallet": wallet.lower(), "results": results}


async def evaluate_all(db, limit: int = 5000) -> dict:
    """Full sweep - the periodic loop's body. Only scans players with a real
    wallet address (see is_wallet_address); guests and un-linked Telegram
    players are skipped, matching the "must connect a wallet to
    participate" rule."""
    if HEIST_CAMPAIGN_END:
        now = datetime.now(timezone.utc).date().isoformat()
        if now > HEIST_CAMPAIGN_END:
            return {"skipped": "campaign_ended", "campaign_end": HEIST_CAMPAIGN_END}

    cursor = db.players.find({"address": {"$regex": "^0x", "$options": "i"}}, {"address": 1}).limit(limit)
    wallets = [p["address"] async for p in cursor]

    scanned = 0
    newly_reported = 0
    for wallet in wallets:
        outcome = await evaluate_player(db, wallet)
        scanned += 1
        newly_reported += sum(1 for r in outcome.get("results", {}).values() if r.get("status") == "reported")

    return {"scanned_players": scanned, "newly_reported": newly_reported}


async def run_forever(db):
    """Background loop - same shape as lab_launcher_indexer.run_forever().
    No-ops harmlessly (just sleeps) if DOGEOS_API_URL/DOGEOS_PARTNER_API_KEY
    aren't set, since evaluate_all() still runs and records
    eligible_but_unreported results either way."""
    import asyncio
    await ensure_indexes(db)
    logger.info(f"🦴 Heist quest evaluator started (poll every {POLL_INTERVAL_SECONDS}s, configured={is_configured()})")
    while True:
        try:
            outcome = await evaluate_all(db)
            if outcome.get("newly_reported"):
                logger.info(f"🦴 Heist quest sweep: {outcome}")
        except Exception as e:
            logger.error(f"🦴 Heist quest evaluator error: {e}")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
