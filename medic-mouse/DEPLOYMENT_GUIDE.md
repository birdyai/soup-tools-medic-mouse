# Medic Mouse Deployment Guide

## Quick Start (10 minutes)

### 1. Create Slack App (2 min)
1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From an app manifest"
3. Select your workspace
4. Paste the contents of `slack-app-manifest.json`
5. Review and create

### 2. Get Your Tokens (1 min)
After creating the app, collect these tokens:
- **Bot User OAuth Token**: OAuth & Permissions → Bot User OAuth Token (starts with `xoxb-`)
- **Signing Secret**: Basic Information → Signing Secret
- **App-Level Token**: Basic Information → App-Level Tokens → Generate Token (Socket Mode, starts with `xapp-`)

### 3. Configure the Bot (2 min)
```bash
cd ~/.openclaw/workspace/medic-mouse/bot
cp .env.example .env
# Edit .env and add your tokens:
# SLACK_BOT_TOKEN=xoxb-your-bot-token
# SLACK_SIGNING_SECRET=your-signing-secret
# SLACK_APP_TOKEN=xapp-your-app-token
```

### 4. Install & Run (3 min)
```bash
# Bot
cd ~/.openclaw/workspace/medic-mouse/bot
npm install
npm start

# Dashboard (in new terminal)
cd ~/.openclaw/workspace/medic-mouse/dashboard
npm install
npm start
```

### 5. Test It! (2 min)
1. Invite bot to a channel: `/invite @medic-mouse`
2. Test message:
```
@medic-mouse
🏥 Clinic: Plush Aesthetics
🩺 Condition: Diabetes
💊 Medications: None
📋 Treating: Face
```

## Production Deployment

### Using PM2 (Recommended)
```bash
npm install -g pm2

# Start bot
cd ~/.openclaw/workspace/medic-mouse/bot
pm2 start index.js --name medic-bot

# Start dashboard
cd ~/.openclaw/workspace/medic-mouse/dashboard
pm2 start server.js --name medic-dashboard

# Save PM2 config
pm2 save
pm2 startup
```

### Using Docker
```bash
# Coming soon - Docker files can be added if needed
```

## Troubleshooting

### Bot not responding?
1. Check bot is online in Slack
2. Verify tokens in .env file
3. Check logs: `pm2 logs medic-bot`
4. Ensure bot is invited to channel

### Dashboard not loading?
1. Check port 3000 is free
2. Verify medical-rules.json exists
3. Check server logs

## Maintenance

### Adding new conditions/clinics
1. Open dashboard at http://localhost:3000
2. Edit rules directly in the UI
3. Changes save automatically

### Viewing analytics
Dashboard shows:
- Total queries processed
- Success rate
- Unknown items needing review

## Support
Check logs in:
- Bot: `~/.openclaw/workspace/medic-mouse/bot/`
- Dashboard: `~/.openclaw/workspace/medic-mouse/dashboard/`