# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards. The game includes:
- Auto-Mixer Subscription Feature with DOGE payments
- Token holder verification ($DOGEONEWS on Solana)
- NFT holder verification (DogeFood on DogeOS)
- Professional UI without emojis
- Real-time stats dashboard

## What's Been Implemented

### Core Game Features
- Treat mixing system with ingredients
- Rarity-based treat outcomes (Common, Uncommon, Rare, Epic, Legendary)
- XP and leveling system
- Streak bonuses for consecutive play
- Leaderboard with $LAB token rewards

### Auto-Mixer Subscription
- 30 DOGE/month subscription
- BlockCypher-based payment verification
- Background task for automated treat creation
- Agent respects all game limits (4 treats per 6h + streak bonuses)
- Real-time stats dashboard

### UI/UX Updates (Dec 2025)
- **Emoji Cleanup**: Removed all emojis from UI text (stars, beakers, trophies, etc.)
- Replaced with Lucide React icons where needed (Crown, Trophy, Beaker, Check, etc.)
- Sky-blue theme implementation
- Professional look without emoji characters

### Authentication
- Wallet connection (wagmi)
- Guest/Email/Firebase login
- Telegram authentication

### Blockchain Integrations
- DOGE payment verification (BlockCypher)
- DogeOS NFT verification (Blockscout API)
- Solana wallet linking (frontend UI implemented)

## Deployment Info
- **Frontend**: Vercel (https://dogefoodlab.vercel.app)
- **Backend**: Render
- **Database**: MongoDB

## Pending Features/Issues

### P0 - Critical
1. **Solana Token Verification** - Backend endpoint is placeholder, needs real Helius API integration
   - Token: `GHoZwXKEJSsTYeNmBPgQFuKsjVGJ1HMGv5QghtQVdoge`
   - Required: 1,000,000+ tokens for eligibility

### P1 - Important
1. **Invisible Grey Text on Telegram** - Needs investigation
2. **Backend Refactoring** - server.py is 6000+ lines, needs modularization

### P2 - Nice to Have
1. More comprehensive testing
2. Additional ingredient types
3. Special event system

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, Lucide React
- **Backend**: Python, FastAPI, MongoDB (Beanie ODM)
- **Blockchain**: wagmi, BlockCypher, Solana Web3.js
- **Deployment**: Vercel (frontend), Render (backend)

## API Endpoints
- `POST /api/auto-mixer/verify-payment` - Verify DOGE transaction
- `GET /api/auto-mixer/agent-status` - Get agent stats
- `POST /api/player/link-solana` - Link Solana wallet
- `POST /api/player/verify-solana-holdings` - Verify token holdings (placeholder)

## Last Updated
December 2025 - Emoji cleanup completed and deployed
