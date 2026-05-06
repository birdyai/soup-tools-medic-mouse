# Medic Mouse - Medical Screening AI Agent Brief

## Executive Summary
Build an AI agent ("Medic Mouse") that automatically screens patient medical conditions and medications against clinic-specific requirements, reducing manual checks by messengers and preventing booking errors.

## Current Problem
- Appointment angels collect medical information via templates
- Messengers must manually check each condition/medication with clinics
- No centralized knowledge base - relies on human memory
- Existing "med muse" has limited functionality
- Risk of booking patients with contraindications

## Proposed Solution

### Core Components

1. **Medical Database**
   - Central repository of conditions, medications, and medication types
   - Clinic-specific responses for each item
   - Universal contraindications (e.g., blood thinners = always NO)
   - Learning capability from team updates

2. **Response Categories**
   - **Yes** - Approved for treatment
   - **Yes with Doctor Note** - Requires medical clearance
   - **Yes with Exceptions** - Conditional approval (e.g., "surgery must be >6 months ago")
   - **Not Able to Have Treatment** - Clinic-specific rejection
   - **Universal NO** - Rejected across all clinics

3. **Check Process (3-step waterfall)**
   1. Medical Condition check
   2. Current Medications check (specific drug names)
   3. Medication Type check (catches categories if specific drug unknown)

### Workflow

1. Team member tags @medic-mouse with patient template
2. Bot parses medical information
3. Performs sequential checks against database
4. Returns clear verdict with reasoning
5. If unknown, tags team for clarification
6. Updates database with new information

### Example Interaction

**Input:**
```
:hospital: Clinic Name: Plush Aesthetics
:woman-raising-hand: Lead First Name: Hadley
:stethoscope: Medical Condition: Marina Coil
:pill: Current Medications (Name): CrazyMeds
:clipboard: Medication Type: Blood Thinner
```

**Output:**
```
❌ We cannot book this client, because of the medication type.

*Medical Conditions*
Marina Coil = ✅ YES

*Current Medications*
CrazyMeds = ⚠️ No Record

*Medication Type*
Blood Thinner = ❌ NO
```

## Dashboard Requirements

1. **Medical questions added to DB** (total count)
2. **Questions asked by team** (daily/weekly/monthly)
3. **Times Medic Mouse asked messengers** (count + percentage)
4. **Times Medic Mouse answered independently** (count + percentage)
5. **Medical Database viewer** (searchable, filterable by clinic)

## Critical Questions & Edge Cases

### Data Structure Questions

1. **Multiple conditions/medications handling?**
   - If patient has 3 conditions and 1 is "Not Able", does that override all?
   - How to display multiple checks clearly?

2. **Clinic variations?**
   - Same condition might be YES at Clinic A but NO at Clinic B
   - How to handle clinic name variations/typos?

3. **Treatment type relevance?**
   - Does "Treating: tummy" affect which conditions matter?
   - Some conditions might only matter for facial treatments

### Learning & Updates

1. **Who can update the database?**
   - All messengers? Only supervisors?
   - Approval process for new entries?

2. **Conflicting information?**
   - Clinic says YES today but NO tomorrow
   - How to handle policy changes?

3. **Update format?**
   - How do messengers provide updates to Medic Mouse?
   - Structured command vs natural language?

### Edge Cases to Consider

1. **Spelling variations**
   - "Mirena Coil" vs "Marina Coil" vs "IUD"
   - "Warfarin" vs "Warfrin" vs "blood thinner"

2. **Partial matches**
   - "Diabetes" vs "Type 1 Diabetes" vs "Type 2 Diabetes"
   - "High blood pressure" vs "Hypertension"

3. **Time-sensitive conditions**
   - "Recent surgery" - how recent?
   - "Currently pregnant" vs "Was pregnant"

4. **Combination effects**
   - Condition A + Medication B = Different outcome
   - Multiple medications interacting

## Technical Considerations

### Database Schema (Proposed)
```
medical_conditions:
- id
- condition_name
- aliases (for spelling variations)
- universal_status (if always NO)
- created_at
- updated_at

clinic_condition_rules:
- clinic_id
- condition_id
- status (Yes/Yes with Note/Yes with Exceptions/Not Able)
- exception_details
- last_verified
- updated_by

medications:
- id
- medication_name
- medication_type
- aliases
- universal_status

clinic_medication_rules:
- clinic_id
- medication_id
- status
- exception_details
```

### Integration Points
- Slack bot for team interaction
- API for dashboard
- Audit log for all decisions
- Learning queue for unknown items

## Success Metrics
- Reduce messenger clinic queries by >70%
- <5% false negatives (saying YES when should be NO)
- 0% false positives (saying NO when could be YES)
- Response time <3 seconds
- Database grows by 50+ entries/week initially

## Risk Mitigation
- Always err on side of caution (when uncertain, ask human)
- Clear audit trail for liability
- Regular clinic policy update reminders
- Escalation path for complex cases

## Next Steps
1. Finalize data model
2. Define exact Slack interaction format
3. Build MVP with top 20 conditions/medications
4. Test with historical cases
5. Gradual rollout with parallel manual checking