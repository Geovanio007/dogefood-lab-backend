# DogeFood Lab - Product Requirements Document

## Original Problem Statement
DogeFood Lab is a Web3-powered treat creation game where players become scientists mixing cosmic ingredients to craft unique treats. Players compete on leaderboards, level up, discover secret recipes, and prepare for $LAB token rewards.

## Tech Stack
- **Frontend**: React.js (deployed on Vercel)
- **Backend**: Python FastAPI (deployed on Render)
- **Database**: MongoDB Atlas
- **Payments**: DOGE via BlockCypher API

## What's Been Implemented

### Session: February 3, 2026 (Latest)

1. **Auto-Mixer Agent NOW WORKING** ✅
   - Fixed method calls: `get_unlocked_ingredients()` and `calculate_treat_outcome()`
   - Agent now creates real treats for subscribed players
   - Added `/api/auto-mixer/trigger-now` endpoint for manual testing
   - Comprehensive logging for debugging

2. **Treat Naming Fixed** ✅
   - Changed from random names ("Nebula Biscuit") to rarity-based ("Common Treat", "Rare Treat", etc.)
   - Matches the game's standard naming convention

3. **Auto-Mixer Banner on Main Menu** ✅
   - Professional gradient banner (sky-blue to indigo)
   - Shows ACTIVE status with pulsing green indicator
   - Clicking navigates to Auto-Mixer tab in Settings
   - Responsive design for mobile/Telegram

### Previous Session: February 2, 2026
- DOGE verification fix (BlockCypher fallback)
- Agent stats dashboard (global + player-specific)
- Settings dark mode and sky blue theme

## API Endpoints (Auto-Mixer)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/auto-mixer/config` | GET | Get subscription config | ✅ |
| `/api/auto-mixer/create-subscription` | POST | Create pending subscription | ✅ |
| `/api/auto-mixer/verify-payment` | POST | Verify DOGE payment | ✅ |
| `/api/auto-mixer/agent-status` | GET | Global agent status | ✅ |
| `/api/auto-mixer/detailed-stats/{address}` | GET | Player stats | ✅ |
| `/api/auto-mixer/trigger-now` | POST | **NEW** Manual trigger for testing | ✅ |

## Auto-Mixer Agent Behavior
- Runs every **10 minutes**
- Creates up to **2 mixes per hour** per subscriber
- Only mixes during player's configured **time window**
- Treats are created as **"ready"** status (immediately collectible)
- Treat names follow rarity format: "Common Treat", "Rare Treat", etc.

## Deployment Info
- Frontend: https://dogefoodlab.vercel.app (Vercel)
- Backend: https://dogefood-lab-api.onrender.com (Render)
- Payment Address: DMxBXyfQbkCoZJyFoKMksjn9epLTwhHAyE

## Pending Issues
1. **Invisible Grey Text on Telegram (P2)** - Needs user clarification
