# DogeFood Lab - Product Requirements Document

## Original Problem Statement
DogeFood Lab is a Web3-powered treat creation game where players become scientists mixing cosmic ingredients to craft unique treats. Players compete on leaderboards, level up, discover secret recipes, and prepare for $LAB token rewards.

## Core Requirements
- Web3 game with treat creation mechanics
- NFT holder verification with bonus rewards (DogeOS network)
- Telegram notifications for timer events
- Leaderboard and competition system
- Auto-Mixer subscription feature (30 DOGE/month)

## Tech Stack
- **Frontend**: React.js (deployed on Vercel)
- **Backend**: Python FastAPI (deployed on Render)
- **Database**: MongoDB Atlas
- **Payments**: DOGE via multi-API verification (BlockCypher, SoChain, DogeChain)

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
└── render-backend/       # Render deployment folder (synced)
```

## What's Been Implemented

### Session: February 2, 2026 (Latest)
1. **Auto-Mixer 429 Error Fix** - COMPLETED & TESTED
   - Implemented multi-API fallback verification (BlockCypher → SoChain → DogeChain)
   - Added exponential backoff retry logic (1s, 2s, 4s)
   - Implemented transaction caching in `db.tx_verifications`
   - Returns user-friendly error messages (503 for rate limits)
   - All 13 backend tests passed (100%)

2. **Funds Tracking Dashboard** - COMPLETED
   - Backend endpoint `/api/auto-mixer/funds-stats` working
   - Real-time 80/20 split display (buy/burn vs dev)
   - FundsBreakdown component integrated in frontend

3. **Render-Backend Sync** - COMPLETED
   - Copied latest server.py with fallback verification
   - Synced services folder

### Previous Session: February 2, 2026
1. **Frontend Deployment Fix (P0)** - COMPLETED
2. **Auto-Mixer Subscription Feature** - COMPLETED
3. **Color Scheme Update** - COMPLETED (Sky Blue theme)
4. **Calendar Date Picker** - COMPLETED
5. **Dark Mode Support** - COMPLETED
6. **NFT Holder Logic (DogeOS)** - COMPLETED

## API Endpoints (Auto-Mixer)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/auto-mixer/config` | GET | Get subscription config | ✅ Working |
| `/api/auto-mixer/create-subscription` | POST | Create pending subscription | ✅ Working |
| `/api/auto-mixer/verify-payment` | POST | Verify DOGE payment (multi-API) | ✅ Fixed |
| `/api/auto-mixer/subscription/{address}` | GET | Get subscription status | ✅ Working |
| `/api/auto-mixer/update-window` | POST | Update mixing window | ✅ Working |
| `/api/auto-mixer/funds-stats` | GET | Get 80/20 fund split | ✅ Working |
| `/api/auto-mixer/history/{address}` | GET | Get mix history | ✅ Working |

## Pending Issues
1. **Invisible Grey Text on Telegram (P2)** - Needs user clarification about which service/bot is affected

## Deployment Info
- Frontend: https://dogefoodlab.vercel.app (Vercel)
- Backend: https://dogefood-lab-api.onrender.com (Render)
- Payment Address: DMxBXyfQbkCoZJyFoKMksjn9epLTwhHAyE
- NFT Contract: DogeOS Testnet

## Test Reports
- Latest: `/app/test_reports/iteration_3.json` - 100% pass rate
- All auto-mixer features validated
- 429 fix confirmed working

## Known Technical Details
- Transaction verification uses 3 fallback APIs with exponential backoff
- Cached verifications stored in `db.tx_verifications` collection
- Minimum subscription window: 1 hour, Maximum: 6 hours
- NFT holders credited only after selecting character (no placeholder accounts)
