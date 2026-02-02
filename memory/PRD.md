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
- **Payments**: DOGE via BlockCypher API

## What's Been Implemented

### Session: February 2, 2026 (Latest)

1. **Auto-Mixer Agent Status Dashboard** - COMPLETED & DEPLOYED
   - New `/api/auto-mixer/agent-status` endpoint with comprehensive metrics
   - New `/api/auto-mixer/detailed-stats/{player}` for player-specific stats
   - Beautiful AgentStatsCard UI component showing:
     - ACTIVE status with animated indicator
     - Run interval, active subscribers, in-window count
     - 24h activity (mixes, points, XP)
     - Rarity distribution breakdown
     - Top ingredients (7 days)
     - System health and next run time
   - PlayerMixerStats component for subscribed users showing:
     - Subscription progress bar with days remaining
     - Lifetime stats (total mixes, points, XP, best rarity)
     - Personal rarity collection
     - Recent auto-mixes with time ago
   - Stats visible even without wallet connection
   - Real-time polling every 30 seconds

2. **DOGE Verification Fix** - COMPLETED & DEPLOYED
   - Uses BlockCypher exclusively (most reliable)
   - Two verification methods: Direct TX + Address lookup
   - Increased timeouts, better retry logic

## API Endpoints (Auto-Mixer)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/auto-mixer/config` | GET | Get subscription config | ✅ |
| `/api/auto-mixer/create-subscription` | POST | Create pending subscription | ✅ |
| `/api/auto-mixer/verify-payment` | POST | Verify DOGE payment | ✅ |
| `/api/auto-mixer/subscription/{address}` | GET | Get subscription status | ✅ |
| `/api/auto-mixer/update-window` | POST | Update mixing window | ✅ |
| `/api/auto-mixer/funds-stats` | GET | Get 80/20 fund split | ✅ |
| `/api/auto-mixer/history/{address}` | GET | Get mix history | ✅ |
| `/api/auto-mixer/agent-status` | GET | **NEW** Global agent status | ✅ |
| `/api/auto-mixer/detailed-stats/{address}` | GET | **NEW** Player stats | ✅ |

## Agent Stats Response Structure
```json
{
  "agent_status": "ACTIVE",
  "current_time_utc": "2026-02-02T15:39:20",
  "next_run_time_utc": "2026-02-02T15:40:20",
  "run_interval_minutes": 10,
  "mixes_per_hour_config": 2,
  "subscribers": {
    "total_active": 2,
    "currently_in_window": 1,
    "outside_window": 1
  },
  "activity_24h": {
    "total_mixes": 0,
    "mixes_last_hour": 0,
    "total_points_awarded": 0,
    "total_xp_awarded": 0
  },
  "rarity_distribution_24h": {...},
  "top_ingredients_7d": [...],
  "performance": {
    "uptime_status": "healthy",
    "last_error": null
  }
}
```

## Pending Issues
1. **Invisible Grey Text on Telegram (P2)** - Needs user clarification

## Deployment Info
- Frontend: https://dogefoodlab.vercel.app (Vercel)
- Backend: https://dogefood-lab-api.onrender.com (Render)
- Payment Address: DMxBXyfQbkCoZJyFoKMksjn9epLTwhHAyE
