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

Until DogeOS's own credentials (DOGEOS_API_URL / DOGEOS_PARTNER_API_KEY) are
set, or until a given DOGEOS_QUEST_ID_* is set, that quest's evaluator still
runs and still records the result in dogeos_quest_reports as
"eligible_but_unreported" - so you can verify the *logic* (who would
qualify, and when) before every piece of DogeOS-side configuration exists.
Nothing is lost: the next poll after everything is set reports it for real.
"""
import os
import re
import asyncio
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

DOGEOS_API_URL = os.environ.get("DOGEOS_API_URL", "").rstrip("/")
DOGEOS_PARTNER_API_KEY = os.environ.get("DOGEOS_PARTNER_API_KEY", "")

HEIST_CAMPAIGN_START = os.environ.get("HEIST_CAMPAIGN_START", "2020-01-01")
HEIST_CAMPAIGN_END = os.environ.get("HEIST_CAMPAIGN_END", "")  # blank = open-ended
POLL_INTERVAL_SECONDS = int(os.environ.get("HEIST_QUEST_POLL_INTERVAL_SECONDS", "120"))

# Re-sending is throttled so a config change (new API host / new quest UUIDs)
# can't fire thousands of calls at DogeOS in one go. Only wallets that already
# have a report record count against the budget - first-ever reports for new
# players are never held back. 0 disables re-sends entirely.
RESEND_PER_SWEEP = int(os.environ.get("HEIST_RESEND_PER_SWEEP", "200"))
RESEND_DELAY_SECONDS = float(os.environ.get("HEIST_RESEND_DELAY_SECONDS", "0.1"))
# A report that failed (DogeOS rejected it, or the request errored) is not
# retried every sweep - wait this long unless the target host/UUID changed.
ERROR_RETRY_MINUTES = int(os.environ.get("HEIST_ERROR_RETRY_MINUTES", "30"))

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


def _campaign_start_dt() -> datetime:
    """spin_wheel_history.spun_at is written as a real datetime object
    (services collect it via `"spun_at": datetime.now(timezone.utc)`),
    unlike treats.collected_at / lab_notes.created_at which are stored as
    ISO strings. MongoDB's range operators only match when the query
    value's type matches the field's stored type - comparing that field
    against the string HEIST_CAMPAIGN_START silently matches nothing, no
    matter how many spins exist. This gives _check_daily_spin a real
    datetime to compare against instead."""
    return datetime.fromisoformat(HEIST_CAMPAIGN_START).replace(tzinfo=timezone.utc)


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
    wallet.

    Both "quest_id_not_set" (DogeOS hasn't published the quest / given us
    its UUID yet) and "dogeos_api_not_configured" (we have the quest ID but
    DOGEOS_API_URL/DOGEOS_PARTNER_API_KEY aren't set yet) mean the same
    thing from the outside: this player is genuinely eligible, we just
    can't tell DogeOS yet for a configuration reason on either side. Both
    map to "eligible_but_unreported" so the /status endpoint keeps counting
    them - only a real failure (DogeOS rejected the call, or the request
    itself failed) is recorded as "error"."""
    if ok:
        status = "reported"
    elif detail in ("quest_id_not_set", "dogeos_api_not_configured"):
        status = "eligible_but_unreported"
    else:
        status = "error"
    await db.dogeos_quest_reports.update_one(
        {"wallet": wallet.lower(), "quest_key": quest_key},
        {
            "$set": {
                "wallet": wallet.lower(),
                "quest_key": quest_key,
                "quest_label": QUEST_LABELS.get(quest_key, quest_key),
                "status": status,
                "detail": detail,
                # Where this attempt was aimed. Lets us tell a report that
                # reached today's production target from one sent while the
                # backend still pointed at staging (see _report_state).
                "api_url": DOGEOS_API_URL,
                "quest_id": QUEST_IDS.get(quest_key, ""),
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


async def _report_state(db, wallet: str, quest_key: str) -> str:
    """Where this wallet+quest stands relative to the CURRENT API host and
    quest UUID:
      new     - never attempted
      current - reported successfully to today's host + UUID (nothing to do)
      stale   - reported, but to a different host/UUID, or before this
                backend recorded where reports went (staging -> production)
      backoff - last attempt failed recently against the same target
      retry   - not reported yet (failed earlier, or config was missing)"""
    doc = await db.dogeos_quest_reports.find_one({"wallet": wallet.lower(), "quest_key": quest_key})
    if not doc:
        return "new"
    same_target = (
        doc.get("api_url") == DOGEOS_API_URL and doc.get("quest_id") == QUEST_IDS.get(quest_key, "")
    )
    if doc.get("status") == "reported":
        return "current" if same_target else "stale"
    if doc.get("status") == "error" and same_target:
        try:
            last = datetime.fromisoformat(doc.get("last_attempt_at", ""))
            age_min = (datetime.now(timezone.utc) - last).total_seconds() / 60
            if age_min < ERROR_RETRY_MINUTES:
                return "backoff"
        except Exception:
            pass
    return "retry"


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
        {"player_address": _ci_regex(wallet), "spun_at": {"$gte": _campaign_start_dt()}},
        sort=[("spun_at", 1)],
    )
    if not spin:
        return False, {}, None
    spun_at = spin.get("spun_at")
    # Keep evidence JSON-safe (this dict gets sent to DogeOS and stored in
    # Mongo) - a raw datetime isn't serializable by httpx's json= param.
    spun_at_str = spun_at.isoformat() if hasattr(spun_at, "isoformat") else spun_at
    return True, {"spun_at": spun_at_str}, None


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

async def evaluate_player(db, wallet: str, send_budget: dict | None = None) -> dict:
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
        state = await _report_state(db, wallet, quest_key)
        if state == "current":
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

        # Only a real network send is rate-limited. Quests with no UUID or
        # no API credentials never leave this process, so they cost nothing.
        will_send = bool(QUEST_IDS.get(quest_key)) and is_configured()
        if will_send and state == "backoff":
            results[quest_key] = {"status": "backoff_after_error"}
            continue
        if will_send and state in ("stale", "retry") and send_budget is not None:
            if send_budget["left"] <= 0:
                results[quest_key] = {"status": "deferred_rate_limit"}
                continue
            send_budget["left"] -= 1

        ok, detail = await _mark_eligible(quest_key, wallet, evidence)
        await _record_result(db, wallet, quest_key, ok, detail, evidence)
        results[quest_key] = {"status": "reported" if ok else detail, "evidence": evidence}
        if will_send and send_budget is not None:
            await asyncio.sleep(RESEND_DELAY_SECONDS)

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
    deferred = 0
    budget = {"left": RESEND_PER_SWEEP}
    for wallet in wallets:
        outcome = await evaluate_player(db, wallet, send_budget=budget)
        scanned += 1
        for r in outcome.get("results", {}).values():
            if r.get("status") == "reported" and r.get("evidence") is not None:
                newly_reported += 1
            elif r.get("status") == "deferred_rate_limit":
                deferred += 1

    return {"scanned_players": scanned, "newly_reported": newly_reported, "deferred_for_next_sweep": deferred}


# ---------------------------------------------------------------------------
# Admin debugging - what DogeOS asks for when a quest "won't verify"
# ---------------------------------------------------------------------------

def redacted_config() -> dict:
    """Which API host and quest UUIDs this backend is actually using right
    now. Never includes the API key itself - only whether one is set."""
    return {
        "api_url": DOGEOS_API_URL or None,
        "api_key_configured": bool(DOGEOS_PARTNER_API_KEY),
        "campaign_start": HEIST_CAMPAIGN_START,
        "quest_ids": {k: (v or None) for k, v in QUEST_IDS.items()},
    }


async def _eligibility_for(db, wallet: str, quest_key: str):
    """Run the real server-side check for ONE quest, including any earlier
    quests it depends on (publish_note needs first_batch's timestamp,
    return_batch needs both). Returns (eligible, evidence)."""
    if quest_key == "sign_on":
        player = await db.players.find_one({"address": _ci_regex(wallet)})
        ok, ev, _ = await _check_sign_on(db, player or {"address": wallet})
        return ok, ev
    if quest_key == "first_batch":
        ok, ev, _ = await _check_first_batch(db, wallet)
        return ok, ev
    if quest_key == "daily_spin":
        ok, ev, _ = await _check_daily_spin(db, wallet)
        return ok, ev
    if quest_key == "lab_launcher":
        ok, ev, _ = await _check_lab_launcher(db, wallet)
        return ok, ev
    if quest_key in ("publish_note", "return_batch"):
        fb_ok, fb_ev, fb_ts = await _check_first_batch(db, wallet)
        if not fb_ok:
            return False, {}
        pn_ok, pn_ev, pn_ts = await _check_publish_note(db, wallet, fb_ts)
        if quest_key == "publish_note":
            return pn_ok, pn_ev
        if not pn_ok:
            return False, {}
        rb_ok, rb_ev, _ = await _check_return_batch(db, wallet, pn_ts, fb_ev.get("treat_id"))
        return rb_ok, rb_ev
    return False, {}


async def debug_resend(db, wallet: str, quest_key: str) -> dict:
    """Re-run our own server-side check for one wallet + quest and, only if
    it passes, send a fresh mark-eligible call to DogeOS - returning the
    exact outgoing request (API key redacted) and DogeOS's actual response.
    Exists so there's something concrete to hand DogeOS's engineers when a
    quest won't verify. It never skips our own validation: a wallet that
    hasn't really done the task can't be marked through here."""
    if quest_key not in QUEST_IDS:
        return {"error": "unknown_quest_key", "valid_keys": QUEST_ORDER}
    if not is_wallet_address(wallet):
        return {"error": "not_a_wallet_address", "got": wallet}

    # The real loop sends players.address exactly as stored (casing
    # included), so reproduce that rather than whatever was typed here.
    player = await db.players.find_one({"address": _ci_regex(wallet)}, {"address": 1})
    wallet_sent = (player or {}).get("address") or wallet

    eligible, evidence = await _eligibility_for(db, wallet_sent, quest_key)
    result = {
        "quest_key": quest_key,
        "quest_label": QUEST_LABELS.get(quest_key),
        "wallet_requested": wallet,
        "wallet_sent": wallet_sent,
        "player_found_in_dogefood_lab": player is not None,
        "eligible_per_dogefood_lab": eligible,
        "evidence": evidence,
        "sent": False,
    }
    if not eligible:
        result["note"] = (
            "Our own server-side check says this wallet has NOT completed this quest, "
            "so nothing was sent to DogeOS. That alone would explain a quest not verifying."
        )
        return result

    quest_id = QUEST_IDS.get(quest_key, "")
    if not quest_id:
        result["note"] = f"No quest UUID is configured for '{quest_key}' (env var not set), so nothing could be sent."
        return result
    if not is_configured():
        result["note"] = "DOGEOS_API_URL and/or DOGEOS_PARTNER_API_KEY is not set, so nothing could be sent."
        return result

    url = f"{DOGEOS_API_URL}/v2/partner-api/quests/{quest_id}/mark-eligible"
    body = {
        "walletAddress": wallet_sent,
        "metadata": {**evidence, "source": "dogefood-lab-heist", "markedAt": datetime.now(timezone.utc).isoformat()},
    }
    result["request"] = {
        "method": "POST",
        "url": url,
        "quest_uuid": quest_id,
        "headers": {"Content-Type": "application/json", "X-Partner-API-Key": "<redacted>"},
        "body": body,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                headers={"Content-Type": "application/json", "X-Partner-API-Key": DOGEOS_PARTNER_API_KEY},
                json=body,
            )
        text = resp.text.replace(DOGEOS_PARTNER_API_KEY, "<redacted>")
        ok = 200 <= resp.status_code < 300
        result["sent"] = True
        result["response"] = {"status_code": resp.status_code, "body": text[:2000]}
        await _record_result(
            db, wallet_sent, quest_key, ok,
            "reported" if ok else f"dogeos_rejected_{resp.status_code}: {text[:300]}", evidence,
        )
    except Exception as e:
        result["response"] = {"error": f"request_failed: {str(e)[:500]}"}
    return result


async def run_forever(db):
    """Background loop - same shape as lab_launcher_indexer.run_forever().
    No-ops harmlessly (just sleeps) if DOGEOS_API_URL/DOGEOS_PARTNER_API_KEY
    aren't set, since evaluate_all() still runs and records
    eligible_but_unreported results either way."""
    await ensure_indexes(db)
    logger.info(f"🦴 Heist quest evaluator started (poll every {POLL_INTERVAL_SECONDS}s, configured={is_configured()})")
    while True:
        try:
            outcome = await evaluate_all(db)
            if outcome.get("newly_reported") or outcome.get("deferred_for_next_sweep"):
                logger.info(f"🦴 Heist quest sweep: {outcome}")
        except Exception as e:
            logger.error(f"🦴 Heist quest evaluator error: {e}")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
