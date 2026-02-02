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
- **Payments**: DOGE via BlockCypher API (most reliable, no Cloudflare)

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
1. **DOGE Verification Fix (CRITICAL)** - COMPLETED & DEPLOYED
   - Removed unreliable APIs (SoChain 502, DogeChain 403 Cloudflare)
   - Uses BlockCypher exclusively (most reliable, no protection)
   - Primary method: Direct transaction lookup
   - Fallback method: Address-based verification (checks address tx history)
   - Increased timeouts to 60s
   - Browser-like headers for compatibility
   - Better retry logic (2s, 4s, 8s backoff)

2. **Previous fixes in this session:**
   - Multi-API fallback verification (refined to BlockCypher only)
   - Transaction caching in `db.tx_verifications`
   - Funds tracking dashboard (80/20 split) working

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
| `/api/auto-mixer/verify-payment` | POST | Verify DOGE payment | ✅ Fixed & Deployed |
| `/api/auto-mixer/subscription/{address}` | GET | Get subscription status | ✅ Working |
| `/api/auto-mixer/update-window` | POST | Update mixing window | ✅ Working |
| `/api/auto-mixer/funds-stats` | GET | Get 80/20 fund split | ✅ Working |
| `/api/auto-mixer/history/{address}` | GET | Get mix history | ✅ Working |

## DOGE Verification Strategy
```
Method 1: BlockCypher Direct TX Lookup
  - URL: api.blockcypher.com/v1/doge/main/txs/{tx_hash}
  - Returns: confirmations, outputs, payment amount
  - Retry: 3 attempts with 2s/4s/8s backoff

Method 2: BlockCypher Address Lookup (Fallback)
  - URL: api.blockcypher.com/v1/doge/main/addrs/{address}
  - Searches tx_hash in address transaction history
  - Useful when direct lookup fails

Removed (Unreliable):
  - SoChain: 502 errors
  - DogeChain.info: Cloudflare 403
  - BlockExplorer.one: Cloudflare 403
```

## Pending Issues
1. **Invisible Grey Text on Telegram (P2)** - Needs user clarification

## Deployment Info
- Frontend: https://dogefoodlab.vercel.app (Vercel)
- Backend: https://dogefood-lab-api.onrender.com (Render)
- Payment Address: DMxBXyfQbkCoZJyFoKMksjn9epLTwhHAyE
- NFT Contract: DogeOS Testnet

## Test Reports
- Latest: `/app/test_reports/iteration_3.json` - 100% pass rate
- DOGE verification tested with real transaction: 58 confirmations ✅
