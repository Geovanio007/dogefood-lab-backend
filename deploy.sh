#!/bin/bash

# DogeFood Lab Deployment Script
echo "🚀 Deploying DogeFood Lab to Vercel and GitHub..."

# Set API keys
export VERCEL_TOKEN="wg82AmYvremPGW15roFouDsQ"
export GITHUB_TOKEN="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"

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm install --legacy-peer-deps
npm run build
cd ..

# Install Vercel CLI
echo "🔧 Installing Vercel CLI..."
npm install -g vercel

# Login to Vercel (will use token)
echo "🔐 Authenticating with Vercel..."
vercel login --token $VERCEL_TOKEN

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod --token $VERCEL_TOKEN

# Set environment variables
echo "⚙️ Setting environment variables..."
vercel env add MONGO_URL production --token $VERCEL_TOKEN
vercel env add TELEGRAM_BOT_TOKEN production --token $VERCEL_TOKEN
vercel env add DB_NAME production --token $VERCEL_TOKEN
vercel env add CORS_ORIGINS production --token $VERCEL_TOKEN

echo "✅ Deployment complete!"
echo "🌐 Your game should now be accessible at the Vercel URL"
echo "📱 Users can choose to play from:"
echo "   - Vercel deployment (web browser)"  
echo "   - Telegram Mini App (@Dogefoodlabbot)"