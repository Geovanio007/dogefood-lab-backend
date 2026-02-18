# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards. Features include DOGE-based payments for subscriptions and extra lives.

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
- DOGE payment verification (BlockCypher + Tatum)

#### Extra Life Feature
- 3 Package Tiers:
  - Basic Pack: 2 treats for 10 DOGE
  - Standard Pack: 4 treats for 20 DOGE
  - Premium Pack: 6 treats for 35 DOGE

#### AUTO-PAYMENT DETECTION (Fixed Feb 2026)
- **Tatum API Integration**: Auto-detects incoming DOGE payments using v3 REST API
- **No TX Hash Required**: Players just send DOGE, system auto-activates
- **1 Block Confirmation**: Fast activation after 1 confirmation
- **Background Task**: Checks for payments every 30 seconds
- **Test Data Protection**: Excludes test addresses (TEST_/test_/D_test_) from matching
- **Unmatched Re-check**: When new orders are created, automatically checks unmatched payments
- **Transaction Tracking**: All seen transactions (matched, unmatched, not-incoming) are tracked in processed_payments collection

### Blockchain Integrations
- DOGE payment verification (BlockCypher + Tatum)
- DogeOS NFT verification
- Solana $DOGEONEWS token verification (Helius API)

## Deployment Info
- **Frontend**: https://dogefoodlab.vercel.app (LIVE)
- **Backend**: https://dogefood-lab-api.onrender.com (Render deployment fixed)
- **Preview Backend**: Working with auto-payment detection

## API Keys Required
- `TATUM_API_KEY`: t-6993114e22bda23826c9a014-331bea5c43d540f09d01a110
- `HELIUS_API_KEY`: e0f50cba-ac9c-4e88-b291-f780d88dfb12

## Recent Fixes (Feb 18, 2026)
1. **Auto-payment matching fixed**: Now uses Tatum v3 REST API format directly (outputs[].address/value), cleaned 48 test data records polluting matching
2. **Render deployment fixed**: Added lightweight /health and / endpoints (no DB dependency), delayed background tasks 30s, added healthCheckPath in render.yaml
3. **New endpoint**: POST /api/payments/recheck-unmatched - re-processes unmatched payments
4. **Auto-match on order create**: When new extra-life purchase is created, system checks for existing unmatched payments

## Pending Issues
1. **Invisible grey text on Telegram**: Needs user screenshot/details
2. **Refactoring needed**: server.py is 7500+ lines, needs modular breakdown

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, Lucide React
- **Backend**: Python, FastAPI, MongoDB (Motor async driver)
- **Blockchain**: BlockCypher, Tatum, Helius APIs

## Last Updated
February 18, 2026 - Auto-payment detection fixed, Render deployment fixed
