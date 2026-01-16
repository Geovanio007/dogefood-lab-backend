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
- **Content**: 
  - How Mixing Works (1-5 ingredients, combos, experimentation)
  - Ingredient Secrets (Proteins, Vegetables, Fruits, Dairy, Grains effects)
  - Rarity Hints (diversity = higher chance, 5 ingredients max potential)
  - Pro Tips (streaks, rare treats, sack completion)
- **Design**: Purple gradient, expandable

#### 3. Your Stats on Lab Page (Implemented: Jan 16, 2026)
- **Location**: XP bar area - "Your Stats" link
- **Function**: Opens PlayerStatsModal for current player
- **Same design as leaderboard stats modal

#### 4. Consistent Typography System (Implemented: Jan 13, 2026)
- Fredoka (titles) + Nunito (body)

#### 5. Player Stats Modal (Implemented: Jan 13, 2026)
- Click player names on Leaderboard/Lab
- 7-day stats, rarity breakdown, daily chart

#### 6. Streak Bonus System (Implemented: Jan 12, 2026)
- Tiers: New Chef → Master Scientist (30 days)
- Bonuses: +treats, XP multiplier, faster brewing

#### 7. Video Celebration on Treat Creation

#### 8. Game Mechanics
- Character selection, ingredient mixing, rarity tiers, brewing

#### 9. Web3 Integration
- DogeOS Chikyū Testnet, NFT verification

### Pending Features

#### P0 - Critical
- [ ] Fix game sound effects

#### P1 - High Priority
- [ ] Points-to-$LAB token conversion
- [ ] Activate $LAB purchases

## Deployment
- Frontend: https://app-eight-bay-35.vercel.app
- Backend: https://dogefood-lab-api.onrender.com

## Limit System Details
```
Window: 4 treats / 6 hours
Daily Max: 16 treats / 24 hours
Streak Bonus: +1 to +3 treats per window
Extra Life: +3 treats (5000 $LAB)
```

## Last Updated
January 16, 2026
