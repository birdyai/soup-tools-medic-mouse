# Medic Mouse Technical Specification

## 1. System Overview

Medic Mouse is an AI-powered Slack bot that provides instant medical clearance verification for aesthetic treatment bookings. The system checks client medical conditions and medications against a comprehensive database to determine treatment eligibility.

### Core Features
- Slack bot responding to @medic-mouse mentions
- Database of 50+ common medical conditions and medications
- Fuzzy clinic name matching
- Treatment area exception handling
- Confidence scoring on responses
- Dashboard for database management
- Analytics and reporting
- Historical data import from Slack

## 2. System Architecture

### 2.1 Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Slack Bot     │────▶│  Processing     │────▶│   PostgreSQL    │
│   (@medic-mouse)│     │     Engine      │     │    Database     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                         ▲
         │                       ▼                         │
         │              ┌─────────────────┐               │
         │              │  Web Dashboard   │───────────────┘
         │              │  (Internal Tool) │
         │              └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Analytics Engine │
└─────────────────┘
```

### 2.2 Technology Stack
- **Bot**: Node.js with Slack SDK
- **Database**: PostgreSQL with JSON support
- **Dashboard**: React + Express API
- **Deployment**: Docker containers
- **Cache**: Redis for performance

## 3. Database Schema

### 3.1 Core Tables

```sql
-- Master list of conditions/medications that are always rejected
CREATE TABLE universal_rejections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, -- 'condition' or 'medication' or 'medication_type'
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medical conditions
CREATE TABLE conditions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    aliases TEXT[], -- Array of alternative names
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medications
CREATE TABLE medications (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    generic_name VARCHAR(255),
    medication_type VARCHAR(100), -- 'blood_thinner', 'pain_relief', etc.
    aliases TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clinics
CREATE TABLE clinics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    aliases TEXT[], -- For fuzzy matching
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clinic-specific rules for conditions
CREATE TABLE clinic_condition_rules (
    id SERIAL PRIMARY KEY,
    clinic_id INTEGER REFERENCES clinics(id),
    condition_id INTEGER REFERENCES conditions(id),
    status VARCHAR(50) NOT NULL, -- 'yes', 'yes_with_note', 'yes_with_exceptions', 'no'
    exceptions JSONB, -- {"treatment_areas": ["tummy", "belly"], "other_restrictions": [...]}
    doctor_note_required BOOLEAN DEFAULT FALSE,
    notes TEXT,
    confidence_score DECIMAL(3,2) DEFAULT 1.00, -- 0.00 to 1.00
    last_verified DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(clinic_id, condition_id)
);

-- Clinic-specific rules for medications
CREATE TABLE clinic_medication_rules (
    id SERIAL PRIMARY KEY,
    clinic_id INTEGER REFERENCES clinics(id),
    medication_id INTEGER REFERENCES medications(id),
    status VARCHAR(50) NOT NULL,
    exceptions JSONB,
    notes TEXT,
    confidence_score DECIMAL(3,2) DEFAULT 1.00,
    last_verified DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(clinic_id, medication_id)
);

-- Query history for analytics
CREATE TABLE query_history (
    id SERIAL PRIMARY KEY,
    slack_user_id VARCHAR(50),
    slack_user_name VARCHAR(100),
    clinic_name VARCHAR(255),
    conditions TEXT[],
    medications TEXT[],
    treatment_area VARCHAR(100),
    result VARCHAR(50), -- 'approved', 'rejected', 'partial_check_needed'
    unknown_items JSONB, -- Items not found in database
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feedback and learning
CREATE TABLE feedback_entries (
    id SERIAL PRIMARY KEY,
    query_history_id INTEGER REFERENCES query_history(id),
    clinic_id INTEGER REFERENCES clinics(id),
    item_name VARCHAR(255),
    item_type VARCHAR(50), -- 'condition' or 'medication'
    reported_status VARCHAR(50),
    verified_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Initial Data

```sql
-- Universal rejections
INSERT INTO universal_rejections (name, type, reason) VALUES
('Blood Thinner', 'medication_type', 'High bleeding risk'),
('Warfarin', 'medication', 'Blood thinner - high bleeding risk'),
('Active Cancer Treatment', 'condition', 'Compromised healing'),
('Pregnancy', 'condition', 'Safety concerns'),
('Recent Stroke', 'condition', 'Within 6 months'),
('Recent Heart Attack', 'condition', 'Within 6 months');
```

## 4. System Workflow

### 4.1 Message Processing Flow

1. **Message Detection**
   ```javascript
   // Slack event listener
   app.message(/(<@U099A1RSB7W>|@medic-mouse)/i, async ({ message, say }) => {
     await processQuery(message, say);
   });
   ```

2. **Input Parsing**
   ```javascript
   function parseMessage(text) {
     const patterns = {
       clinic: /🏥\s*Clinic Name:\s*(.+?)(?=\n|$)/i,
       firstName: /👩\s*Lead First Name:\s*(.+?)(?=\n|$)/i,
       conditions: /🩺\s*Medical Condition:\s*(.+?)(?=\n|$)/i,
       medications: /💊\s*Current Medications.*?:\s*(.+?)(?=\n|$)/i,
       medicationType: /📋\s*Medication Type.*?:\s*(.+?)(?=\n|$)/i,
       treatmentArea: /📍\s*Treating:\s*(.+?)(?=\n|$)/i
     };
     
     return {
       clinic: extractPattern(text, patterns.clinic),
       conditions: splitItems(extractPattern(text, patterns.conditions)),
       medications: splitItems(extractPattern(text, patterns.medications)),
       medicationType: extractPattern(text, patterns.medicationType),
       treatmentArea: normalizeBodyPart(extractPattern(text, patterns.treatmentArea))
     };
   }
   ```

3. **Clinic Matching**
   ```javascript
   async function matchClinic(clinicName) {
     // Try exact match first
     let clinic = await db.findClinicExact(clinicName);
     
     if (!clinic) {
       // Try fuzzy matching
       const candidates = await db.findClinicsFuzzy(clinicName);
       
       if (candidates.length === 1) {
         clinic = candidates[0];
       } else if (candidates.length > 1) {
         // Ask user to clarify
         return { needsClarification: true, options: candidates };
       }
     }
     
     return { clinic };
   }
   ```

4. **Condition/Medication Checking**
   ```javascript
   async function checkConditions(clinic, conditions, medications, treatmentArea) {
     const results = {
       approved: [],
       rejected: [],
       unknown: [],
       needsCheck: []
     };
     
     // Check universal rejections first
     const universalRejects = await checkUniversalRejections(conditions, medications);
     if (universalRejects.length > 0) {
       return { 
         canBook: false, 
         reason: 'Universal rejection',
         details: universalRejects 
       };
     }
     
     // Check each condition
     for (const condition of conditions) {
       const result = await checkConditionForClinic(clinic.id, condition, treatmentArea);
       categorizeResult(result, results);
     }
     
     // Check each medication
     for (const medication of medications) {
       const result = await checkMedicationForClinic(clinic.id, medication);
       categorizeResult(result, results);
     }
     
     return results;
   }
   ```

### 4.2 Response Generation

```javascript
function generateResponse(checkResults, query) {
  const { approved, rejected, unknown, needsCheck } = checkResults;
  
  // If any rejections, cannot book
  if (rejected.length > 0) {
    return formatRejectionResponse(rejected, approved);
  }
  
  // If unknowns exist, partial clearance
  if (unknown.length > 0) {
    return formatPartialClearanceResponse(approved, unknown);
  }
  
  // All clear
  return formatApprovalResponse(approved);
}
```

## 5. Performance Optimization

### 5.1 Caching Strategy

```javascript
// Redis cache structure
const cacheKeys = {
  clinic: (name) => `clinic:${name.toLowerCase()}`,
  condition: (clinicId, conditionName) => `rule:${clinicId}:condition:${conditionName.toLowerCase()}`,
  medication: (clinicId, medName) => `rule:${clinicId}:med:${medName.toLowerCase()}`
};

// Cache with 1-hour TTL
async function getCachedOrFetch(key, fetchFunction) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetchFunction();
  await redis.setex(key, 3600, JSON.stringify(data)); // 1 hour TTL
  
  return data;
}
```

### 5.2 Database Optimization

- **Indexes**:
  ```sql
  CREATE INDEX idx_conditions_name ON conditions(name);
  CREATE INDEX idx_medications_name ON medications(name);
  CREATE INDEX idx_clinics_name ON clinics(name);
  CREATE INDEX idx_clinic_rules_lookup ON clinic_condition_rules(clinic_id, condition_id);
  CREATE INDEX idx_aliases ON conditions USING GIN(aliases);
  CREATE INDEX idx_med_aliases ON medications USING GIN(aliases);
  ```

- **Query Optimization**:
  - Batch condition/medication lookups
  - Use prepared statements
  - Connection pooling (10-20 connections)

### 5.3 Response Time Targets

- **Cache hit**: < 50ms
- **Database query**: < 200ms
- **Total response**: < 500ms (95th percentile)

## 6. Dashboard Implementation

### 6.1 Features

1. **Rule Management**
   - View/edit clinic-specific rules
   - Bulk import from CSV
   - Confidence score adjustment
   - Add notes and exceptions

2. **Analytics Dashboard**
   - Query volume by hour/day/week
   - Most common conditions/medications
   - Unknown items tracker
   - Response time metrics
   - Success rate (approved/rejected/partial)

3. **Feedback Loop**
   - Queue of unknown items
   - Messenger-submitted updates
   - Approval workflow for updates
   - Audit trail of changes

### 6.2 API Endpoints

```javascript
// Dashboard API
POST   /api/auth/login
GET    /api/clinics
GET    /api/conditions
GET    /api/medications
GET    /api/rules/:clinicId
PUT    /api/rules/:clinicId/:ruleType/:itemId
POST   /api/feedback
GET    /api/analytics/summary
GET    /api/analytics/queries
GET    /api/unknown-items
POST   /api/import/historical
```

## 7. Historical Data Import

### 7.1 Slack History Processing

```javascript
async function importHistoricalData() {
  const channels = ['appointment-angels-channel-id'];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  for (const channel of channels) {
    const messages = await slack.conversations.history({
      channel,
      oldest: sixMonthsAgo.getTime() / 1000
    });
    
    for (const message of messages.messages) {
      if (containsMedicalQuery(message.text)) {
        await processHistoricalMessage(message);
      }
    }
  }
}
```

## 8. Error Handling & Reliability

### 8.1 Error Responses

```javascript
const errorResponses = {
  DATABASE_ERROR: "⚠️ System temporarily unavailable. Please check manually.",
  PARSING_ERROR: "❓ Couldn't understand the format. Please use the standard template.",
  CLINIC_NOT_FOUND: "🏥 Clinic not recognized. Please verify the clinic name.",
  TIMEOUT: "⏱️ Taking too long to respond. Please check manually."
};
```

### 8.2 Fallback Mechanism

- If database is down: Return safe "please check manually" message
- If parsing fails: Ask for clarification with example format
- If confidence < 0.7: Add warning to response

## 9. Security & Access Control

- Dashboard requires authentication (OAuth or shared secret)
- All changes logged with user ID and timestamp
- Read-only access for analytics
- Write access for rule updates (restricted users)
- No PII stored in analytics

## 10. Deployment & Monitoring

### 10.1 Health Checks

```javascript
// Health endpoint
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    slack: await checkSlackConnection()
  };
  
  const healthy = Object.values(checks).every(v => v);
  res.status(healthy ? 200 : 503).json(checks);
});
```

### 10.2 Metrics to Monitor

- Response time (p50, p95, p99)
- Error rate
- Cache hit ratio
- Database query time
- Slack API latency
- Unknown items rate

## 11. Future Considerations

- Machine learning for confidence scoring
- Natural language improvements
- Integration with clinic systems (when available)
- Mobile app for messengers
- Voice interface for quick checks