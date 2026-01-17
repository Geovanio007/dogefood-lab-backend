# DogeFood Lab Game - Product Requirements Document

## Original Problem Statement
Build and maintain a Web3-enabled game called "DogeFood Lab" where players create treats, earn points, compete on leaderboards, and earn $LAB tokens. The game runs on DogeOS Chikyū Testnet.

## Core Features

### Implemented Features

#### 1. New Treat Limit System (Implemented: Jan 16, 2026)
- **Window System**: 4 treats per 6-hour window
- **Daily Cap**: Maximum 16 treats per 24 hours
- **Reset**: Timer starts from first treat in window
- **Extra Life**: ❤️ +3 treats for 5,000 $LAB (Coming Soon)

#### 2. Tips & Guide Section (Implemented: Jan 16, 2026)
- **Location**: Collapsible section on Lab page
- **Content**: Mixing, Ingredients, Rarity, Pro Tips
- **Design**: Purple gradient, expandable

#### 3. Your Stats on Lab Page (Implemented: Jan 16, 2026)
- **Location**: XP bar area - "Your Stats" link
- **Function**: Opens PlayerStatsModal for current player

#### 4. Compact Modal UI for Telegram (Implemented: Jan 17, 2026)
- **PlayerStatsModal**: Reduced height, compact layout, fits on 320x500 viewport
- **StreakModal**: Smaller emoji, compact tier list, reduced padding
- **ExtraLifeModal**: Compact design, mobile-first layout
- All modals now centered and professional-looking on small screens

#### 5. Audio System Improvements (Implemented: Jan 17, 2026)
- **Web Audio API**: Proper browser audio context handling
- **Unlock on interaction**: Audio unlocked on first user interaction
- **Sound effects**: click, brewing, success, rare, collect, levelUp

#### 6. Player Stats Modal (Implemented: Jan 13, 2026)
- Click player names on Leaderboard/Lab
- 7-day stats, rarity breakdown, daily chart

#### 7. Streak Bonus System (Implemented: Jan 12, 2026)
- Tiers: New Chef → Master Scientist (30 days)
- Bonuses: +treats, XP multiplier, faster brewing

#### 8. Game Mechanics
- Character selection, ingredient mixing, rarity tiers, brewing

#### 9. Web3 Integration
- DogeOS Chikyū Testnet, NFT verification

### Pending Features

#### P0 - Critical
- [ ] Test sound effects on live deployment

#### P1 - High Priority  
- [ ] Points-to-$LAB token conversion
- [ ] Activate $LAB purchases

## Deployment
- Frontend: Vercel (via GitHub)
- Backend: Render
- Database: MongoDB Atlas

## Limit System Details
```
Window: 4 treats / 6 hours
Daily Max: 16 treats / 24 hours
Streak Bonus: +1 to +3 treats per window
Extra Life: +3 treats (5000 $LAB)
```

## Recent Changes (Jan 17, 2026)
1. **Modal UI Improvements**: Made PlayerStatsModal, StreakModal, and ExtraLifeModal more compact for Telegram Mini App
2. **Audio System Fix**: Rewrote AudioContext.jsx with proper Web Audio API and browser unlock handling
3. **Daily Activity Chart**: Verified working - data aggregation from backend is functional

## Technical Notes
- Daily Activity chart data comes from `/api/player-stats/{address}` endpoint
- Sound files located at `/app/frontend/public/sounds/`
- Modals use `max-w-xs` and `max-w-sm` for compact mobile-first design

## Last Updated
January 17, 2026
