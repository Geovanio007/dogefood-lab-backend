# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards. Features include DOGE-based payments for subscriptions and extra lives.

## What's Been Implemented

### Core Game Features
- Treat mixing system with ingredients, rarity-based outcomes, XP/leveling, streak bonuses, leaderboards
- Dark mode by default

### NFT Holder Verification System (Feb 22, 2026) - FIXED
- **Batch verification endpoint**: `POST /api/admin/verify-all-nft-holders` — scans ALL wallet-based players against DogeOS blockchain, credits 500 points + VIP status to uncredited holders
- **Server-side blockchain fallback**: `POST /api/verify-nft/{address}` now double-checks on-chain via Blockscout API when frontend reports `is_holder=false`, preventing frontend detection failures
- **Result**: 24 previously uncredited NFT holders received their 500 bonus points and VIP status

### Player Count Alignment (Feb 22, 2026) - FIXED
- **Root cause**: Stats card counted all players with points > 0 (35), but leaderboard required points > 0 AND valid nickname (32)
- **Fix**: Aligned `/api/stats`, `/api/player/{address}/profile`, and `/api/leaderboard` to use identical filter: `{points > 0, nickname exists & non-empty}`
- **Leaderboard limit**: Increased default from 50 to 200 to show all eligible players
- **Result**: All three endpoints now return consistent count (52 players)

### Happy Hour Feature (Feb 21, 2026)
- Daily at 15:00 UTC for 1 hour, +25% bonus points on treats collected
- `GET /api/happy-hour/status` endpoint with countdown

### Extra Life Payment Success Modal (Feb 22, 2026)
- Modal turns GREEN when payment confirmed with CheckCircle2 icon and "+X Treats" confirmation

### Player Stats Card Sharing (Feb 22, 2026)
- Save Stats (html2canvas PNG) + Share on X (Twitter intent) buttons

### Payment Systems
- Unique Amount System for precise payment matching
- Auto-Payment Detection via Tatum API v3

## Deployment Info
- **Frontend**: https://dogefoodlab.vercel.app (LIVE)
- **Backend**: https://dogefood-lab-api.onrender.com (LIVE)
- **GitHub**: Geovanio007/DogeFoodLab + Geovanio007/dogefood-lab-backend

## Pending Issues
1. Invisible grey text on Telegram (P2 - needs user details)

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, Lucide React, html2canvas
- Backend: Python, FastAPI, MongoDB (Motor async), httpx (blockchain API calls)
- Deploy: Vercel (frontend), Render (backend)

## Last Updated
February 22, 2026 - NFT holder batch verification + player count alignment fix deployed
