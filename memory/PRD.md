# DogeFood Lab - Product Requirements Document

## Original Problem Statement
DogeFood Lab is a Web3-powered treat creation game where players become scientists mixing cosmic ingredients to craft unique treats. Players compete on leaderboards, level up, discover secret recipes, and prepare for $LAB token rewards.

## Core Requirements
- Web3 game with treat creation mechanics
- NFT holder verification with bonus rewards
- Telegram notifications for timer events
- Leaderboard and competition system
- Auto-Mixer subscription feature (30 DOGE/month)

## Tech Stack
- **Frontend**: React.js (deployed on Vercel)
- **Backend**: Python FastAPI (deployed on Render)
- **Database**: MongoDB
- **Payments**: DOGE via BlockCypher API

## Current Architecture
```
/app
├── backend/
│   ├── server.py         # Monolithic FastAPI with all endpoints
│   ├── services/         # Business logic modules
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   └── contexts/     # State management
│   └── public/           # Static assets
└── render-backend/       # Render deployment folder
```

## What's Been Implemented

### Session: February 2, 2026 (Latest)
1. **Calendar Date Picker** - COMPLETED
   - Added date picker for scheduling specific auto-mix days
   - Players can select up to 30 days in advance
   - Visual display of selected dates with remove option

2. **Dark Mode Support** - COMPLETED
   - Full dark mode implementation for Settings page
   - Dark mode toggle in header and Appearance section
   - Preference saved to localStorage
   - All text properly visible in both modes

3. **Text Visibility Fix** - COMPLETED
   - Fixed grey text issues for Telegram dark mode
   - Proper contrast for all text in dark/light modes

### Previous Session: February 2, 2026
1. **Frontend Deployment Fix (P0)** - COMPLETED
2. **Auto-Mixer Subscription Feature** - COMPLETED
3. **Color Scheme Update** - COMPLETED (Sky Blue theme)

## API Endpoints (Auto-Mixer)
- `GET /api/auto-mixer/config` - Configuration
- `POST /api/auto-mixer/create-subscription` - Create subscription
- `POST /api/auto-mixer/verify-payment` - Verify DOGE payment
- `GET /api/auto-mixer/subscription/{address}` - Get subscription
- `POST /api/auto-mixer/update-window` - Update mixing window
- `GET /api/auto-mixer/funds-stats` - Fund distribution stats
- `GET /api/auto-mixer/history/{address}` - Mix history

## Pending Issues (P1)
1. **Manual NFT Holder Crediting** - Needs wallet addresses from user
2. **Test Player Removal** - Needs player addresses from user

## Deployment Info
- Frontend: https://dogefoodlab.vercel.app (Vercel)
- Backend: https://dogefood-lab-api.onrender.com (Render)
- Payment Address: DMxBXyfQbkCoZJyFoKMksjn9epLTwhHAyE
