# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards. Features include DOGE-based payments for subscriptions and extra lives.

## What's Been Implemented

### Core Game Features
- Treat mixing system with ingredients, rarity-based outcomes, XP/leveling, streak bonuses, leaderboards
- Dark mode by default (synced localStorage key between ThemeContext and Settings)
- ◉ icon replaces all ✨ throughout the UI

### Auto-Mixer Agent (Fixed Feb 18, 2026)
- Points/XP correctly use `points_reward` and `xp_reward` keys from game engine
- Ingredients fully randomized each cycle with character bonus support

### Payment Systems
- **Unique Amount System**: Each order gets distinct amount (base + 0.001-0.099) for precise 1:1 matching
- **Auto-Payment Detection**: Tatum API v3, 30s polling, precise unique_amount matching
- **Recheck Unmatched**: POST /api/payments/recheck-unmatched endpoint

### Blockchain Integrations
- DOGE: BlockCypher + Tatum APIs
- DogeOS NFT verification
- Solana $DOGEONEWS token: Helius API

## Deployment Info
- **Frontend**: https://dogefoodlab.vercel.app (LIVE)
- **Backend**: https://dogefood-lab-api.onrender.com (LIVE)
- **GitHub**: Geovanio007/DogeFoodLab + Geovanio007/dogefood-lab-backend

## Pending Issues
1. **Invisible grey text on Telegram**: Needs user screenshot/details

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, Lucide React
- Backend: Python, FastAPI, MongoDB (Motor async), asyncio background tasks
- Deploy: Vercel (frontend), Render (backend)

## Last Updated
February 19, 2026 - Dark mode default, ✨→◉ icon swap, Settings dark mode text fix
