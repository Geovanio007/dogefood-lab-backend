# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards.

## What's Been Implemented

### Core Game Features
- Treat mixing system with ingredients
- Rarity-based treat outcomes
- XP and leveling system
- Streak bonuses
- Leaderboard with rewards

### Payment Systems

#### Auto-Mixer Subscription
- 30 DOGE/month subscription
- DOGE payment verification

#### Extra Life Feature
- 3 Package Tiers:
  - Basic Pack: 2 treats for 10 DOGE
  - Standard Pack: 4 treats for 20 DOGE
  - Premium Pack: 6 treats for 35 DOGE

#### AUTO-PAYMENT DETECTION (NEW - Feb 2025)
- **Tatum API Integration**: Auto-detects incoming DOGE payments
- **No TX Hash Required**: Players just send DOGE, system auto-activates
- **1 Block Confirmation**: Fast activation after 1 confirmation
- **Background Task**: Checks for payments every 30 seconds
- **Status**: Working on preview, Render deployment needs debugging

### Blockchain Integrations
- DOGE payment verification (BlockCypher + Tatum)
- DogeOS NFT verification
- Solana $DOGEONEWS token verification (Helius API)

## Deployment Info
- **Frontend**: https://dogefoodlab.vercel.app (LIVE)
- **Backend**: https://dogefood-lab-api.onrender.com (Previous version running)
- **Preview Backend**: Working with auto-payment detection

## API Keys Required
- `TATUM_API_KEY`: t-6993114e22bda23826c9a014-331bea5c43d540f09d01a110

## Pending Issues
1. **Render Deployment**: Auto-payment feature causing health check failures
   - Fix: Need to debug startup timing or remove feature for Render
2. **Invisible grey text on Telegram**: Needs user screenshot

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, Lucide React
- **Backend**: Python, FastAPI, MongoDB
- **Blockchain**: BlockCypher, Tatum, Helius APIs

## Last Updated
February 18, 2025 - Auto-payment detection implemented
