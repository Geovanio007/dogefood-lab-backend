# DogeFood Lab Game - Product Requirements Document

## Original Problem Statement
Build and maintain a Web3-enabled game called "DogeFood Lab" where players create treats, earn points, compete on leaderboards, and earn $LAB tokens.

## Deployment URLs
- **Frontend (Vercel)**: https://dogefoodlab.vercel.app
- **Backend (Render)**: https://dogefood-lab-api.onrender.com

## Recent Updates

### Notification System (Jan 18, 2026)
- **Push Notifications**: Users can opt-in to receive notifications
- **Telegram Notifications**: Sends via Telegram bot for TG users
- **Web Push**: Browser push notifications for desktop/mobile
- **Notification Types**:
  - Treat ready to collect
  - Daily limit reset (can create more treats)
- **Settings Page**: Full control over notification preferences
- **Permission Prompt**: Shows after 10 seconds of gameplay (once per session)

### Leaderboard Points Fix (Jan 18, 2026)
- Fixed "Your Performance" card to show actual points from leaderboard data
- Removed outdated NFT holder tip message

### Update Notification System (Jan 18, 2026)
- Green-themed update notification card
- Card disappears immediately on tap
- Only appears when new version is detected
- Zero hard-refresh needed for users

### Brewing Sound Update (Jan 18, 2026)
- Custom cauldron-boiling sound for mixing ingredients

### Volume Bug Fix (Jan 18, 2026)
- Fixed critical IndexSizeError with HTML5 audio volume
- Separated localStorage keys for different audio contexts

### Music Player Feature (Jan 17, 2026)
- **Playlist**: 3 game music tracks (electronic, ambient, sci-fi)
- **Pages**: Displays on Menu, Leaderboard, and Treats pages
- **Autoplay**: Starts when player joins the game
- **Controls**: Play/Pause, Skip, Volume, Progress bar
- **Minimize**: Starts minimized by default
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
- ✅ Push Notification System (Telegram + Web)
- ✅ Zero Hard-Refresh Update System
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
