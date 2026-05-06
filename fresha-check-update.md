# Fresha Bot Update Needed

## Issue
The Fresha bot is being asked for codes repeatedly but the screenshot functionality isn't working because:
1. Screenshots taken to /tmp/ can't be sent via Slack (not in allowed directories)
2. The bot needs files:write permission to upload images to Slack

## Solutions to implement:
1. Update screenshot path to ~/.openclaw/workspace/ in bot config
2. Add files:write OAuth scope to Fresha bot's Slack app