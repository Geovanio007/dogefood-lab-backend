# DogeFood Lab Game - Product Requirements Document

## Original Problem Statement
Build and maintain a Web3-enabled game called "DogeFood Lab" where players create treats, earn points, compete on leaderboards, and earn $LAB tokens.

## Deployment URLs
- **Frontend (Vercel)**: https://app-eight-bay-35.vercel.app
- **Backend (Render)**: https://dogefood-lab-api.onrender.com

## Recent Updates

### Music Player Feature (Jan 17, 2026)
- **Playlist**: 5 game music tracks (electronic, ambient, sci-fi)
- **Pages**: Displays on Menu, Leaderboard, and Treats pages
- **Autoplay**: Starts when player joins the game
- **Controls**: Play/Pause, Skip, Volume, Progress bar
- **Minimize**: Can be minimized to a floating button
- **Transparent Design**: On-theme glass-morphism styling

### Points Consistency Fix (Jan 17, 2026)
- Fixed PlayerStatsModal to show total points matching leaderboard
- Labels clarified: "Total Pts", "7d XP", "7d Pts"

### UI Improvements for Telegram (Jan 17, 2026)
- Menu cards redesigned to compact square layout
- All modals made more compact for mobile/Telegram
- Audio system fixed with proper Web Audio API

## Core Features

### Implemented
- ✅ Music Player with 5-track playlist
- ✅ Treat creation with 4/6h window limit (max 16/day)
- ✅ Streak bonus system
- ✅ Player Stats Modal with 7-day activity chart
- ✅ Compact mobile UI for Telegram Mini App
- ✅ Leaderboard with $LAB rewards display
- ✅ NFT verification and VIP status

### Pending
- ⏳ Points-to-$LAB token conversion
- ⏳ Activate $LAB purchases for Extra Life

## Technical Components

### Music System
- **MusicContext.jsx**: State management for playlist, playback
- **MusicPlayer.jsx**: UI component with controls
- Tracks stored on customer-assets CDN

## Deploy Commands
```bash
# Vercel
curl -X POST -H "Authorization: Bearer $VERCEL_TOKEN" \
  -d '{"project":"prj_qZTKov7tn0gLSoP7Dw9scqPtyfVf","target":"production","gitSource":{"type":"github","repoId":"1124230948","ref":"main"}}' \
  "https://api.vercel.com/v13/deployments"

# Render
curl -X POST -H "Authorization: Bearer $RENDER_TOKEN" \
  "https://api.render.com/v1/services/srv-d595m3khg0os73c5cil0/deploys"
```

## Last Updated
January 17, 2026
