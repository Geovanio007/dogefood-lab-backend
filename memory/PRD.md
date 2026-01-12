# DogeFood Lab Game - Product Requirements Document

## Original Problem Statement
Build and maintain a Web3-enabled game called "DogeFood Lab" where players create treats, earn points, compete on leaderboards, and earn $LAB tokens. The game runs on DogeOS Chikyū Testnet.

## Core Features

### Implemented Features

#### 1. Streak Bonus System (Implemented: Jan 12, 2026)
- **Daily Streak Tracking**: Tracks consecutive days of play
- **Streak Tiers with Bonuses**:
  - Day 1: New Chef - Base rewards
  - Day 3: Rising Star - +1 bonus treat, 1.1x XP, 5% faster brewing
  - Day 5: Dedicated Chef - +1 bonus treat, 1.15x XP, 10% faster brewing
  - Day 7: Week Warrior - +2 bonus treats, 1.2x XP, 15% faster brewing
  - Day 14: Lab Legend - +2 bonus treats, 1.3x XP, 20% faster brewing
  - Day 30: Master Scientist - +3 bonus treats, 1.5x XP, 25% faster brewing
- **UI**: Clickable streak badge in game header, detailed streak modal with tier progress
- **API**: `GET /api/streak/{address}` - Get player streak info

#### 2. Video Celebration on Treat Creation (Implemented: Jan 12, 2026)
- Animated Shiba Inu eating from DOGEFOOD bowl plays on treat creation success
- Shows streak progress, XP multiplier, brewing speed bonus
- Displays sack progress and daily treats remaining

#### 3. Anti-Cheat System with Daily Treat Limit (Implemented: Jan 12, 2026)
- **Daily Limit**: 5 treats per 24 hours + streak bonus treats
- **Extra Life Purchase**: Option to buy 3 additional treats for 5,000 $LAB
- **Status**: $LAB token not yet live - purchase shows "Coming Soon"
- **API Endpoints**:
  - `GET /api/daily-status/{address}` - Get player's daily treat status with streak bonus
  - `POST /api/extra-life/{address}` - Purchase extra life (placeholder)

#### 4. Game Mechanics
- Character selection (Max, Rex, Luna) with unique bonuses
- Ingredient mixing system with 5 categories
- Rarity tiers: Common, Uncommon, Rare, Epic, Legendary, Mythic
- Treat brewing with timers (reduced by streak bonus)
- Points and XP rewards (multiplied by streak bonus)
- Sack completion bonus (every 5 treats = +50 XP)

#### 5. Authentication
- Firebase Auth (Email/Google)
- Wallet connection (WalletConnect)
- Telegram Mini App support
- Guest mode

#### 6. Web3 Integration
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
- Deployed on Vercel: https://app-eight-bay-35.vercel.app

### Backend
- FastAPI (Python)
- MongoDB Atlas
- Deployed on Render: https://dogefood-lab-api.onrender.com

### Key Files
- `/app/backend/services/anti_cheat.py` - Daily limit & streak logic
- `/app/frontend/src/components/DailyLimitTracker.jsx` - Daily limit & streak UI
- `/app/frontend/src/components/GameLabRedesign.jsx` - Main game interface with video celebration

## Test Reports
- `/app/test_reports/iteration_1.json` - Anti-cheat system tests (8/8 passed)

## Deployment
- Frontend: GitHub → Vercel (auto-deploy)
- Backend: GitHub → Render (rootDir: backend/)

## Assets
- Celebration Video: https://customer-assets.emergentagent.com/job_dogefood-game/artifacts/kq5xkxn7_grok_video_2026-01-09-23-54-31.mp4

## Last Updated
January 12, 2026
