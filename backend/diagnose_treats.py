#!/usr/bin/env python3
"""Read-only diagnostic for the "My Treats" empty-list bug.

Does NOT modify any data — safe to run anytime, as many times as needed.
Uses the exact same MONGO_URL / DB_NAME env vars as migrate_wallet_addresses.py,
so run it the same way you ran that.

Default mode (no args): scans every treat, checks whether its
creator_address matches a real, current player address (case-insensitively
— the same rule GET /api/treats/{address} uses), and reports any that
don't match anything ("orphaned"), with counts per address.

--address mode: drills into one specific player. Shows their stored player
doc, runs the exact query /api/treats/{address} runs, and also runs a
looser substring match to catch cases where the stored creator_address
isn't a clean exact match (stray characters, whitespace, etc.) that the
API's exact-anchor regex would miss.

Usage:
  MONGO_URL=... DB_NAME=... python diagnose_treats.py
  MONGO_URL=... DB_NAME=... python diagnose_treats.py --address 0xABC...
"""

import argparse
import asyncio
import logging
import os
import re
from collections import defaultdict

from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s:%(message)s")
logger = logging.getLogger("diagnose-treats")


def treat_creator_filter(address: str) -> dict:
    """Mirrors the exact filter GET /api/treats/{address} uses in server.py,
    so this script sees exactly what the live API sees."""
    if not address:
        return {"creator_address": "__invalid_empty_address__"}
    clean = str(address).strip()
    if clean.lower().startswith("0x") or clean.lower().startswith("tg_"):
        return {"creator_address": {"$regex": f"^{re.escape(clean)}$", "$options": "i"}}
    return {"creator_address": clean}


async def check_one_address(db, address: str):
    player = await db.players.find_one(
        {"address": {"$regex": f"^{re.escape(address)}$", "$options": "i"}},
        {"_id": 0},
    )
    print(f"\nPlayer lookup for {address!r}:")
    if player:
        print(f"  Found player doc — stored address: {player.get('address')!r}, id: {player.get('id')}")
        print(f"  created_treats list length: {len(player.get('created_treats') or [])}")
    else:
        print("  No player document found for this address.")

    query = treat_creator_filter(address)
    treats = await db.treats.find(query).to_list(1000)
    print(f"\nGET /api/treats/{address} would return: {len(treats)} treat(s)")
    if treats:
        print(f"  Sample stored creator_address: {treats[0].get('creator_address')!r}")

    # Looser net: same hex digits anywhere in the field, in case the stored
    # value has extra characters the exact-anchor regex above would miss.
    hex_part = address[2:] if address.lower().startswith("0x") else address
    loose = await db.treats.find(
        {"creator_address": {"$regex": re.escape(hex_part), "$options": "i"}}
    ).to_list(1000)
    if len(loose) != len(treats):
        print(
            f"  NOTE: a looser substring match finds {len(loose)} treat(s) instead — "
            f"some stored creator_address values may not be a clean exact match."
        )
        for t in loose[:5]:
            print(f"    id={t.get('id')} creator_address={t.get('creator_address')!r}")


async def full_scan(db):
    players = await db.players.find(
        {"address": {"$exists": True, "$ne": None}}, {"address": 1, "_id": 0}
    ).to_list(None)
    player_addresses_lower = {
        str(p["address"]).strip().lower() for p in players if p.get("address")
    }
    logger.info("Loaded %d distinct player addresses", len(player_addresses_lower))

    total = 0
    orphaned = 0
    orphan_samples = defaultdict(int)

    cursor = db.treats.find({}, {"creator_address": 1, "id": 1})
    async for treat in cursor:
        total += 1
        addr = treat.get("creator_address")
        if not addr:
            orphan_samples["<missing creator_address>"] += 1
            orphaned += 1
            continue
        addr_norm = str(addr).strip().lower()
        if addr_norm not in player_addresses_lower:
            orphaned += 1
            orphan_samples[str(addr)] += 1

    logger.info("Scanned %d treats total", total)
    logger.info("Orphaned (no matching current player, case-insensitive): %d", orphaned)

    if orphan_samples:
        print("\nTop orphaned creator_address values (address -> treat count):")
        for addr, count in sorted(orphan_samples.items(), key=lambda kv: -kv[1])[:25]:
            print(f"  {addr!r}: {count}")
    else:
        print("\nNo orphaned treats found — every treat's creator_address matches a current player.")


async def run(args):
    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME", "dogefood_lab_production")
    if not mongo_url:
        raise SystemExit("MONGO_URL is required")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    try:
        await client.admin.command("ping")
        logger.info("Connected to MongoDB database %s", db_name)

        if args.address:
            await check_one_address(db, args.address)
        else:
            await full_scan(db)
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Read-only diagnostic for missing treats")
    parser.add_argument("--address", help="Check one specific player address instead of a full scan")
    asyncio.run(run(parser.parse_args()))
