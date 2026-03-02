# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards. Features include DOGE-based payments for subscriptions and extra lives.

## What's Been Implemented

### Core Game Features
- Treat mixing system with ingredients, rarity-based outcomes, XP/leveling, streak bonuses, leaderboards
- Dark mode by default

### NFT Holder Verification System (Feb 22, 2026) - FIXED
- Batch verification endpoint, server-side blockchain fallback

### Player Count Alignment (Feb 22, 2026) - FIXED
- Aligned `/api/stats`, `/api/player/{address}/profile`, and `/api/leaderboard` to use identical filter

### Happy Hour Feature (Feb 21, 2026) - COMPLETE
- Daily at 15:00 UTC for 1 hour, +25% bonus points on treats collected

### Main Menu Redesign (Feb 24, 2026) - COMPLETE
- Professional dark theme, 3-column layout, live chat, responsive mobile

### Timestamp Fix (Feb 26, 2026) - FIXED
- All datetime.utcnow() replaced with datetime.now(timezone.utc)

### Happy Hour Bonus UI Feedback (Feb 26, 2026) - FIXED

### Kernel of Wow Selection Fix (Feb 26, 2026) - FIXED

### Leaderboard Redesign (Feb 26, 2026) - COMPLETE
- Dark navy theme, 3D card effects, sky blue accents, mobile responsive

### Routing Fixes (Feb 26, 2026) - FIXED

### Performance Optimization v1 (Feb 26, 2026) - COMPLETE
- Leaderboard: 32s -> 0.5s, Chat: 52s -> 0.2s, DB indexes, asyncio parallelization

### P0 Verification & Stability Patch (Feb 26, 2026) - COMPLETE

### Performance Optimization v2 (Feb 27, 2026) - COMPLETE
- Treat creation: 15+ sequential DB queries -> ~5 parallel
- Frontend: React.lazy route splitting, debounced recipe validation

### Auto-Mixer Subscription Expiry Fix (Mar 2, 2026) - COMPLETE
- Fixed naive/aware datetime comparison bug causing expired subscriptions to still auto-mix
- Auto-expiry: expired subscriptions bulk-updated to `status: "expired"`
- Added `expiring_soon` (≤5 days) notification on both AutoMixer and GameLab pages

### Spin the Wheel Feature (Mar 2, 2026) - COMPLETE
- **New feature**: Fun spin-the-wheel game on the Lab page
- **Design**: Colorful canvas-based wheel with 9 prize segments, gold border, amber pointer, confetti celebration
- **Prizes**: 100/150/200/300/500 Points, 2/4 Extra Lives, Mythic Ingredient (24h), 2x Next Treat — weighted random selection
- **Cooldown**: 1 free spin every 24 hours, enforced on backend with 429 rate limit
- **UI**: Minimized floating button (bounces when free spin available) → Modal with animated wheel
- **Backend**: `GET /api/spin-wheel/status/{address}`, `POST /api/spin-wheel/spin`
- **Rewards applied**: Points added to player.points, extra lives to player.extra_treats_balance, mythic ingredient and 2x buffs stored in spin_wheel_buffs collection
- **Verified**: 9/9 backend tests passed, all frontend elements confirmed (iteration_17)

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
1. Refactor monolithic `backend/server.py` into route-based modules
2. Break down large `GameLabRedesign.jsx` (1600+ lines) and `MainMenu.js` (1200+ lines)

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, Lucide React, html2canvas, wagmi (Web3)
- Backend: Python, FastAPI, MongoDB (Motor async), httpx
- Deploy: Vercel (frontend), Render (backend)

## Last Updated
March 2, 2026 - Spin the Wheel feature complete. Auto-Mixer subscription expiry fix complete.
