#!/bin/bash

# Medic Mouse Bot Starter

echo "🐭 Starting Medic Mouse Bot..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found!"
    echo "Please copy .env.example to .env and add your Slack credentials:"
    echo ""
    echo "  cp .env.example .env"
    echo "  # Then edit .env with your tokens"
    echo ""
    exit 1
fi

# Check if tokens are set
source .env
if [ -z "$SLACK_BOT_TOKEN" ] || [ -z "$SLACK_SIGNING_SECRET" ] || [ -z "$SLACK_APP_TOKEN" ]; then
    echo "❌ ERROR: Missing required environment variables!"
    echo "Please ensure all three tokens are set in .env:"
    echo "  - SLACK_BOT_TOKEN (starts with xoxb-)"
    echo "  - SLACK_SIGNING_SECRET"
    echo "  - SLACK_APP_TOKEN (starts with xapp-)"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the bot
echo "⚡️ Starting bot..."
npm start