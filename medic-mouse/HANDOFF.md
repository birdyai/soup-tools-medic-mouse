# Medic Mouse — Developer Handoff

> **Single entry point for a new developer picking up this project.**
> Last updated: 2026-04-29

---

## 1. The 30-Second Pitch

A Slack bot that tells aesthetic-clinic messengers — in ~1 second — whether a client is medically cleared for a treatment at a specific clinic.

```
Messenger pastes client info → @medic-mouse → ✅ / ❌ / ⚠️ + reasoning
```

Backed by a web dashboard where admins manage the rules without touching code.

**Stack:** Node.js · @slack/bolt (Socket Mode) · Fuse.js (fuzzy matching) · Express · vanilla HTML/JS dashboard · JSON file storage *(Postgres planned)*.

**Clinics live:** Plush · Aura · Villa · Eden · Bloom · Kaya (6 active, manifest supports more).

---

## 2. Read These First (in order)

1. **`PROJECT-BRIEF.md`** — plain-English explanation of what each part does
2. **`../medic-mouse-technical-spec.md`** — full architecture, Postgres schema, API endpoints
3. **`../medic-mouse-architecture-best-practices.md`** — design notes
4. **`../medic-mouse-task-breakdown.md`** — original 18-task phased plan
5. **`../medic-mouse-unknown-conditions-spec.md`** — how the bot handles things it doesn't know
6. **`DEPLOYMENT_GUIDE.md`** — 10-min deploy steps
7. **`OPENCLAW-INTEGRATION.md`** — only if integrating with OpenClaw gateway

---

## 3. Repository Layout

All code lives under `~/.openclaw/workspace/medic-mouse/`.

```
medic-mouse/
├── HANDOFF.md                ← this file
├── PROJECT-BRIEF.md          ← plain-English overview
├── DEPLOYMENT_GUIDE.md       ← deploy steps
├── OPENCLAW-INTEGRATION.md   ← OpenClaw gateway integration (optional)
├── slack-app-manifest.json   ← Slack app config (paste into api.slack.com)
│
├── bot/                      ← Slack bot (Node.js + Bolt + Socket Mode)
│   ├── index.js              ← main bot — 391 lines, working
│   ├── slack-manifest.json   ← duplicate of root manifest
│   ├── test-parser.js        ← parser unit tests
│   ├── test-local.js         ← local test harness (no Slack needed)
│   ├── DEPLOY-CHECKLIST.md
│   ├── README.md
│   ├── package.json
│   └── .env                  ← ⚠️ NOT YET CREATED — needs Slack tokens
│
├── dashboard/                ← web admin UI
│   ├── server.js             ← current server (45 lines)
│   ├── server-v2.js          ← experimental v2 (70 lines)
│   ├── index.html            ← current dashboard (2081 lines)
│   ├── index-enhanced.html   ← variant
│   ├── index-sidebar.html    ← 4-page sidebar layout (Analytics/Testing/Responses/Database)
│   ├── table-update.js
│   ├── README.md
│   └── package.json
│
└── data/
    ├── medical-rules.json    ← live rules (bot + dashboard read/write this)
    ├── medical-rules-v2.json ← expanded ruleset
    ├── sample-queries.json
    └── README.md
```

**Supporting files in workspace root** (`~/.openclaw/workspace/`):

- `medic-mouse-technical-spec.md` — full spec
- `medic-mouse-architecture-best-practices.md`
- `medic-mouse-task-breakdown.md`
- `medic-mouse-unknown-conditions-spec.md`
- `medic-mouse-slack-scraper.html` — tool to import 6 months of Slack history
- `medic-mouse-index/server.js` — secondary indexing server (shares `dashboard/node_modules` via symlink)
- `add_medic_mouse_tasks.py` — script that pushed tasks into Mission Control

---

## 4. What's Built ✅

### Bot (`bot/index.js`)
- Slack Bolt app, Socket Mode (no public URL needed)
- Listens for `@medic-mouse` mentions, replies in thread
- Parses emoji-prefixed input: 🏥 Clinic · 👩 Lead · 🩺 Condition · 💊 Medications · 📋 Medication Type · 📍 Treating
- Fuzzy clinic matching via Fuse.js (60% confidence threshold)
- Handles 15 conditions across 8 clinics
- Health endpoint at `/health`
- Recognises: diabetes, hypertension, pregnancy, accutane/isotretinoin, blood thinners, cancer, keloids, infections, thyroid/autoimmune, PCOS, melasma, herpes, epilepsy, etc.
- Response types: ✅ allowed · ❌ contraindicated · ⚠️ restricted to specific clinics · ❓ need more info · ⏱️ wait period

### Dashboard (`dashboard/`)
- 4-page UI: **Analytics · Testing · Responses · Database**
- Search, filter by global vs clinic-specific, filter by clinic
- Edit rule status (`yes` / `yes_with_note` / `yes_with_exceptions` / `no`), confidence, exceptions
- Auto-saves to `../data/medical-rules.json`
- Currently running locally on `http://localhost:3000` (PID 66461 at time of writing)

### Other
- `slack-app-manifest.json` ready to paste into api.slack.com
- Test harness (`bot/test-local.js`) runs without Slack credentials
- 6 months of Slack history scraper (`../medic-mouse-slack-scraper.html`) — built but not yet executed

---

## 5. What's Not Done ⚠️

Active critical tasks (from Mission Control INBOX, 8+ days open):

1. **Set up PostgreSQL database** — schema is fully specified in `medic-mouse-technical-spec.md` §3.1 but not deployed. Bot + dashboard currently read/write `medical-rules.json`.
2. **Create Slack app from manifest + populate `bot/.env`** — needed tokens:
   - `SLACK_BOT_TOKEN` (`xoxb-…`)
   - `SLACK_APP_TOKEN` (`xapp-…`, Socket Mode, scope `connections:write`)
   - `SLACK_SIGNING_SECRET`
3. **Redis caching layer** — speced (§5.1), not built
4. **Run historical Slack import** — scraper exists, hasn't been executed against `appointment-angels` channel
5. **Dashboard authentication** — currently open on `:3000`, no login
6. **Production deployment** — PM2 instructions exist, Docker not yet set up
7. **Wire dashboard → Postgres** once DB exists (currently writes JSON)
8. **Feedback loop / unknown-items queue** — speced (§6.1.3), partial implementation
9. **Audit trail / change log** for rule edits

---

## 6. Critical Pieces of Context

- **Storage today is a flat JSON file** (`data/medical-rules.json`). All reads/writes go through Node fs APIs in both bot and dashboard. Migration path to Postgres is the biggest single piece of work outstanding.
- **Socket Mode** means the bot doesn't need a public URL — easier deploy, but means no inbound HTTP from Slack except the health endpoint.
- **Fuzzy clinic matching threshold is 60%** — tune in `bot/index.js` if you see false positives/negatives.
- **`medical-rules-v2.json` is a richer ruleset** — but bot currently loads `medical-rules.json`. Decide which to canonicalise before Postgres migration.
- **There are three dashboard HTML variants** (`index.html`, `index-enhanced.html`, `index-sidebar.html`). `index.html` is current. The sidebar layout matches the 4-page design in PROJECT-BRIEF.md.
- **OpenClaw integration is optional** — see `OPENCLAW-INTEGRATION.md`. Standalone bot is the recommended path for medical-compliance reasons.
- **No PII** is currently stored (only condition/medication names, clinic names, query timestamps).

---

## 7. Recommended Pickup Order

1. Clone / `cd` into `~/.openclaw/workspace/medic-mouse/`
2. Read this file, then `PROJECT-BRIEF.md`, then the technical spec
3. **Get the bot live first** (proves the loop end-to-end):
   - Create Slack app from `slack-app-manifest.json`
   - Populate `bot/.env` from `bot/.env.example` (if missing, copy from README §3)
   - `cd bot && npm install && npm start`
   - In Slack: `/invite @medic-mouse`, then test with the example payload from `DEPLOYMENT_GUIDE.md` §5
4. **Get the dashboard live** in a second terminal:
   - `cd dashboard && npm install && npm start` → http://localhost:3000
5. **Migrate to Postgres** using schema in tech spec §3.1
6. **Add Redis cache** per spec §5.1
7. **Run historical import** (`../medic-mouse-slack-scraper.html`) to seed real-world rules
8. Add **dashboard auth** before exposing publicly (Cloudflare Tunnel + auth, or basic OAuth)
9. **PM2 / Docker** for prod deploy

---

## 8. Useful Commands

```bash
# Project root
cd ~/.openclaw/workspace/medic-mouse

# Run bot (after .env is set up)
cd bot && npm install && npm start

# Run dashboard
cd dashboard && npm install && npm start

# Local parser tests (no Slack needed)
cd bot && node test-local.js

# Health check (bot)
curl http://localhost:3000/health

# Production with PM2
pm2 start bot/index.js --name medic-bot
pm2 start dashboard/server.js --name medic-dashboard
pm2 save
pm2 logs medic-bot
```

---

## 9. Contact / Owner

- **Project owner:** Hadley
- **Workspace:** `~/.openclaw/workspace/medic-mouse/` on Mark's Mac mini
- **Slack workspace:** SOUP (team `T04UNJSCBNF`)
- **Target Slack channel for bot:** appointment-angels (channel ID needed when bot deploys)

---

*Built April 2026. This handoff doc is the single starting point for any new developer joining the project.*
