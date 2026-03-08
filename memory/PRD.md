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

### P0 Gameplay Bug Fixes (Mar 6, 2026) - FIXED
- **Ingredient unlock race condition fixed**: `GameLabRedesign` now fetches player level first, then loads ingredients with the resolved level (no more default Level 1 ingredient lock on initial load)
- **Spin prize mismatch fixed**: backend now returns deterministic spin metadata (`prize_index`, `landing_angle_degrees`, `full_spins`) and frontend rotation uses that server-provided landing angle
- **Verification**: testing report `iteration_18.json` confirms both P0 issues fixed (11/11 backend tests passed + frontend UI validation)

### Wallet Connection Reliability Patch (Mar 6, 2026) - FIXED
- **Network switch UX fix**: main header wrong-network action now uses `openChainModal()` (with fallback to account modal) so users can switch to DogeOS correctly.
- **Service worker stability fix**: removed forced auto-reload on `SW_ACTIVATED`, reduced update polling aggressiveness, and switched static asset strategy to network-first to avoid stale wallet-connect bundles.
- **Wallet metadata hardening**: WalletConnect metadata URL now uses dynamic `window.location.origin`; project ID is sourced directly from env.
- **Verification**: `iteration_19.json` + frontend test agent confirmed connect modal reliability on desktop/mobile and no forced reload interruption during wallet flow.

### Leaderboard + Wallet Modal Reliability Fix (Mar 8, 2026) - FIXED
- **`/api/points/leaderboard` 500 fixed**: patched `get_points_leaderboard()` with null-safe defaults for missing player fields (`points`, `level`, `is_nft_holder`) and safe weekly points summation.
- **Parity fix applied** in both `backend/services/points_system.py` and `render-backend/services/points_system.py`.
- **Wallet options loading issue fixed**: switched RainbowKit to explicit static wallet list and compact modal, disabled dynamic multi-injected discovery to prevent skeleton/blank wallet options on mobile/Telegram-like conditions.
- **Verification**: `iteration_20.json` confirms backend 8/8 tests passing and wallet modal working on desktop + mobile with MetaMask/Coinbase/Rainbow/WalletConnect/Browser Wallet visible.

### Wallet Options Expansion (Mar 8, 2026) - FIXED
- Added **OKX Wallet** as a default top-level wallet option in the connect modal (positioned right after MetaMask).
- Expanded explicit wallet list to improve immediate availability without remote explorer dependency: MetaMask, OKX, Coinbase Wallet, Rainbow, Trust Wallet, Rabby, Phantom, WalletConnect (+ injected fallback).
- **Verification**: `iteration_21.json` confirms no skeleton placeholders and all wallet options render on desktop and mobile; `/api/points/leaderboard` remains 200.

### OKX Trigger Reliability (Mar 8, 2026) - FIXED
- Reworked wallet config to keep OKX in top recommended options while improving extension detection path (`multiInjectedProviderDiscovery: true`).
- Added **Telegram wallet deep-link bridge** to force OKX/WalletConnect URI handling via `Telegram.WebApp.openLink()` fallback (prevents no-op behavior in Telegram webview when custom URI handling is blocked).
- Added OKX mobile deeplink override (`okx://main/wc?uri=...`) via `okxDeepLinkWallet` wrapper for stronger mobile app handoff.
- **Verification**: `iteration_22.json` confirms OKX appears on desktop/mobile and clicking OKX transitions to connect flow (QR/details) instead of no-op; leaderboard API remains 200.

### Telegram Wallet Crash/No-op Mitigation (Mar 8, 2026) - FIXED
- Added **Telegram Safe Connect Mode** in `MainMenu`: when inside Telegram, wallet connect now opens a helper modal instead of immediately launching unstable extension-first flows.
- Telegram helper modal includes explicit actions: Open in MetaMask app, Open in OKX app, Use WalletConnect, Open in external browser.
- Updated `wagmi` config to use Telegram-specific wallet set (`OKX + WalletConnect + Coinbase`) and disable injected wallet discovery in Telegram to avoid MetaMask crash/no-op behavior.
- **Verification**: `iteration_23.json` confirms code-path correctness for Telegram mode and non-Telegram regression safety; backend leaderboard API still 200.

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
March 8, 2026 - Telegram wallet safe mode + Telegram-specific wallet config implemented and verified.
