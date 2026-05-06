# Medic Mouse Medical Rules Database

This directory contains the medical rules engine for aesthetic treatment eligibility screening.

## Files

### medical-rules.json
The main rules database containing:
- **Universal Rejections**: Conditions that automatically disqualify patients from most treatments
- **Conditions**: Top medical conditions with clinic-specific rules and confidence scores
- **Treatment Area Exceptions**: Special rules for specific body areas (e.g., copper IUD + tummy)
- **Clinics**: Major UAE aesthetic clinics with fuzzy matching aliases
- **Medications**: Database of medications that affect treatment eligibility
- **Treatments**: Common aesthetic treatments with their contraindications

### sample-queries.json
Test cases for validating the rules engine, including:
- Real-world query scenarios with expected outcomes
- Fuzzy matching tests for clinic names and conditions
- Confidence score validation examples

## Key Features

1. **Fuzzy Matching**: Each condition and clinic includes common aliases and variations
2. **Confidence Scores**: Every rule has an associated confidence level (0.0-1.0)
3. **Clinic-Specific Rules**: Different clinics may have different protocols for the same condition
4. **Treatment Area Context**: Some conditions only matter for specific body areas
5. **Medication Awareness**: Tracks wait periods and contraindications for common medications

## Usage Example

```python
# Query: "I'm on warfarin and want laser hair removal at Plush"
# 
# The system should:
# 1. Identify "warfarin" → blood_thinners
# 2. Identify "Plush" → plush_aesthetics
# 3. Check universal rejections (blood thinners = high severity)
# 4. Return: not recommended with 0.95 confidence
```

## Confidence Levels

- **1.0**: Absolute certainty (pregnancy, active cancer)
- **0.9-0.99**: High confidence, well-documented
- **0.8-0.89**: Moderate confidence, some variation
- **0.7-0.79**: Lower confidence, case-by-case
- **< 0.7**: Limited data, require consultation

## Adding New Data

When adding new conditions or clinics:
1. Include all common aliases and variations
2. Set appropriate confidence scores
3. Add test cases to sample-queries.json
4. Consider clinic-specific variations
5. Document any special exceptions