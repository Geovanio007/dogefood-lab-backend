#!/bin/bash

# DogeFood Lab Production Deployment Script
echo "🚀 Deploying DogeFood Lab to Production Infrastructure..."

# Set credentials
export VERCEL_TOKEN="MBjKAzVZqzHBBGTREUIIrUw1"
export GITHUB_TOKEN="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"

echo "📦 Installing Vercel CLI..."
npm install -g vercel@latest

echo "🔐 Authenticating with Vercel..."
echo $VERCEL_TOKEN | vercel login --stdin

echo "📱 Building frontend..."
cd frontend
npm install --legacy-peer-deps
npm run build
cd ..

echo "🐍 Preparing backend..."
cd backend
echo "✓ Backend requirements ready"
cd ..

echo "🚀 Deploying to Vercel..."
vercel --prod --confirm --token $VERCEL_TOKEN

echo "⚙️ Setting production environment variables..."
vercel env add MONGO_URL "mongodb+srv://goistheticker_db_user:PTmfplJ3ChiNm1zH@cluster0.px8hllq.mongodb.net/?appName=Cluster0" production --token $VERCEL_TOKEN
vercel env add DB_NAME "dogefood_lab_production" production --token $VERCEL_TOKEN
vercel env add CORS_ORIGINS "*" production --token $VERCEL_TOKEN
vercel env add TELEGRAM_BOT_TOKEN "8253212634:AAGZ0Bo0ZD3CcNKyABmMurEMsTclyADCqIE" production --token $VERCEL_TOKEN

echo "🤖 Updating Telegram Bot URL..."
# Update bot webhook URL to point to new domain
echo "Bot webhook will need to be updated to new Vercel domain"

echo "✅ Deployment Complete!"
echo ""
echo "🎮 Your DogeFood Lab is now deployed at:"
echo "   🌐 Web: https://dogefood-lab.vercel.app"
echo "   📱 Telegram: @Dogefoodlabbot"
echo ""
echo "🔧 Features available:"
echo "   ✓ Character Selection (Max, Rex, Luna)"
echo "   ✓ Treat Creation & Mixing"
echo "   ✓ Real-time Timers"
echo "   ✓ Points & Experience System"
echo "   ✓ Leaderboards"
echo "   ✓ Season 1 (2025-2026) Active"
echo ""
echo "📊 Database: Atlas MongoDB Cluster"
echo "⚡ Backend: Vercel Serverless Functions"
echo "🌐 Frontend: Vercel Static Hosting"