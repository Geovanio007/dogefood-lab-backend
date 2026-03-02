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

### Performance Optimization v1 (Feb 26, 2026) - COMPLETE
- **Leaderboard**: 32s -> 0.5s (64x faster) -- removed `$or` aggregation, switched to `find()`, added compound index `{points: -1, level: -1}`, removed Pydantic response_model serialization
- **Chat Messages**: 52s -> 0.2s (260x faster) -- removed `$lookup` aggregation join, use stored nicknames, removed duplicate endpoint
- **Treat Creation**: Parallelized 3 sequential DB queries with `asyncio.gather()`
- **Treat Collection**: Parallelized treat update + player update writes
- **Stats**: Parallelized 5 count queries with `asyncio.gather()`
- **Player Stats**: Replaced 500-doc Python iteration with MongoDB aggregation pipelines
- **Memory fixes**: Admin endpoints reduced from loading 10K-20K docs to targeted queries; `to_list()` buffers matched to actual limits
- **DB Indexes**: Added compound index on players (points, level), indexes on treats (id, creator_address, created_at, status), special_ingredient_holders, chat_messages
- **Frontend**: Collect modal has 6s safety timeout + dismiss button; chat polling reduced from 5s to 10s

### P0 Verification & Stability Patch (Feb 26, 2026) - COMPLETE
- Fixed backend startup regression (IndentationError in `backend/server.py`) and restored healthy API service.
- Unified active-player logic so `/api/stats.total_players` matches `/api/leaderboard` by using collected-treat activity criteria and excluding placeholder `GUEST_USER`.
- Added TG_/tg_ case-tolerant handling in treat collect/create flows (`find_player_by_address`, ownership check, player update filter) to prevent Telegram identity mismatch edge-cases.
- Verified via testing agent report `/app/test_reports/iteration_13.json`: backend 13/13 passed, frontend smoke passed, API response times all <2s.

### Performance Optimization v2 (Feb 27, 2026) - COMPLETE
- **Treat Creation**: Consolidated 15+ sequential DB queries into ~5 parallelized ones by prefetching player + recent treats once and passing through anti-cheat validation, streak update, and daily status functions. Response time: ~0.6-1.3s (was reported >60s by user on Render).
- **Treat Collection**: Parallelized treat + player fetch with `asyncio.gather()` at start of endpoint.
- **Player Profile**: Replaced 3 sequential TG_ lookups with centralized `find_player_by_address()`.
- **Anti-Cheat System**: Added `prefetched_player` and `prefetched_treats_24h` params to `get_daily_treat_status`, `validate_treat_creation`, `consume_extra_treat_if_needed`, `update_player_streak` to eliminate duplicate DB round-trips. Added `_compute_streak_from_player()` helper to avoid extra DB call for streak info.
- **New DB Indexes**: Compound indexes `{creator_address: 1, created_at: -1}` for anti-cheat, `{brewing_status: 1, creator_address: 1}` for leaderboard/stats distinct, `{brewing_status: 1, collected_at: -1}` for daily activity count.
- **Frontend Lazy Loading**: Route components (GameLabRedesign, MyTreats, Leaderboard, Settings, AdminDashboard, Tournament, Marketplace, AutoMixerSubscription) loaded with `React.lazy()` + Suspense for faster initial page load.
- **Recipe Validation Debounce**: Added 300ms debounce to ingredient validation API calls (was firing on every click).
- **DailyLimitTracker**: Parallelized daily-status + extra-life-status fetch with `Promise.all()`. Reduced countdown timer from 1s to 60s.
- **Post-creation data reload**: `loadPlayerData()` + `loadActiveTreats()` now run with `Promise.all()` instead of sequentially.
- **Bug fixes during testing**: Fixed duplicate key race condition on new player creation (insert_one -> update_one with upsert), fixed HTTPException wrapping (429s returned as 500s).
- Verified via testing agent `/app/test_reports/iteration_15.json`: 42/42 tests passed, all API response times <2s, frontend lazy loading working.

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
February 27, 2026 - Performance Optimization v2 complete. All 42/42 tests passed. Treat creation optimized from 15+ sequential DB queries to ~5 parallel. Frontend lazy loading and debouncing implemented.
