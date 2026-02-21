# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards. Features include DOGE-based payments for subscriptions and extra lives.

## What's Been Implemented

### Core Game Features
- Treat mixing system with ingredients, rarity-based outcomes, XP/leveling, streak bonuses, leaderboards
- Dark mode by default
- All sparkle/star icons removed from UI

### Happy Hour Feature (Feb 21, 2026)
- Daily at 15:00 UTC for 1 hour, +25% bonus points on treats collected
- `GET /api/happy-hour/status` endpoint with countdown
- Professional banner on lab page (active = amber, upcoming = slate countdown)

### UI Redesigns (Feb 21, 2026)
- **KernelOfWow card**: Redesigned with professional slate-800 background, clear text hierarchy, amber accent header bar, clean bonus tier badges
- **Game Mechanisms page**: Converted from white/amber to sky blue dark theme (#0ea5e9 primary) with dark cards, legible text
- **Music Player**: Yellow/sky-blue theme, minimized by default
- **Season Card**: Professional countdown timer
- **MainMenu cards**: Emoji-free with Lucide icons

### Payment Systems
- Unique Amount System for precise payment matching
- Auto-Payment Detection via Tatum API v3

### Deployment Info
- **Frontend**: https://dogefoodlab.vercel.app (LIVE)
- **Backend**: https://dogefood-lab-api.onrender.com (LIVE)
- **GitHub**: Geovanio007/DogeFoodLab + Geovanio007/dogefood-lab-backend

## Pending Issues
1. **Invisible grey text on Telegram**: Needs user screenshot/details (P2)

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, Lucide React
- Backend: Python, FastAPI, MongoDB (Motor async)
- Deploy: Vercel (frontend), Render (backend)

## Last Updated
February 21, 2026 - KernelOfWow card redesign + Game Mechanisms sky blue theme deployed
