# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards. Features include DOGE-based payments for subscriptions and extra lives.

## What's Been Implemented

### Core Game Features
- Treat mixing system with ingredients, rarity-based outcomes, XP/leveling, streak bonuses, leaderboards
- Dark mode by default

### NFT Holder Verification System (Feb 22, 2026) - FIXED
- Batch verification endpoint, server-side blockchain fallback
- 24 previously uncredited NFT holders received their 500 bonus points and VIP status

### Player Count Alignment (Feb 22, 2026) - FIXED
- Aligned `/api/stats`, `/api/player/{address}/profile`, and `/api/leaderboard` to use identical filter

### Happy Hour Feature (Feb 21, 2026)
- Daily at 15:00 UTC for 1 hour, +25% bonus points on treats collected
- `GET /api/happy-hour/status` endpoint with countdown

### Main Menu Redesign (Feb 24, 2026) - COMPLETE
- Complete redesign with professional dark theme, 3-column layout, live chat, responsive mobile

### Timestamp Fix (Feb 26, 2026) - FIXED
- Replaced all `datetime.utcnow()` with `datetime.now(timezone.utc)` globally
- Activity feed and chat timestamps now always include UTC marker ('Z' suffix)
- Added `parse_utc_datetime()` helper for safe naive/aware datetime handling

### Happy Hour Bonus UI Feedback (Feb 26, 2026) - FIXED
- Frontend collect animation now shows actual bonus points from API response
- Added yellow "Happy Hour +X Bonus Points!" indicator

### Kernel of Wow Selection Fix (Feb 26, 2026) - FIXED
- Fixed MongoDB query duplicate `$ne` key bug → now uses `$nin: [None, ""]`
- Deactivated invalid "Anonymous" holder, new selection picks real active players

### Leaderboard Redesign (Feb 26, 2026) - COMPLETE
- Full visual overhaul: dark navy theme (#0a0f1a), 3D card effects, sky blue accents
- Season countdown, $LAB distribution breakdown, performance stats, reward tiers
- Professional game-like aesthetic matching the main menu

### Routing Fixes (Feb 26, 2026) - FIXED
- Auto-Mix card now routes to `/auto-mixer` (was `/settings`)
- Added `/auto-mixer` route in App.js for AutoMixerSubscription component
- Tournament page verified working at `/tournament`

### Leaderboard Mobile & UI Polish (Feb 26, 2026) - COMPLETE
- Mobile layout: Player name on first line, badges (VIP/HOLDER/Level) on second line for full visibility
- Distribution grid: Responsive 3-col on mobile, 5-col on desktop
- $DOGEONEWS token logo restored on HOLDER badge
- VIP badge changed from yellow to white
- Removed old ScientistChat icon from leaderboard page

### Performance Optimization (Feb 26, 2026) - COMPLETE
- **Leaderboard**: 32s → 0.5s (64x faster) — removed `$or` aggregation, switched to `find()`, added compound index `{points: -1, level: -1}`, removed Pydantic response_model serialization
- **Chat Messages**: 52s → 0.2s (260x faster) — removed `$lookup` aggregation join, use stored nicknames, removed duplicate endpoint
- **Treat Creation**: Parallelized 3 sequential DB queries with `asyncio.gather()`
- **Treat Collection**: Parallelized treat update + player update writes
- **Stats**: Parallelized 5 count queries with `asyncio.gather()`
- **Player Stats**: Replaced 500-doc Python iteration with MongoDB aggregation pipelines
- **Memory fixes**: Admin endpoints reduced from loading 10K-20K docs to targeted queries; `to_list()` buffers matched to actual limits
- **DB Indexes**: Added compound index on players (points, level), indexes on treats (id, creator_address, created_at, status), special_ingredient_holders, chat_messages
- **Frontend**: Collect modal has 6s safety timeout + dismiss button; chat polling reduced from 5s to 10s

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
2. Break down large `MainMenu.js` (1200+ lines) into sub-components

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, Lucide React, html2canvas, wagmi (Web3)
- Backend: Python, FastAPI, MongoDB (Motor async), httpx (blockchain API calls)
- Deploy: Vercel (frontend), Render (backend)

## Last Updated
February 26, 2026 - Leaderboard redesign (3D, sky blue, dark theme), Auto-Mix routing fix, Tournament routing verified. All deployed.
