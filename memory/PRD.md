# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards. Features include DOGE-based payments for subscriptions and extra lives.

## What's Been Implemented

### Core Game Features
- Treat mixing system with ingredients, rarity-based outcomes, XP/leveling, streak bonuses, leaderboards

### Payment Systems

#### Auto-Mixer Subscription
- 30 DOGE/month subscription with unique amounts per order
- DOGE payment verification (BlockCypher + Tatum)

#### Extra Life Feature
- Basic Pack: 2 treats for ~10 DOGE, Standard: 4 for ~20 DOGE, Premium: 6 for ~35 DOGE
- Each order gets a unique amount (e.g., 10.037 DOGE) for precise matching

#### AUTO-PAYMENT DETECTION (Fixed Feb 18, 2026)
- **Unique Amount System**: Each order gets a distinct amount (base + 0.001-0.099 offset) so payments are matched 1:1 to specific orders - no more collisions
- **Tatum API v3 REST**: Auto-detects incoming DOGE payments using outputs[].address/value
- **Precise Matching**: Matches by unique_amount with 0.001 tolerance, falls back to base amount for legacy orders
- **Background Task**: Checks every 30 seconds, marks all seen transactions
- **Re-check on Create**: When a new order is created, unmatched payments are automatically re-checked
- **POST /api/payments/recheck-unmatched**: Manually re-process unmatched payments

### Blockchain Integrations
- DOGE: BlockCypher + Tatum APIs
- DogeOS NFT verification
- Solana $DOGEONEWS token: Helius API

## Deployment Info
- **Frontend**: https://dogefoodlab.vercel.app (LIVE)
- **Backend**: https://dogefood-lab-api.onrender.com (LIVE)
- **Vercel Project**: dogefood-lab-game (prj_f88xKrAGRj2wWFoFQLYsXrB1Gd1k)
- **Render Service**: dogefood-lab-api (srv-d595m3khg0os73c5cil0), healthCheckPath: /health
- **GitHub**: Geovanio007/DogeFoodLab (main) + Geovanio007/dogefood-lab-backend

## Pending Issues
1. **Invisible grey text on Telegram**: Needs user screenshot/details

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, Lucide React
- Backend: Python, FastAPI, MongoDB (Motor async), asyncio background tasks
- Blockchain: BlockCypher, Tatum, Helius APIs
- Deploy: Vercel (frontend), Render (backend)

## Last Updated
February 18, 2026 - Unique payment amounts system deployed to production
