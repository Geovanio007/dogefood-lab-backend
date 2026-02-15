# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards. The game includes:
- Auto-Mixer Subscription Feature with DOGE payments
- Extra Life Feature with DOGE payments (NEW)
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

### Extra Life Feature (NEW - Feb 2025)
- **3 Package Tiers**:
  - Basic Pack: 2 extra treats for 10 DOGE
  - Standard Pack: 4 extra treats for 20 DOGE
  - Premium Pack: 6 extra treats for 35 DOGE (Best Value!)
- Same payment flow as Auto-Mixer (send DOGE, paste tx hash)
- Extra treats persist across sessions (not daily reset)
- Consumed automatically when player exceeds base window limit

### UI/UX Updates (Dec 2025)
- **Emoji Cleanup**: Removed all emojis from UI text (stars, beakers, trophies, etc.)
- Replaced with Lucide React icons where needed (Crown, Trophy, Beaker, Check, etc.)
- Sky-blue theme implementation
- Professional look without emoji characters

### Security Improvements (Feb 2025)
- Debug endpoint (`/api/auto-mixer/debug-subscriptions`) now requires admin_secret
- All secrets managed via environment variables
- Strict CORS policy enforced

### Authentication
- Wallet connection (wagmi)
- Guest/Email/Firebase login
- Telegram authentication

### Blockchain Integrations
- DOGE payment verification (BlockCypher)
- DogeOS NFT verification (Blockscout API)
- Solana token verification (Helius API) for $DOGEONEWS holders

## Deployment Info
- **Frontend**: Vercel (https://dogefoodlab.vercel.app)
- **Backend**: Render (https://dogefood-lab-api.onrender.com)
- **Database**: MongoDB

## API Endpoints

### Extra Life Endpoints (NEW)
- `GET /api/extra-life/packages` - Get available packages with DOGE pricing
- `POST /api/extra-life/create` - Create pending purchase
- `POST /api/extra-life/verify-payment` - Verify DOGE transaction
- `GET /api/extra-life/status/{player_address}` - Get player's extra life balance
- `DELETE /api/extra-life/cancel/{purchase_id}` - Cancel pending purchase

### Auto-Mixer Endpoints
- `POST /api/auto-mixer/verify-payment` - Verify DOGE transaction
- `GET /api/auto-mixer/agent-status` - Get agent stats
- `POST /api/auto-mixer/create-subscription` - Create subscription
- `GET /api/auto-mixer/subscription/{player_address}` - Get subscription status

### Player Endpoints
- `POST /api/player/link-solana` - Link Solana wallet
- `POST /api/player/verify-solana-holdings` - Verify $DOGEONEWS holdings
- `GET /api/daily-status/{address}` - Get daily treat limits (includes extra_treats_balance)

## Pending Features/Issues

### P1 - Important
1. **Invisible Grey Text on Telegram** - Needs investigation/user screenshot
2. **Backend Refactoring** - server.py is 6500+ lines, needs modularization

### P2 - Nice to Have
1. Notification system for pending subscription reminders
2. More comprehensive testing
3. Additional ingredient types

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, Lucide React
- **Backend**: Python, FastAPI, MongoDB (Beanie ODM)
- **Blockchain**: wagmi, BlockCypher, Solana Web3.js, Helius API
- **Deployment**: Vercel (frontend), Render (backend)

## Last Updated
February 15, 2025 - Extra Life feature with DOGE payments deployed
