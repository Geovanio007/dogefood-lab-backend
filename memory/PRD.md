# DogeFood Lab Game - Product Requirements Document

## Original Problem Statement
Build and maintain a Web3-enabled game called "DogeFood Lab" where players create treats, earn points, compete on leaderboards, and earn $LAB tokens. The game runs on DogeOS Chikyū Testnet.

## Core Features

### Implemented Features

#### 1. Anti-Cheat System with Daily Treat Limit (Implemented: Jan 12, 2026)
- **Daily Limit**: Players can create max 5 treats per 24 hours
- **Extra Life Purchase**: Option to buy 3 additional treats for 5,000 $LAB
- **Status**: $LAB token not yet live - purchase shows "Coming Soon"
- **UI**: Daily Limit Tracker in game lab header shows remaining treats
- **API Endpoints**:
  - `GET /api/daily-status/{address}` - Get player's daily treat status
  - `POST /api/extra-life/{address}` - Purchase extra life (placeholder)

#### 2. Game Mechanics
- Character selection (Max, Rex, Luna) with unique bonuses
- Ingredient mixing system with 5 categories
- Rarity tiers: Common, Uncommon, Rare, Epic, Legendary, Mythic
- Treat brewing with timers
- Points and XP rewards on treat collection
- Sack completion bonus (every 5 treats = +50 XP)

#### 3. Authentication
- Firebase Auth (Email/Google)
- Wallet connection (WalletConnect)
- Telegram Mini App support
- Guest mode

#### 4. Web3 Integration
- DogeOS Chikyū Testnet (Chain ID: 6281971)
- NFT verification for VIP status
- 500 point bonus for NFT holders

### Pending Features

#### P0 - Critical
- [ ] Fix game sound effects (code exists but not playing)

#### P1 - High Priority
- [ ] Points-to-$LAB token conversion system
- [ ] Complete Web3 reward claiming
- [ ] Activate $LAB token purchases for extra lives

#### P2 - Medium Priority
- [ ] Merkle tree generation for rewards
- [ ] Policy for returning unclaimed tokens
- [ ] Discovery achievements for new treat combinations

## Technical Architecture

### Frontend
- React.js with Tailwind CSS
- Shadcn/UI components
- Wagmi for Web3
- Deployed on Vercel

### Backend
- FastAPI (Python)
- MongoDB Atlas
- Deployed on Render

### Key Files
- `/app/backend/services/anti_cheat.py` - Daily limit logic
- `/app/frontend/src/components/DailyLimitTracker.jsx` - Daily limit UI
- `/app/frontend/src/components/GameLabRedesign.jsx` - Main game interface

## Test Reports
- `/app/test_reports/iteration_1.json` - Anti-cheat system tests (8/8 passed)

## Deployment
- Frontend: GitHub → Vercel (auto-deploy)
- Backend: GitHub → Render (auto-deploy)
- Note: Backend Render deployments can be fragile

## Last Updated
January 12, 2026
