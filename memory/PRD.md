# DogeFood Lab Game - Product Requirements Document

## Original Problem Statement
Build and maintain a Web3-enabled game called "DogeFood Lab" where players create treats, earn points, compete on leaderboards, and earn $LAB tokens. The game runs on DogeOS Chikyū Testnet.

## Core Features

### Implemented Features

#### 1. Player Stats Modal (Implemented: Jan 13, 2026)
- **Trigger**: Click on any player name in the Leaderboard
- **Design**: NBA Player of the Week inspired, dark slate theme
- **Stats shown (Last 7 Days)**:
  - Treats created, Points earned, XP gained, Unique recipes
  - Streak info (current, longest, title)
  - Best rarity found
  - Rarity breakdown (Common to Mythic)
  - Daily activity bar chart
  - Averages (treats/day, points/day)
- **API**: `GET /api/player-stats/{address}`

#### 2. Streak Bonus System (Implemented: Jan 12, 2026)
- **Daily Streak Tracking**: Tracks consecutive days of play
- **Streak Tiers with Bonuses**:
  - Day 1: New Chef - Base rewards
  - Day 3: Rising Star - +1 bonus treat, 1.1x XP, 5% faster brewing
  - Day 5: Dedicated Chef - +1 bonus treat, 1.15x XP, 10% faster brewing
  - Day 7: Week Warrior - +2 bonus treats, 1.2x XP, 15% faster brewing
  - Day 14: Lab Legend - +2 bonus treats, 1.3x XP, 20% faster brewing
  - Day 30: Master Scientist - +3 bonus treats, 1.5x XP, 25% faster brewing
- **UI**: Clickable streak badge (dark green theme), tier progress modal

#### 3. Video Celebration on Treat Creation (Implemented: Jan 12, 2026)
- Animated Shiba Inu eating from DOGEFOOD bowl plays on success

#### 4. Anti-Cheat System with Daily Treat Limit (Implemented: Jan 12, 2026)
- **Daily Limit**: 5 treats per 24 hours + streak bonus treats
- **Extra Life Purchase**: ❤️ 3 additional treats for 5,000 $LAB (Coming Soon)

#### 5. Game Mechanics
- Character selection (Max, Rex, Luna) with unique bonuses
- Ingredient mixing system with 5 categories
- Rarity tiers: Common, Uncommon, Rare, Epic, Legendary, Mythic
- Treat brewing with timers (reduced by streak bonus)
- Points and XP rewards (multiplied by streak bonus)

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
- `/app/backend/server.py` - API endpoints including player-stats
- `/app/frontend/src/components/PlayerStatsModal.jsx` - Player stats modal
- `/app/frontend/src/components/DailyLimitTracker.jsx` - Daily limit & streak UI
- `/app/frontend/src/components/Leaderboard.jsx` - Leaderboard with clickable names

## Last Updated
January 13, 2026
