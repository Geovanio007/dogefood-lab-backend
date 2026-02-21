# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards. Features include DOGE-based payments for subscriptions and extra lives.

## What's Been Implemented

### Core Game Features
- Treat mixing system with ingredients, rarity-based outcomes, XP/leveling, streak bonuses, leaderboards
- Dark mode by default (synced localStorage key between ThemeContext and Settings)
- All sparkle/star icons removed from UI throughout

### Happy Hour Feature (Feb 21, 2026)
- **Daily at 15:00 UTC for 1 hour**, all players get **+25% bonus points** on treats collected
- Backend: `GET /api/happy-hour/status` returns active/inactive status with countdown timing
- Backend: Bonus applied automatically in `collect_treat` endpoint
- Frontend: Professional `HappyHourBanner` component on lab page with live countdown
- Active state: Yellow/amber gradient banner with "Happy Hour Live" + time remaining
- Upcoming state: Subtle slate banner with countdown to next happy hour

### UI Redesigns (Feb 21, 2026)
- **Music Player**: Yellow/sky-blue/white color theme, minimized by default, auto-plays on MainMenu, stops on GameLab
- **Scientist Profile Card**: Professional game card with slate-900 bg, yellow/sky accent bar
- **Season Card**: Professional countdown timer with per-unit color coding
- **All emojis removed** from MainMenu cards, replaced with Lucide icons
- **CircleDot icons** replaced with contextual alternatives (Gem, Crown, TrendingUp, etc.) where appropriate

### Auto-Mixer Agent
- Points/XP correctly use game engine keys, ingredients randomized, character bonuses applied

### Payment Systems
- Unique Amount System for precise 1:1 payment matching
- Auto-Payment Detection via Tatum API v3, 30s polling

### Blockchain Integrations
- DOGE: BlockCypher + Tatum APIs
- DogeOS NFT verification
- Solana $DOGEONEWS token: Helius API

## Deployment Info
- **Frontend**: https://dogefoodlab.vercel.app (LIVE - deployed Feb 21, 2026)
- **Backend**: https://dogefood-lab-api.onrender.com (LIVE - deployed Feb 21, 2026)
- **GitHub**: Geovanio007/DogeFoodLab + Geovanio007/dogefood-lab-backend

## Pending Issues
1. **Invisible grey text on Telegram**: Needs user screenshot/details (P2)

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, Lucide React
- Backend: Python, FastAPI, MongoDB (Motor async), asyncio background tasks
- Deploy: Vercel (frontend), Render (backend)

## Last Updated
February 21, 2026 - Happy Hour feature deployed, icon cleanup, all deployments live
