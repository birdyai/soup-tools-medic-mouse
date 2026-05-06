# Medic Mouse - Project Brief

## What It Is (One Line)
A Slack bot that instantly tells your messengers whether a client is medically cleared for an aesthetic treatment, backed by a web dashboard for managing the rules.

## The Problem It Solves
Right now your messengers have to:
- Read a client's medical history
- Cross-reference it against each clinic's rules
- Guess or escalate when unsure
- Slow down bookings (or worse, book the wrong client)

Medic Mouse answers in **~1 second** with a clear yes / no / yes-with-conditions, every time.

## How It Works (Plain English)
1. Messenger pastes the client's conditions/medications into Slack and tags `@medic-mouse`
2. Bot parses the message → looks up clinic rules → checks against database
3. Bot replies with: ✅ approved / ❌ rejected / ⚠️ approved-with-note (e.g. "needs doctor letter")
4. Every query is logged so the dashboard can track patterns and improve

## The System (3 Parts)

```
   SLACK BOT  ←→  DATABASE  ←→  DASHBOARD
   (messenger)    (the rules)   (manager)
```

- **Slack Bot** = where the work happens (messengers use it)
- **Database** = the brain (conditions, medications, clinic rules)
- **Dashboard** = where you control the brain (you/admins use it)

---

## The Dashboard - 4 Pages

The internal web tool has a sidebar with 4 sections. Here's what each does and how they connect:

### 📊 1. Analytics (the homepage)
**Purpose:** See how Medic Mouse is performing at a glance.

**Shows:**
- Total queries this month
- Success rate (% of conditions it recognised)
- Average response time
- Number of active clinics
- Query trends chart

**Why it matters:** Tells you if the bot is being used, working well, or missing common conditions.

---

### 🧪 2. Testing
**Purpose:** Try out queries before they hit real bookings.

**How:** Type a question like "Can I get laser with diabetes?" → click Test → see exactly what the bot would reply.

**Why it matters:** Lets you sanity-check new rules and reproduce issues without bugging messengers.

**Connects to:** Pulls answers from the same logic the live Slack bot uses, so testing = real-world behaviour.

---

### 💬 3. Responses
**Purpose:** Live feed of what the bot has actually said to messengers.

**Shows:** Last X queries with timestamp, the question asked, and the bot's reply.

**Why it matters:**
- Spot wrong answers fast
- See what messengers are really asking
- Identify gaps in the rule set

**Connects to:** Click any response to jump to the underlying rule on the Database page (planned).

---

### 🗄️ 4. Database (the control room)
**Purpose:** Where you actually manage the rules. This is the most important page.

**Shows:**
- Total conditions in system
- Global rules (apply to ALL clinics — e.g. blood thinners always = no)
- Clinic-specific rules (e.g. Plush takes diabetics, Aura doesn't)
- Active clinics

**Lets you:**
- Search any condition
- Filter by global vs clinic-specific
- Filter by clinic (Plush, Aura, Villa, Eden, Bloom, Kaya)
- Add new conditions with the **+ Add New Condition** button
- Edit existing rules (yes / yes-with-note / yes-with-exceptions / no)
- Set treatment-area exceptions (e.g. "yes everywhere except tummy")

**Why it matters:** Every clinic has different rules. This page is how those rules get into the bot. No code, no developer needed.

---

## How The Pages Talk To Each Other

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  DATABASE  ──▶  the rules every page depends on         │
│      │                                                  │
│      ├──▶  TESTING uses these rules to simulate replies │
│      │                                                  │
│      ├──▶  Live SLACK BOT uses these rules in real time │
│      │            │                                     │
│      │            ▼                                     │
│      │       RESPONSES (logs every bot reply)           │
│      │            │                                     │
│      ▼            ▼                                     │
│   ANALYTICS rolls everything into stats & trends        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Translation:**
- The **Database** is the source of truth.
- **Slack Bot** + **Testing** both read from it to generate answers.
- Every answer the Slack Bot gives shows up in **Responses** + counts in **Analytics**.
- When **Analytics/Responses** reveal a gap, you go back to **Database** and add/fix the rule.

That's the loop.

---

## The Six Clinics Currently Supported
Plush Aesthetics · Aura Aesthetics · Villa Aesthetics · Eden Aesthetics · Bloom Aesthetics · Kaya Skin Clinic

---

## Why This Matters For The Business
- ⚡ **Speed**: Bookings move faster — no medical lookup delay
- 🛡️ **Safety**: No more "we accidentally booked someone on blood thinners"
- 🎯 **Consistency**: Every messenger gives the same answer
- 📚 **Self-improving**: The more it's used, the more rules get refined
- 👥 **Scales**: New messenger? They don't need to memorise medical rules — Medic Mouse does it for them

---

*Built April 2026. Stack: Node.js + Slack SDK · PostgreSQL · Express dashboard · Cloudflare tunnel for access.*
