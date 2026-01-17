# DogeFood Lab Game - Product Requirements Document

## Original Problem Statement
Build and maintain a Web3-enabled game called "DogeFood Lab" where players create treats, earn points, compete on leaderboards, and earn $LAB tokens.

## Deployment URLs
- **Frontend (Vercel)**: https://app-eight-bay-35.vercel.app
- **Backend (Render)**: https://dogefood-lab-api.onrender.com

## Recent Updates (Jan 17, 2026)

### UI Improvements for Telegram Mini App
1. **Menu Cards Redesign**: Changed from tall vertical cards to compact square cards
   - Smaller icons (w-10 h-10 on mobile)
   - `aspect-square` layout on mobile
   - Reduced padding and margins
   - Professional compact buttons

2. **Modal Compactness**: 
   - PlayerStatsModal: max-w-sm, max-h-[85vh], compact stats layout
   - StreakModal: max-w-xs, compact tier list
   - ExtraLifeModal: max-w-xs, condensed info

3. **Audio System Fix**: Rewrote AudioContext.jsx with proper Web Audio API handling

## Auto-Deploy Setup
Both repositories have native GitHub integrations:
- **Vercel**: Auto-deploys on push to `main` branch of DogeFoodLab repo
- **Render**: Auto-deploys on push to `main` branch of dogefood-lab-backend repo

### Manual Deploy via API:
```bash
# Vercel
curl -X POST -H "Authorization: Bearer $VERCEL_TOKEN" \
  -d '{"project":"prj_qZTKov7tn0gLSoP7Dw9scqPtyfVf","target":"production","gitSource":{"type":"github","ref":"main"}}' \
  "https://api.vercel.com/v13/deployments"

# Render
curl -X POST -H "Authorization: Bearer $RENDER_TOKEN" \
  "https://api.render.com/v1/services/srv-d595m3khg0os73c5cil0/deploys"
```

## Core Features

### Implemented
- ✅ Treat creation with 4/6h window limit (max 16/day)
- ✅ Streak bonus system (tiers from New Chef to Master Scientist)
- ✅ Player Stats Modal with 7-day activity chart
- ✅ Compact mobile UI for Telegram Mini App
- ✅ Audio system with Web Audio API
- ✅ Leaderboard with $LAB rewards display
- ✅ NFT verification and VIP status

### Pending
- ⏳ Test sound effects on live deployment
- ⏳ Points-to-$LAB token conversion
- ⏳ Activate $LAB purchases for Extra Life

## Technical Stack
- Frontend: React, Tailwind CSS, Shadcn UI
- Backend: FastAPI, MongoDB
- Deployment: Vercel (FE), Render (BE)
- Blockchain: DogeOS Chikyū Testnet

## Last Updated
January 17, 2026
