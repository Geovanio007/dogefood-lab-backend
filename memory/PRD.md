# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards. Features include DOGE-based payments for subscriptions and extra lives.

## What's Been Implemented

### Core Game Features
- Treat mixing system with ingredients, rarity-based outcomes, XP/leveling, streak bonuses, leaderboards
- Dark mode by default

### NFT Holder Verification System (Feb 22, 2026) - FIXED
- **Batch verification endpoint**: `POST /api/admin/verify-all-nft-holders`
- **Server-side blockchain fallback**: `POST /api/verify-nft/{address}`
- **Result**: 24 previously uncredited NFT holders received their 500 bonus points and VIP status

### Player Count Alignment (Feb 22, 2026) - FIXED
- Aligned `/api/stats`, `/api/player/{address}/profile`, and `/api/leaderboard` to use identical filter

### Happy Hour Feature (Feb 21, 2026)
- Daily at 15:00 UTC for 1 hour, +25% bonus points on treats collected
- `GET /api/happy-hour/status` endpoint with countdown

### Main Menu Redesign (Feb 24, 2026) - COMPLETE
- Complete redesign with professional dark theme, 3-column layout, live chat, responsive mobile

### Timestamp Fix (Feb 26, 2026) - FIXED
- **Root cause**: `datetime.utcnow()` produced naive datetimes without timezone info; browsers interpreted as local time
- **Fix**: Replaced all `datetime.utcnow()` with `datetime.now(timezone.utc)` globally (70+ instances)
- **Serialization**: Activity feed and chat timestamps now always include UTC marker ('Z' suffix)
- **Helper function**: Added `parse_utc_datetime()` to safely handle both old naive and new aware datetimes from MongoDB
- **Result**: All "time ago" displays in activity feed and chat are now accurate

### Happy Hour Bonus UI Feedback (Feb 26, 2026) - FIXED
- **Root cause**: Backend correctly calculated +25% bonus but frontend never displayed it to users
- **Fix**: Frontend collect animation now shows actual bonus points from API response (not just base points)
- **Added**: Yellow "Happy Hour +X Bonus Points!" text in collect animation when bonus is active

### Kernel of Wow Selection Fix (Feb 26, 2026) - FIXED
- **Root cause**: MongoDB query used duplicate `$ne` keys in Python dict — second overwrites first, allowing None nicknames
- **Fix**: Changed all queries to use `$nin: [None, ""]` for proper filtering
- **Also fixed**: Admin endpoint `/api/special-ingredient/select-random` now requires valid nickname
- **Deactivated**: Invalid "Anonymous" holder with placeholder address
- **Result**: New selection correctly picked "Ramzes" (a real active player)

### Extra Life Payment Success Modal (Feb 22, 2026)
- Modal turns GREEN when payment confirmed

### Player Stats Card Sharing (Feb 22, 2026)
- Save Stats (html2canvas PNG) + Share on X

### Payment Systems
- Unique Amount System for precise payment matching
- Auto-Payment Detection via Tatum API v3

## Deployment Info
- **Frontend**: https://dogefoodlab.vercel.app (LIVE)
- **Backend**: https://dogefood-lab-api.onrender.com (LIVE)
- **GitHub**: Geovanio007/DogeFoodLab + Geovanio007/dogefood-lab-backend

## Pending Issues
1. Invisible grey text on Telegram (P2 - needs user details/screenshot)

## Upcoming Tasks
1. (P1) Implement referral program system ("Refer & Earn" card exists on main menu)

## Future Tasks
1. Refactor monolithic `backend/server.py` into smaller route-based modules
2. Break down large `MainMenu.jsx` (900+ lines) into sub-components

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, Lucide React, html2canvas
- Backend: Python, FastAPI, MongoDB (Motor async), httpx (blockchain API calls)
- Deploy: Vercel (frontend), Render (backend)

## Last Updated
February 26, 2026 - Fixed timestamps (UTC markers), Happy Hour bonus UI feedback, Kernel of Wow anonymous player selection. All deployed.
