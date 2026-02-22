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
- Professional banner on lab page

### Extra Life Payment Success Modal (Feb 22, 2026)
- Modal turns GREEN when payment is confirmed (gradient: green-600 → emerald-800)
- Shows CheckCircle2 icon, "Payment Confirmed!" heading, "+X Treats" count
- "Continue Mixing" CTA button to dismiss
- Stores treats_amount in purchaseResult for display after pendingPurchase is cleared

### Player Stats Card Sharing (Feb 22, 2026)
- **Save Stats**: Uses html2canvas to capture stats card as PNG image, downloads or uses Web Share API
- **Share on X**: Opens Twitter intent URL with pre-formatted stats text (name, level, rank, points, streak)
- Both buttons at bottom of PlayerStatsModal with proper data-testids

### UI Redesigns
- KernelOfWow card: Professional slate-800 with amber accents
- Game Mechanisms page: Sky blue dark theme
- Music Player: Yellow/sky-blue theme, minimized by default
- MainMenu cards: TreatIcon removed from Treats card, Marketplace button text fixed to white

### Payment Systems
- Unique Amount System for precise payment matching
- Auto-Payment Detection via Tatum API v3

## Deployment Info
- **Frontend**: https://dogefoodlab.vercel.app (LIVE)
- **Backend**: https://dogefood-lab-api.onrender.com (LIVE)
- **GitHub**: Geovanio007/DogeFoodLab + Geovanio007/dogefood-lab-backend

## Pending Issues
1. Invisible grey text on Telegram (P2 - needs user details)

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, Lucide React, html2canvas
- Backend: Python, FastAPI, MongoDB (Motor async)
- Deploy: Vercel (frontend), Render (backend)

## Last Updated
February 22, 2026 - Extra Life green success modal + Stats card sharing deployed
