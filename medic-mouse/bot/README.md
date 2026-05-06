# Medic Mouse Slack Bot

Medical clearance assistant for appointment angels. Quickly checks if patients with medical conditions can receive treatments at specific clinics.

## Features

- **@mention Response**: Responds to @medic-mouse mentions in Slack
- **Fuzzy Clinic Matching**: Intelligently matches partial clinic names
- **Condition Detection**: Automatically detects medical conditions from natural language
- **Rich Responses**: Provides clear YES/NO/CHECK answers with detailed explanations
- **Thread Replies**: Responds in threads to keep channels organized

## Setup Instructions

### 1. Create Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From a manifest"
3. Select your workspace
4. Copy the contents of `slack-manifest.json` and paste
5. Review and create the app

### 2. Get Credentials

After creating the app:

1. **Bot Token**: Settings → OAuth & Permissions → Bot User OAuth Token (starts with `xoxb-`)
2. **Signing Secret**: Settings → Basic Information → Signing Secret
3. **App Token**: Settings → Basic Information → App Level Tokens → Generate Token
   - Name: "Socket Mode Token"
   - Add scope: `connections:write`
   - Generate (starts with `xapp-`)

### 3. Configure Environment

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your credentials
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
```

### 4. Install & Run

```bash
# Install dependencies
npm install

# Run the bot
npm start

# Or with PM2 for production
pm2 start index.js --name medic-mouse
```

### 5. Add to Channels

1. In Slack, go to the channel where you want the bot
2. Type `/invite @medic-mouse`
3. The bot will now respond to mentions

## Usage Examples

**Basic Query:**
```
@medic-mouse Patient at Plush Aesthetics has diabetes
```

**Multiple Conditions:**
```
@medic-mouse Client with high blood pressure and on blood thinners wants botox at Aura
```

**Natural Language:**
```
@medic-mouse pregnant patient asking about laser treatment
```

## Response Format

The bot provides:
- ✅ **YES** - Treatment allowed
- ❌ **NO** - Treatment contraindicated
- ⚠️ **CHECK** - Restricted or needs review
- ❓ **UNCLEAR** - Need more information

Each response includes:
- Detected clinic and treatment
- Condition-specific rules
- Important notes and exceptions

## Testing

```bash
# Run local parser tests
node test-local.js

# Check bot health
curl http://localhost:3000/health
```

## Troubleshooting

**Bot not responding:**
- Check all three tokens are correct in .env
- Ensure bot is invited to the channel
- Check logs for connection errors

**"Medical rules not loaded":**
- Verify `../data/medical-rules.json` exists
- Check file permissions
- Review console logs for loading errors

**Fuzzy matching issues:**
- Bot uses 60% confidence threshold
- Partial clinic names should work
- Check available clinics in medical-rules.json

## Architecture

- **index.js**: Main bot logic with Slack event handling
- **medical-rules.json**: Source of truth for all medical rules
- **Fuzzy Matching**: Uses Fuse.js for intelligent clinic name matching
- **Socket Mode**: Runs without public URL using WebSocket connection

## Data Structure

Rules follow this format:
```json
{
  "condition": "Diabetes",
  "clinics": ["Plush Aesthetics", "Aura Aesthetics"],
  "status": "active",
  "exceptions": ["HbA1c < 7.5%", "Doctor clearance required"]
}
```

Special clinic values:
- `"None - absolute contraindication"` - Not allowed anywhere
- `"All clinics - wait X months"` - Allowed everywhere after waiting
- Specific clinic names - Only allowed at listed clinics