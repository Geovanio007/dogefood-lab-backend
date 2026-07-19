#!/usr/bin/env python3
"""
Block the confirmed exploit addresses (explicitly, so there's a clear admin
record even though one was already auto-blocked) and unblock every other
currently-blocked player.

Usage:
    BACKEND_URL=https://your-backend-url ADMIN_KEY=your-admin-key python3 moderate_blocked_players.py

    Add --dry-run to see what it would do without changing anything.

Safe to re-run: block/unblock are both idempotent on the backend.
"""
import os
import sys
import requests

BACKEND_URL = os.environ.get("BACKEND_URL", "").rstrip("/")
ADMIN_KEY = os.environ.get("ADMIN_KEY", "")
DRY_RUN = "--dry-run" in sys.argv

# Both of these were confirmed in this investigation: same exploit signature
# (rapid_treat_creation), both auto-blocked by anti_cheat for it.
#   - 0x664186...ffFa: original address, also re-attempted treat creation
#     after being blocked (403 logged) — confirmed still active.
#   - TG_8484213476: separate account, same exploit, auto-blocked at
#     risk_score=55 (9 violations/24h).
# If you want to give either a pass, just remove it from this set.
CONFIRMED_EXPLOITERS = {
    "0x664186B0b57CAcb5359039db35F632b91a33ffFa",
    
}
BLOCK_REASON = "Confirmed rapid_treat_creation exploit - permanent block"

if not BACKEND_URL or not ADMIN_KEY:
    sys.exit("Set BACKEND_URL and ADMIN_KEY environment variables before running.")

HEADERS = {"X-Admin-Key": ADMIN_KEY, "Content-Type": "application/json"}


def get_blocked_players():
    resp = requests.get(f"{BACKEND_URL}/api/admin/blocked-players", headers=HEADERS)
    resp.raise_for_status()
    return resp.json()["blocked_players"]


def block(address, reason):
    if DRY_RUN:
        return {"message": f"[dry-run] would block {address}"}
    resp = requests.post(
        f"{BACKEND_URL}/api/admin/block-player",
        headers=HEADERS,
        json={"address": address, "reason": reason},
    )
    resp.raise_for_status()
    return resp.json()


def unblock(address):
    if DRY_RUN:
        return {"message": f"[dry-run] would unblock {address}"}
    resp = requests.post(
        f"{BACKEND_URL}/api/admin/unblock-player",
        headers=HEADERS,
        json={"address": address},
    )
    resp.raise_for_status()
    return resp.json()


def main():
    if DRY_RUN:
        print("=== DRY RUN — no changes will be made ===\n")

    # 1. Make sure every confirmed exploiter is explicitly, deliberately
    #    blocked (idempotent even if auto-block already caught them).
    for address in CONFIRMED_EXPLOITERS:
        result = block(address, BLOCK_REASON)
        print(f"Blocked (confirmed): {address} -> {result['message']}")

    # 2. Unblock everyone else currently on the list.
    blocked = get_blocked_players()
    print(f"\nFound {len(blocked)} currently blocked player(s).")

    others_found = False
    for record in blocked:
        address = record.get("player_address")
        if address in CONFIRMED_EXPLOITERS:
            print(f"Skipping (staying blocked): {address}")
            continue
        others_found = True
        result = unblock(address)
        print(f"Unblocked: {address} -> {result['message']}")

    if not others_found:
        print("No other blocked players found — everyone currently blocked was a confirmed exploiter.")


if __name__ == "__main__":
    main()
