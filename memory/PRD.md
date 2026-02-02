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

### Session: February 2, 2026
1. **Frontend Deployment Fix (P0)** - COMPLETED
   - Identified issue: Changes pushed to wrong Vercel project
   - Fixed vercel.json config (removed conflicting routes/headers)
   - Successfully deployed to dogefoodlab.vercel.app

2. **Auto-Mixer Subscription Feature** - COMPLETED
   - Backend: Created subscription CRUD endpoints
   - Backend: DOGE payment verification via BlockCypher API
   - Backend: Background task for auto-mixing treats
   - Frontend: Settings page redesign with 4 tabs (General, Auto-Mixer, Audio, Account)
   - Frontend: Time window selector with visual timeline
   - Frontend: Payment flow with address copy and verification
   - Frontend: Real-time fund distribution display (80% buy & burn, 20% dev)

3. **Color Scheme Update** - COMPLETED
   - Changed entire Settings and Auto-Mixer UI from orange to sky blue
   - Updated gradients, icons, buttons, and borders

### Previous Sessions
- Backend stability fix (APScheduler → asyncio)
- NFT verification endpoint fix
- Telegram notification system
- Admin endpoint for manual NFT holder crediting
- Game mechanisms page content update

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

## Test Reports
- `/app/test_reports/iteration_2.json` - Auto-Mixer feature testing (100% pass)
