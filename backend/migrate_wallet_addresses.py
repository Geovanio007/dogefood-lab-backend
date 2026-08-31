#!/usr/bin/env python3
"""One-time DogeFood Lab wallet-address migration.

SAFE BY DEFAULT: runs in dry-run mode. Use --apply only after reviewing the
reported merges. --apply additionally requires MIGRATION_ADMIN_KEY to match
ADMIN_SECRET (or WALLET_MIGRATION_KEY if ADMIN_SECRET is not configured).

The migration:
  1. Groups db.players 0x addresses case-insensitively.
  2. Merges duplicate player documents into one lowercase canonical document.
  3. Preserves the best real nickname, sums points/xp unless duplicate docs
     share a Telegram identity (then uses the maximum to avoid double-counting
     mirrored activity), unions created_treats, preserves identity fields and
     takes max last_active.
  4. Lowercases wallet addresses in wallet-bearing collections.
  5. Drops old case-sensitive players.address indexes and creates the final
     case-insensitive unique index only after duplicates are gone.

No guest_ / GUEST_USER / TG_ identifiers are lowercased by this script.
"""

import argparse
import asyncio
import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s:%(message)s")
logger = logging.getLogger("wallet-migration")

EVM_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
PLACEHOLDER_RE = re.compile(r"^Scientist\s+0x[0-9a-fA-F]{4,}.*$", re.I)


def normalize_wallet_address(value: Any) -> Any:
    if value is None:
        return value
    value = str(value).strip()
    return value.lower() if value.lower().startswith("0x") else value


def is_wallet(value: Any) -> bool:
    return isinstance(value, str) and bool(EVM_RE.match(value.strip()))


def dt_value(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.min.replace(tzinfo=timezone.utc)


def real_nickname(doc: dict) -> str | None:
    value = doc.get("nickname")
    if not value or not isinstance(value, str):
        return None
    value = value.strip()
    if not value or PLACEHOLDER_RE.match(value):
        return None
    return value


def dedupe_list(values: list[Any]) -> list[Any]:
    out, seen = [], set()
    for value in values:
        try:
            key = json.dumps(value, sort_keys=True, default=str)
        except TypeError:
            key = repr(value)
        if key not in seen:
            seen.add(key)
            out.append(value)
    return out


def merge_player_docs(docs: list[dict]) -> tuple[dict, dict]:
    docs = sorted(docs, key=lambda d: dt_value(d.get("created_at")))
    base = dict(docs[0])
    for d in docs[1:]:
        base.update({k: v for k, v in d.items() if k not in {"_id", "address", "points", "experience", "created_treats", "last_active"} and (base.get(k) in (None, "", [], {}) or k not in base)})

    base["address"] = normalize_wallet_address(docs[0].get("address"))

    # Prefer the oldest real nickname and never persist a Scientist 0x...
    # placeholder as the canonical nickname.
    real_names = [real_nickname(d) for d in docs]
    real_names = [name for name in real_names if name]
    base["nickname"] = real_names[0] if real_names else None

    same_telegram = len({d.get("telegram_id") for d in docs if d.get("telegram_id") is not None}) == 1 and any(d.get("telegram_id") is not None for d in docs)
    points_values = [int(d.get("points") or 0) for d in docs]
    xp_values = [int(d.get("experience") or 0) for d in docs]
    base["points"] = max(points_values) if same_telegram else sum(points_values)
    base["experience"] = max(xp_values) if same_telegram else sum(xp_values)

    treats = []
    for d in docs:
        treats.extend(d.get("created_treats") or [])
    base["created_treats"] = dedupe_list(treats)

    # Preserve important booleans/identity fields.
    for field in ("is_nft_holder", "is_vip", "vip_bonus_claimed", "leaderboard_eligible", "can_convert_points"):
        base[field] = any(bool(d.get(field)) for d in docs)

    for field in ("selected_character", "profile_image", "telegram_id", "telegram_username", "telegram_first_name", "telegram_last_name", "firebase_uid", "firebase_provider", "email", "solana_address", "auth_type"):
        values = [d.get(field) for d in docs if d.get(field) not in (None, "")]
        if values:
            # Linked is the strongest auth state when it is present.
            base[field] = "linked" if field == "auth_type" and "linked" in values else values[0]

    last_active_values = [dt_value(d.get("last_active")) for d in docs]
    latest = max(last_active_values)
    if latest != datetime.min.replace(tzinfo=timezone.utc):
        base["last_active"] = latest

    # Merge common numeric counters without overwriting values already handled.
    for field in ("total_points_collected", "total_treats_created", "sack_completed_count", "lab_bonus_allocation"):
        vals = [d.get(field) for d in docs if isinstance(d.get(field), (int, float))]
        if vals:
            base[field] = max(vals) if same_telegram else sum(vals)

    # Merge array-like histories used by the game.
    for field in ("extra_life_history", "temp_unlocked_ingredients", "referral_history"):
        vals = []
        for d in docs:
            if isinstance(d.get(field), list):
                vals.extend(d[field])
        if vals:
            base[field] = dedupe_list(vals)

    audit = {
        "documents": [
            {
                "id": d.get("id"),
                "_id": str(d.get("_id")),
                "address": d.get("address"),
                "nickname": d.get("nickname"),
                "points": d.get("points", 0),
                "experience": d.get("experience", 0),
                "created_treats_count": len(d.get("created_treats") or []),
                "telegram_id": d.get("telegram_id"),
            }
            for d in docs
        ],
        "canonical_address": base["address"],
        "same_telegram_identity": same_telegram,
        "merged_points": base["points"],
        "merged_experience": base["experience"],
        "merged_created_treats_count": len(base["created_treats"]),
        "nickname": base.get("nickname"),
    }
    return base, audit


async def normalize_collection_field(db, collection: str, field: str, dry_run: bool, audit: list[dict]):
    coll = db[collection]
    cursor = coll.find({field: {"$regex": "^0x", "$options": "i"}}, {"_id": 1, field: 1})
    changed = 0
    async for doc in cursor:
        old = doc.get(field)
        new = normalize_wallet_address(old)
        if old == new:
            continue
        changed += 1
        audit.append({"collection": collection, "_id": str(doc["_id"]), "field": field, "before": old, "after": new})
        if not dry_run:
            await coll.update_one({"_id": doc["_id"]}, {"$set": {field: new}})
    return changed


async def run(args):
    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME", "dogefood_lab_production")
    if not mongo_url:
        raise SystemExit("MONGO_URL is required")

    if args.apply:
        expected = os.getenv("ADMIN_SECRET") or os.getenv("WALLET_MIGRATION_KEY")
        supplied = os.getenv("MIGRATION_ADMIN_KEY")
        if not expected or not supplied or supplied != expected:
            raise SystemExit("--apply requires MIGRATION_ADMIN_KEY matching the configured admin secret")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    audit: list[dict] = []
    try:
        await client.admin.command("ping")
        logger.info("Connected to MongoDB database %s", db_name)

        # Phase 0: remove the old case-sensitive unique address index BEFORE
        # rewriting duplicate mixed-case addresses to the same lowercase value.
        # The final case-insensitive unique index is created only after all
        # duplicate player documents and wallet references are normalized.
        if args.apply:
            index_info = await db.players.index_information()
            for name, spec in index_info.items():
                key = spec.get("key", [])
                if name == "_id_":
                    continue
                if key == [("address", 1)] or key == [["address", 1]]:
                    await db.players.drop_index(name)
                    logger.info("Dropped old players address index BEFORE merge: %s", name)

        # Phase 1: inspect/merge duplicate players.
        cursor = db.players.find({"address": {"$regex": "^0x", "$options": "i"}}, {"_id": 1})
        ids = [d["_id"] async for d in cursor]
        all_docs = []
        if ids:
            all_docs = await db.players.find({"_id": {"$in": ids}}).to_list(None)

        groups: dict[str, list[dict]] = {}
        for doc in all_docs:
            addr = doc.get("address")
            if is_wallet(addr):
                groups.setdefault(normalize_wallet_address(addr), []).append(doc)

        duplicate_groups = {k: v for k, v in groups.items() if len(v) > 1}
        logger.info("Wallet groups=%d duplicate_groups=%d", len(groups), len(duplicate_groups))

        for canonical, docs in duplicate_groups.items():
            merged, merge_audit = merge_player_docs(docs)
            audit.append({"type": "player_merge", **merge_audit})
            if args.apply:
                keep_id = docs[0]["_id"]
                merged.pop("_id", None)
                await db.players.replace_one({"_id": keep_id}, merged)
                loser_ids = [d["_id"] for d in docs[1:]]
                if loser_ids:
                    await db.players.delete_many({"_id": {"$in": loser_ids}})
            logger.info("%s player group %s: %d docs -> 1", "Merged" if args.apply else "Would merge", canonical, len(docs))

        # Normalize every wallet-address field requested by the hardening plan.
        fields = {
            "treats": ["creator_address"],
            "marketplace_listings": ["seller_address", "buyer_address"],
            "lab_notes": ["author_address"],
            "lab_follows": ["follower_address", "following_address"],
            "lab_note_likes": ["player_address"],
            "lab_note_comments": ["author_address"],
            "lab_note_tips": ["from_address", "to_address"],
            "chat_messages": ["sender_address"],
            "player_pets": ["owner"],
            "special_ingredient_holders": ["player_address"],
        }
        for collection, collection_fields in fields.items():
            for field in collection_fields:
                try:
                    changed = await normalize_collection_field(db, collection, field, not args.apply, audit)
                    if changed:
                        logger.info("%s.%s: %d wallet addresses %s", collection, field, changed, "normalized" if args.apply else "would be normalized")
                except Exception as exc:
                    logger.warning("Skipping %s.%s: %s", collection, field, exc)

        if args.apply:
            # Create the final case-insensitive unique index only after the
            # duplicate player merge and all address normalization are complete.
            await db.players.create_index(
                [("address", 1)],
                name="players_address_ci_unique",
                unique=True,
                partialFilterExpression={"address": {"$type": "string"}},
                collation={"locale": "en", "strength": 2},
            )
            logger.info("Created players_address_ci_unique")

        report = {
            "mode": "apply" if args.apply else "dry-run",
            "database": db_name,
            "duplicate_groups": len(duplicate_groups),
            "audit_entries": len(audit),
            "audit": audit,
        }
        out = args.audit_file
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2, default=str)
        logger.info("Audit report written to %s", out)
        if not args.apply:
            logger.info("DRY RUN ONLY — no database data was changed")
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DogeFood Lab wallet normalization migration")
    parser.add_argument("--apply", action="store_true", help="Actually modify production data")
    parser.add_argument("--audit-file", default="wallet_migration_audit.json", help="Audit report path")
    asyncio.run(run(parser.parse_args()))
