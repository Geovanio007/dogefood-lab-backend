# DogeFood Lab - Product Requirements Document

## Original Problem Statement
Build a Web3-based game called "DogeFood Lab" where players mix ingredients to create "Dogetreats", compete on leaderboards, and earn rewards. Features include DOGE-based payments for subscriptions and extra lives.

## What's Been Implemented

### Core Game Features
- Treat mixing system with ingredients, rarity-based outcomes, XP/leveling, streak bonuses, leaderboards
- Dark mode by default (synced localStorage key between ThemeContext and Settings)
- All star icons replaced with circle icon throughout UI

### UI Redesigns (Feb 21, 2026)
- **Music Player**: Yellow/sky-blue/white color theme with gradient accent bar, animated equalizer bars, yellow play button
- **Scientist Profile Card**: Professional game card with slate-900 bg, yellow/sky accent bar, clean stats bar, dot grid pattern overlay
- **Season Card**: Professional game card matching profile style, clean countdown timer with per-unit color coding, status indicators
- **All emojis removed** from MainMenu cards and replaced with Lucide icons

### Auto-Mixer Agent
- Points/XP correctly use game engine keys, ingredients randomized, character bonuses applied

### Payment Systems
- Unique Amount System for precise 1:1 payment matching
- Auto-Payment Detection via Tatum API v3, 30s polling

### Blockchain Integrations
- DOGE: BlockCypher + Tatum APIs
- DogeOS NFT verification
- Solana $DOGEONEWS token: Helius API

## Deployment Info
- **Frontend**: https://dogefoodlab.vercel.app (LIVE)
- **Backend**: https://dogefood-lab-api.onrender.com (LIVE)
- **GitHub**: Geovanio007/DogeFoodLab + Geovanio007/dogefood-lab-backend

## Pending Issues
1. **Invisible grey text on Telegram**: Needs user screenshot/details

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, Lucide React
- Backend: Python, FastAPI, MongoDB (Motor async), asyncio background tasks
- Deploy: Vercel (frontend), Render (backend)

## Last Updated
February 21, 2026 - Music player, profile card, season card redesign deployed
