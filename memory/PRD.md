# DogeFood Lab Game - Product Requirements Document

## Original Problem Statement
Build and maintain a Web3-enabled game called "DogeFood Lab" where players create treats, earn points, compete on leaderboards, and earn $LAB tokens.

## Deployment URLs
- **Frontend (Vercel)**: https://dogefoodlab.vercel.app
- **Backend (Render)**: https://dogefood-lab-api.onrender.com

## Recent Updates

### Tournament System (Jan 18, 2026) - NEW
- **Treat Masters Champions League**: In-season knockout tournament
- **Qualification**: Top 8 leaderboard players qualify
- **Format**: Knockout bracket (QF → SF → Final)
- **Match Rules**: 48-hour battles, Treats + Points determine winner
- **Stages**: Quarterfinals (8→4), Semifinals (4→2), Grand Final (2→1)
- **Prizes**: $LAB/DOGE rewards + Champion title
- **Frontend**: Full tournament page with bracket visualization
- **Backend**: Complete tournament API with match management

### Music Player Expanded (Jan 18, 2026)
- **8 tracks** now in playlist (added 5 new songs)
- **Shuffle enabled by default**
- **Shuffle button** added to player controls
- **Track counter** shows position (e.g., "3/8")

### Guest User Auth Fix (Jan 18, 2026)
- Users must now connect wallet OR sign up as guest
- Each guest gets unique ID (GUEST_XXXXXX)
- Auth modal when accessing Lab without authentication
- Removed shared "GUEST_USER" issue

### Notification System (Jan 18, 2026)
- Push notifications for treat ready & limit reset
- Telegram bot notifications for TG users
- Settings page with notification controls

### Update Notification (Jan 18, 2026)
- Green-themed card, 24h cooldown per version
- Only shows for actual new deployments

## Core Features

### Implemented
- ✅ **Tournament System** - Treat Masters Champions League
- ✅ Push Notification System (Telegram + Web)
- ✅ Zero Hard-Refresh Update System
- ✅ Music Player with 8-track shuffled playlist
- ✅ Music Player with 3-track playlist
- ✅ Treat creation with 4/6h window limit (max 16/day)
- ✅ Streak bonus system
- ✅ Player Stats Modal with 7-day activity chart
- ✅ Compact mobile UI for Telegram Mini App
- ✅ Leaderboard with $LAB rewards display
- ✅ NFT verification and VIP status
- ✅ In-game Scientist Chat with upvotes

### Pending
- ⏳ Points-to-$LAB token conversion
- ⏳ Activate $LAB purchases for Extra Life

## Technical Components

### Notification System
- **NotificationContext.jsx**: State management for notification preferences
- **NotificationPrompt.jsx**: UI for enabling notifications + settings panel
- **Backend endpoints**: /api/notifications/* for subscription management
- **Telegram Bot**: Sends notifications via bot token
- **Service Worker**: Handles web push notifications

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
