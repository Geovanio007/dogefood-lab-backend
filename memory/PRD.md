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
- Fixed MongoDB query duplicate `$ne` key bug -> now uses `$nin: [None, ""]`
- Deactivated invalid "Anonymous" holder, new selection picks real active players

### Leaderboard Redesign (Feb 26, 2026) - COMPLETE
- Full visual overhaul: dark navy theme (#0a0f1a), 3D card effects, sky blue accents
- Season countdown, $LAB distribution breakdown, performance stats, reward tiers

### Routing Fixes (Feb 26, 2026) - FIXED
- Auto-Mix card now routes to `/auto-mixer` (was `/settings`)
- Added `/auto-mixer` route in App.js for AutoMixerSubscription component

### Leaderboard Mobile & UI Polish (Feb 26, 2026) - COMPLETE
- Mobile layout: Player name on first line, badges on second line for full visibility
- Distribution grid: Responsive 3-col on mobile, 5-col on desktop
- $DOGEONEWS token logo restored on HOLDER badge, VIP badge white

### Performance Optimization v1 (Feb 26, 2026) - COMPLETE
- Leaderboard: 32s -> 0.5s (64x faster)
- Chat Messages: 52s -> 0.2s (260x faster)
- DB Indexes, asyncio.gather parallelization, MongoDB aggregation pipelines

### P0 Verification & Stability Patch (Feb 26, 2026) - COMPLETE
- Unified active-player logic, TG_/tg_ case-tolerant handling

### Performance Optimization v2 (Feb 27, 2026) - COMPLETE
- Treat creation: consolidated 15+ sequential DB queries into ~5 parallelized
- Frontend: React.lazy route splitting, debounced recipe validation, parallelized API calls
- Bug fixes: duplicate key race condition, HTTPException wrapping

### Auto-Mixer Subscription Expiry Fix (Mar 2, 2026) - COMPLETE
- **Bug**: Auto-mixer agent was creating treats for expired subscriptions due to naive/aware datetime comparison failures when comparing `subscription_end` (stored as naive datetime or ISO string in MongoDB) with `datetime.now(timezone.utc)`.
- **Fix**: All subscription_end comparisons now go through `parse_utc_datetime()` to normalize timezone-awareness. Processor loop and trigger-now both fetch ALL "active" status subs and manually filter by date.
- **Auto-expiry**: When expired subscriptions are detected, they are bulk-updated to `status: "expired"` immediately.
- **Endpoints fixed**: `/api/auto-mixer/agent-status`, `/api/auto-mixer/subscription/{address}`, `/api/auto-mixer/detailed-stats/{address}`, `/api/auto-mixer/trigger-now`, `auto_mixer_processor_loop()`.
- **Subscription expiry notification**: Backend returns `expiring_soon: true` and `days_remaining` when subscription has ≤5 days left. Frontend shows amber warning bar on both AutoMixerSubscription page and GameLabRedesign page with "Renew Now" button.
- Verified via testing agent `/app/test_reports/iteration_16.json`: 10/10 backend tests passed, all frontend pages load without errors.

## Deployment Info
- **Frontend**: https://dogefoodlab.vercel.app (LIVE)
- **Backend**: https://dogefood-lab-api.onrender.com (LIVE)
- **GitHub**: Geovanio007/DogeFoodLab + Geovanio007/dogefood-lab-backend
- **render-backend/**: Synced copy of backend for Render deployment

## Pending Issues
1. Invisible grey text on Telegram (P2 - needs user details/screenshot)

## Upcoming Tasks
1. (P1) Implement referral program system ("Refer & Earn" card exists on main menu)

## Future Tasks
1. Refactor monolithic `backend/server.py` into smaller route-based modules
2. Break down large `GameLabRedesign.jsx` (1600+ lines) into sub-components
3. Break down `MainMenu.js` (1200+ lines) into sub-components

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, Lucide React, html2canvas, wagmi (Web3)
- Backend: Python, FastAPI, MongoDB (Motor async), httpx (blockchain API calls)
- Deploy: Vercel (frontend), Render (backend)

## Last Updated
March 2, 2026 - Auto-Mixer subscription expiry fix complete. Expired subscriptions properly filtered and auto-expired. Notification bar added for subscriptions expiring within 5 days.
