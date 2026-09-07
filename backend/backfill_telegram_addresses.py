#!/usr/bin/env python3
"""One-time backfill for existing Telegram players affected by the
address:null registration bug.

SAFE BY DEFAULT: runs in dry-run mode. Use --apply only after reviewing the
reported changes. --apply additionally requires MIGRATION_ADMIN_KEY to match
ADMIN_SECRET (or WALLET_MIGRATION_KEY if ADMIN_SECRET is not configured) —
same convention as migrate_wallet_addresses.py.

THE BUG: register_telegram_player (server.py) used to create new Telegram
players with "address": None instead of "address": f"TG_{telegram_id}" —
the convention every other lookup in this codebase expects (treat_creator_
filter, the frontend's effectiveAddress, etc). find_player_by_address has a
telegram_id fallback that works around this, but simpler lookups that query
players.address directly (e.g. GET /player-stats/{address}) do not, so those
players get a 404 or show as "Anonymous" wherever a nickname lookup joins on
address. The registration endpoint itself is now fixed (see server.py); this
script backfills players created before that fix.

For each db.players document where address is missing/null but telegram_id
is set:
  - If no other player already has address == "TG_<that id>", set it.
  - If another player already has that address (a pre-existing duplicate
    Telegram doc — a separate, known issue; see find_player_by_address's
    docstring), this script does NOT merge them. It reports the conflict
    and leaves both untouched for manual review, since merging is a
    different, riskier operation than this simple backfill.

Usage:
  MONGO_URL=... DB_NAME=... python backfill_telegram_addresses.py
  MONGO_URL=... DB_NAME=... MIGRATION_ADMIN_KEY=... python backfill_telegram_addresses.py --apply
"""

import argparse
import asyncio
import logging
import os

from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s:%(message)s")
logger = logging.getLogger("telegram-address-backfill")


async def run(args):
    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME", "dogefood_lab_production")
    if not mongo_url:
        raise SystemExit("MONGO_URL is required")

    if args.apply:
        expected = os.getenv("ADMIN_SECRET") or os.getenv("WALLET_MIGRATION_KEY")
        supplied = os.getenv("MIGRATION_ADMIN_KEY")
        if not expected or supplied != expected:
            raise SystemExit("--apply requires MIGRATION_ADMIN_KEY matching the configured admin secret")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    try:
        await client.admin.command("ping")
        logger.info("Connected to MongoDB database %s", db_name)

        affected = await db.players.find(
            {
                "telegram_id": {"$exists": True, "$ne": None},
                "$or": [{"address": None}, {"address": {"$exists": False}}],
            },
            {"telegram_id": 1, "nickname": 1},
        ).to_list(None)
        logger.info("Found %d Telegram player(s) with a null/missing address", len(affected))

        fixed = 0
        conflicts = []
        for p in affected:
            tg_id = p["telegram_id"]
            canonical = f"TG_{tg_id}"
            conflict = await db.players.find_one(
                {"address": canonical, "id": {"$ne": p.get("id")}}, {"id": 1, "nickname": 1}
            )
            if conflict:
                conflicts.append(
                    {"telegram_id": tg_id, "nickname": p.get("nickname"), "conflicts_with": conflict.get("id")}
                )
                continue

            logger.info(
                "%s player id=%s nickname=%r -> address=%s",
                "Would set" if not args.apply else "Setting",
                p.get("id"), p.get("nickname"), canonical,
            )
            if args.apply:
                await db.players.update_one({"_id": p["_id"]}, {"$set": {"address": canonical}})
            fixed += 1

        logger.info("%s %d player(s)%s", "Fixed" if args.apply else "Would fix", fixed,
                     "" if args.apply else " (dry run — pass --apply to write)")
        if conflicts:
            logger.warning(
                "%d player(s) skipped due to an existing conflicting document — needs manual review:",
                len(conflicts),
            )
            for c in conflicts:
                logger.warning("  %s", c)
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill address:null Telegram players to TG_<id>")
    parser.add_argument("--apply", action="store_true", help="Actually write changes (default: dry run)")
    asyncio.run(run(parser.parse_args()))
