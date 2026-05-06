# Medic Mouse - Unknown Condition Handling Specification

## Overview
When Medic Mouse encounters a medical condition or medication not in the database, it should automatically add it and alert the messengers team for research.

## Process Flow

### 1. Detection
- Bot receives message with medical conditions/medications
- Checks each against the database
- Identifies any that don't have existing rules

### 2. Automatic Database Addition
For each unknown condition:
```json
{
  "condition-name": {
    "type": "unknown",
    "status": "requires-research",
    "addedBy": "medic-mouse-bot",
    "dateAdded": "2026-04-02T12:30:00Z",
    "originalName": "Arthritis",
    "firstReportedBy": "Lead Name from message",
    "clinicRequested": "Plush Aesthetics"
  }
}
```

### 3. Slack Alert Format
```
⚠️ UNKNOWN CONDITION DETECTED

Lead: Sarah
Clinic: Plush Aesthetics
Unknown Condition: Arthritis

@messengers Please research this condition and update the database with:
- Is it safe for aesthetic treatments?
- Any clinic-specific restrictions?
- Required documentation?

[View in Dashboard](link-to-condition)
```

### 4. Bot Response to Lead
While messengers research, the bot responds:
```
Hi Sarah,

I've reviewed your information but need clarification on "Arthritis" as it's not in my current database. 

I've notified our medical team who will research this condition and get back to you shortly.

In the meantime, please have any relevant medical documentation ready.
```

### 5. Messenger Actions
1. Click dashboard link
2. Research the condition
3. Update status from "unknown" to appropriate rule:
   - Global: complete no / yes / yes with doctor's note
   - Clinic-dependent: set rules per clinic
4. Add any exceptions or requirements
5. Save changes

### 6. Follow-up
- Bot can now handle future queries about this condition
- Analytics track how many unknowns are discovered
- Monthly report of new conditions added

## Implementation Details

### Slack Mentions
- Use user group handle: `@messengers`
- Thread the alert under the original message
- Include direct link to dashboard edit page

### Database Updates
- Add "unknown" as a valid condition type
- Track who reported it first
- Log research completion time
- Version history of status changes

### Dashboard Features
- Filter view for "requires-research" conditions
- Research checklist template
- Quick status update buttons
- Bulk update for similar conditions

## Benefits
1. **Continuous Learning**: Database grows automatically
2. **Fast Response**: Leads aren't left waiting
3. **Quality Control**: Messengers verify all new conditions
4. **Audit Trail**: Track what was added and when
5. **Efficiency**: No manual database entry needed