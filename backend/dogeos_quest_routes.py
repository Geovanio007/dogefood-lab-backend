"""
DogeOS heist questline - debug/testing routes.

Sibling to server.py - same convention as lab_launcher_routes.py /
lab_feed_social_routes.py (see those files' docstrings). Exposes a factory
function server.py calls once at startup instead of pasting this in.

What each endpoint is for:
  GET  /api/dogeos-quests/status            - config + per-quest reported
                                               counts, for a quick "is this
                                               wired up right" check.
  GET  /api/dogeos-quests/preview/{wallet}   - read-only: what would this
                                               wallet's quest state look
                                               like right now. No side
                                               effects - safe to call from
                                               the frontend to show quest
                                               progress in-app if wanted.
  POST /api/dogeos-quests/evaluate/{wallet}  - runs the real evaluator for
                                               just this wallet immediately
                                               and reports anything newly
                                               eligible. This is the one to
                                               hit right after performing an
                                               action during internal
                                               testing, instead of waiting
                                               for the next poll.
  POST /api/dogeos-quests/evaluate-all       - admin-gated manual full sweep.
"""
from fastapi import APIRouter, Depends

from services import dogeos_quest_campaign as campaign


def create_dogeos_quest_router(db, admin_dep) -> APIRouter:
    router = APIRouter(prefix="/api/dogeos-quests", tags=["dogeos-quests"])

    @router.get("/status")
    async def status():
        counts = {}
        for quest_key in campaign.QUEST_ORDER:
            counts[quest_key] = {
                "label": campaign.QUEST_LABELS[quest_key],
                "quest_id_configured": bool(campaign.QUEST_IDS.get(quest_key)),
                "reported_count": await db.dogeos_quest_reports.count_documents(
                    {"quest_key": quest_key, "status": "reported"}
                ),
                "eligible_but_unreported_count": await db.dogeos_quest_reports.count_documents(
                    {"quest_key": quest_key, "status": "eligible_but_unreported"}
                ),
            }
        return {
            "dogeos_api_configured": campaign.is_configured(),
            "dogeos_api_url": campaign.DOGEOS_API_URL or None,
            "campaign_start": campaign.HEIST_CAMPAIGN_START,
            "campaign_end": campaign.HEIST_CAMPAIGN_END or None,
            "poll_interval_seconds": campaign.POLL_INTERVAL_SECONDS,
            "quests": counts,
        }

    @router.get("/preview/{wallet}")
    async def preview(wallet: str):
        """Read-only version of evaluate_player - shows what's eligible
        without ever calling DogeOS or writing to dogeos_quest_reports."""
        if not campaign.is_wallet_address(wallet):
            return {"wallet": wallet, "error": "not_a_wallet_address"}

        first_batch_eligible, fb_evidence, fb_ts = await campaign._check_first_batch(db, wallet)
        note_eligible, note_evidence, note_ts = await campaign._check_publish_note(db, wallet, fb_ts)
        spin_eligible, spin_evidence, _ = await campaign._check_daily_spin(db, wallet)
        return_eligible, return_evidence, _ = await campaign._check_return_batch(
            db, wallet, note_ts, fb_evidence.get("treat_id") if first_batch_eligible else None
        )
        launcher_eligible, launcher_evidence, _ = await campaign._check_lab_launcher(db, wallet)

        return {
            "wallet": wallet.lower(),
            "sign_on": {"eligible": True},
            "first_batch": {"eligible": first_batch_eligible, "evidence": fb_evidence},
            "publish_note": {"eligible": note_eligible, "evidence": note_evidence},
            "daily_spin": {"eligible": spin_eligible, "evidence": spin_evidence},
            "return_batch": {"eligible": return_eligible, "evidence": return_evidence},
            "lab_launcher": {"eligible": launcher_eligible, "evidence": launcher_evidence},
        }

    @router.post("/evaluate/{wallet}")
    async def evaluate(wallet: str):
        return await campaign.evaluate_player(db, wallet)

    @router.post("/evaluate-all", dependencies=[admin_dep])
    async def evaluate_all_now():
        return await campaign.evaluate_all(db)

    return router


# ---------------------------------------------------------------------------
# server.py hook-in (add near the existing lab_launcher/lab_feed_social
# wiring, at the end of the file):
#
#   from dogeos_quest_routes import create_dogeos_quest_router
#   from services import dogeos_quest_campaign
#   app.include_router(create_dogeos_quest_router(db, Depends(verify_admin)))
#
# inside delayed_startup(), alongside the other asyncio.create_task(...) calls:
#
#   asyncio.create_task(dogeos_quest_campaign.run_forever(db))
# ---------------------------------------------------------------------------
