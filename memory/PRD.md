# DogeFood Lab Game - Product Requirements Document

## Original Problem Statement
Build and maintain a Web3-enabled game called "DogeFood Lab" where players create treats, earn points, compete on leaderboards, and earn $LAB tokens. The game runs on DogeOS Chikyū Testnet.

## Core Features

### Implemented Features

#### 1. Consistent Typography System (Implemented: Jan 13, 2026)
- **Font Hierarchy**:
  - Display/Titles: Fredoka (playful, bold)
  - Headers: Fredoka (impactful)
  - Body/UI: Nunito (clean, readable)
  - Mono: System mono (addresses, codes)
- **Applied across**: Landing page, loading screen, menu, game lab, leaderboard, modals
- **Mobile responsive**: Scaled appropriately for all screen sizes

#### 2. Player Stats Modal (Implemented: Jan 13, 2026)
- **Trigger**: Click on any player name in the Leaderboard
- **Fixed Layout**: X close button always visible (red, floating)
- **Stats shown (Last 7 Days)**: Treats, Points, XP, Recipes, Streak, Rarity breakdown

#### 3. Streak Bonus System (Implemented: Jan 12, 2026)
- **Streak Tiers**: New Chef → Master Scientist (30 days)
- **Bonuses**: +1-3 treats, 1.0x-1.5x XP, 0-25% faster brewing
- **UI**: Dark green modal, clickable badge

#### 4. Video Celebration on Treat Creation (Implemented: Jan 12, 2026)
- Animated Shiba Inu eating from DOGEFOOD bowl

#### 5. Anti-Cheat System with Daily Limit (Implemented: Jan 12, 2026)
- 5 treats/day + streak bonus + extra life (❤️ 5000 $LAB - Coming Soon)

#### 6. Game Mechanics
- Character selection, ingredient mixing, rarity tiers, brewing timers

#### 7. Web3 Integration
- DogeOS Chikyū Testnet, NFT verification, VIP bonus

### Pending Features

#### P0 - Critical
- [ ] Fix game sound effects

#### P1 - High Priority
- [ ] Points-to-$LAB token conversion
- [ ] Activate $LAB token purchases

## Deployment
- Frontend: https://app-eight-bay-35.vercel.app
- Backend: https://dogefood-lab-api.onrender.com

## Typography System
```css
--font-display: 'Fredoka' (titles, logos)
--font-heading: 'Fredoka' (headers, buttons)
--font-body: 'Nunito' (paragraphs, UI text)
--font-mono: system mono (addresses)
```

## Last Updated
January 13, 2026
