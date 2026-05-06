# OpenClaw Integration Guide

## Option 1: Standalone Bot (Recommended)

Run Medic Mouse as a standalone Slack bot:

```bash
cd medic-mouse/bot
./start.sh
```

This is the simplest approach - the bot runs independently and responds to @medic-mouse mentions.

## Option 2: OpenClaw Gateway Integration

To integrate with OpenClaw's gateway (allowing Claude to see Medic Mouse activity):

### 1. Add Slack App to Gateway Config

```bash
# Add the app configuration
openclaw config set plugins.entries.slack.config.apps.medic-mouse '{
  "appId": "YOUR_APP_ID",
  "teamId": "YOUR_TEAM_ID", 
  "token": "xoxb-YOUR-BOT-TOKEN",
  "appToken": "xapp-YOUR-APP-TOKEN",
  "signingSecret": "YOUR-SIGNING-SECRET",
  "socketMode": true
}'
```

### 2. Configure Channel Routing

```bash
# Route specific channels to Medic Mouse
openclaw config set plugins.entries.slack.config.apps.medic-mouse.channels '["CHANNEL_ID"]'
```

### 3. Restart Gateway

```bash
openclaw gateway restart
```

## Option 3: Hybrid Approach

Run the bot standalone but forward important events to OpenClaw:

1. Keep bot running independently
2. Add webhook forwarding for significant events
3. Claude can monitor via the gateway's main Slack connection

## Recommended: Standalone

For medical compliance and dedicated response handling, running Medic Mouse as a standalone bot is recommended. It ensures:

- Dedicated processing for medical queries
- No interference with main OpenClaw operations  
- Clear audit trail for medical decisions
- Easy updates without affecting main gateway

## Quick Start

1. Create Slack app at https://api.slack.com/apps
2. Copy credentials to `bot/.env`
3. Run: `cd bot && ./start.sh`
4. Invite to channels: `/invite @medic-mouse`

That's it! The bot will respond to all @medic-mouse mentions.