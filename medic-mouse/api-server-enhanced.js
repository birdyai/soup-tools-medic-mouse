const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./database/db');

const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize database on startup
db.initializeDatabase().then(() => {
    console.log('Database initialized');
}).catch(err => {
    console.error('Failed to initialize database:', err);
});

// Load JSON database for backward compatibility
let jsonDatabase = {};
const dbPath = path.join(__dirname, 'database', 'medical_database.json');

function loadJsonDatabase() {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        jsonDatabase = JSON.parse(data);
        console.log('JSON database loaded successfully');
    } catch (error) {
        console.error('Error loading JSON database:', error);
        jsonDatabase = { conditions: {}, medications: {}, medication_types: {} };
    }
}

// Load JSON database on startup
loadJsonDatabase();

// API Routes

// Save scraped data endpoint
app.post('/api/scraped-data/save', async (req, res) => {
    try {
        const { messages } = req.body;
        const results = {
            saved: 0,
            errors: [],
            newRules: 0
        };
        
        for (const message of messages) {
            try {
                // Save the scraped message
                const messageData = {
                    message_id: message.message?.ts || message.timestamp,
                    channel_id: message.channelId || 'unknown',
                    clinic_name: message.clinic,
                    lead_name: message.firstName,
                    conditions: message.conditions || [],
                    medications: message.medications || [],
                    medication_type: message.medicationType,
                    treatment: message.treatment,
                    outcome_status: message.outcome?.status,
                    outcome_details: message.outcome?.details,
                    outcome_requirements: message.outcome?.requirements || [],
                    timestamp: message.timestamp,
                    thread_replies: message.message?.reply_count || 0,
                    raw_message: message.message || {}
                };
                
                await db.saveScrapedMessage(messageData);
                results.saved++;
                
                // Save learned rules if outcome exists
                if (message.outcome?.status) {
                    // Save rules for conditions
                    for (const condition of message.conditions || []) {
                        const ruleData = {
                            rule_type: 'condition',
                            item_name: condition,
                            clinic_name: message.clinic,
                            status: mapOutcomeToStatus(message.outcome),
                            requirements: message.outcome.requirements || [],
                            source_message_id: messageData.message_id
                        };
                        await db.saveLearnedRule(ruleData);
                        results.newRules++;
                    }
                    
                    // Save rules for medications
                    for (const medication of message.medications || []) {
                        const ruleData = {
                            rule_type: 'medication',
                            item_name: medication,
                            clinic_name: message.clinic,
                            status: mapOutcomeToStatus(message.outcome),
                            requirements: message.outcome.requirements || [],
                            source_message_id: messageData.message_id
                        };
                        await db.saveLearnedRule(ruleData);
                        results.newRules++;
                    }
                } else {
                    // Save unknown items for later review
                    for (const condition of message.conditions || []) {
                        await db.saveUnknownItem({
                            item_type: 'condition',
                            item_name: condition,
                            clinic_name: message.clinic,
                            message_id: messageData.message_id
                        });
                    }
                    
                    for (const medication of message.medications || []) {
                        await db.saveUnknownItem({
                            item_type: 'medication',
                            item_name: medication,
                            clinic_name: message.clinic,
                            message_id: messageData.message_id
                        });
                    }
                }
                
            } catch (error) {
                results.errors.push({
                    message_id: message.message?.ts,
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            results
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get scraped messages with pagination
app.get('/api/scraped-data', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const filters = {
            clinic: req.query.clinic,
            outcome: req.query.outcome,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo
        };
        
        const data = await db.getScrapedMessages(page, limit, filters);
        res.json({
            success: true,
            ...data
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get database statistics
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await db.getDatabaseStats();
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get learned rules
app.get('/api/learned-rules', async (req, res) => {
    try {
        const clinic = req.query.clinic;
        const rules = await db.getLearnedRules(clinic);
        
        // Format rules for frontend consumption
        const formattedRules = {};
        rules.forEach(rule => {
            const key = `${rule.item_name}:${rule.clinic_name}`;
            formattedRules[key] = {
                type: rule.rule_type,
                name: rule.item_name,
                clinic: rule.clinic_name,
                status: rule.status,
                requirements: rule.requirements,
                confidence: rule.confidence_score
            };
        });
        
        res.json({
            success: true,
            rules: formattedRules,
            count: rules.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Backward compatibility endpoints
app.get('/api/database', (req, res) => {
    res.json(jsonDatabase);
});

app.get('/api/conditions', (req, res) => {
    res.json(jsonDatabase.conditions || {});
});

app.get('/api/medications', (req, res) => {
    res.json(jsonDatabase.medications || {});
});

// Validate query endpoint (enhanced with learned rules)
app.post('/api/validate', async (req, res) => {
    const { conditions, medications, medicationType, clinic } = req.body;
    const clinicLower = clinic?.toLowerCase() || '';
    
    // Get learned rules for this clinic
    const learnedRules = await db.getLearnedRules(clinicLower);
    const rulesMap = {};
    learnedRules.forEach(rule => {
        rulesMap[`${rule.rule_type}:${rule.item_name}`] = rule;
    });
    
    const results = {
        conditions: [],
        medications: [],
        medicationType: null,
        canBook: true,
        reasons: [],
        unknowns: []
    };
    
    // Validate conditions
    if (conditions && conditions.length > 0) {
        for (const condition of conditions) {
            const condLower = condition.toLowerCase().trim();
            
            // Check learned rules first
            const learnedRule = rulesMap[`condition:${condLower}`];
            if (learnedRule) {
                results.conditions.push({
                    name: condition,
                    status: learnedRule.status,
                    inDatabase: true,
                    source: 'learned',
                    confidence: learnedRule.confidence_score
                });
                
                if (learnedRule.status === 'no') {
                    results.canBook = false;
                    results.reasons.push(`Medical condition "${condition}" is not allowed (learned from previous cases)`);
                } else if (learnedRule.status === 'yes_with_note') {
                    results.reasons.push(`Medical condition "${condition}" requires doctor's note`);
                }
            } else {
                // Fallback to JSON database
                const condData = jsonDatabase.conditions?.[condLower];
                if (condData) {
                    const status = condData.universal || 
                                  condData.clinics?.[clinicLower] || 
                                  'unknown';
                    
                    results.conditions.push({
                        name: condition,
                        status: status,
                        inDatabase: true,
                        source: 'static'
                    });
                    
                    if (status === 'no') {
                        results.canBook = false;
                        results.reasons.push(`Medical condition "${condition}" is not allowed`);
                    } else if (status === 'unknown') {
                        results.unknowns.push({
                            type: 'condition',
                            name: condition
                        });
                    }
                } else {
                    results.conditions.push({
                        name: condition,
                        status: 'needs_check',
                        inDatabase: false
                    });
                    results.unknowns.push({
                        type: 'condition',
                        name: condition
                    });
                }
            }
        }
    }
    
    // Validate medications
    if (medications && medications.length > 0) {
        for (const medication of medications) {
            const medLower = medication.toLowerCase().trim();
            
            // Check learned rules first
            const learnedRule = rulesMap[`medication:${medLower}`];
            if (learnedRule) {
                results.medications.push({
                    name: medication,
                    status: learnedRule.status,
                    inDatabase: true,
                    source: 'learned',
                    confidence: learnedRule.confidence_score
                });
                
                if (learnedRule.status === 'no') {
                    results.canBook = false;
                    results.reasons.push(`Medication "${medication}" is not allowed (learned from previous cases)`);
                } else if (learnedRule.status === 'yes_with_note') {
                    results.reasons.push(`Medication "${medication}" requires doctor's note`);
                }
            } else {
                // Fallback to JSON database
                const medData = jsonDatabase.medications?.[medLower];
                if (medData) {
                    const status = medData.universal || 
                                  medData.clinics?.[clinicLower] || 
                                  'unknown';
                    
                    results.medications.push({
                        name: medication,
                        type: medData.type,
                        status: status,
                        inDatabase: true,
                        source: 'static'
                    });
                    
                    if (status === 'no') {
                        results.canBook = false;
                        results.reasons.push(`Medication "${medication}" is not allowed`);
                    } else if (status === 'unknown') {
                        results.unknowns.push({
                            type: 'medication',
                            name: medication
                        });
                    }
                } else {
                    results.medications.push({
                        name: medication,
                        type: 'unknown',
                        status: 'needs_check',
                        inDatabase: false
                    });
                    results.unknowns.push({
                        type: 'medication',
                        name: medication
                    });
                }
            }
        }
    }
    
    res.json(results);
});

// Health check endpoint
app.get('/health', async (req, res) => {
    const stats = await db.getDatabaseStats();
    res.json({ 
        status: 'ok',
        postgres: {
            connected: true,
            stats
        },
        jsonDatabase: {
            conditions: Object.keys(jsonDatabase.conditions || {}).length,
            medications: Object.keys(jsonDatabase.medications || {}).length,
            medicationTypes: Object.keys(jsonDatabase.medication_types || {}).length
        }
    });
});

// Helper function to map outcome status
function mapOutcomeToStatus(outcome) {
    switch(outcome.status) {
        case 'approved': return 'yes';
        case 'approved_with_note': return 'yes_with_note';
        case 'rejected': return 'no';
        default: return 'unknown';
    }
}

const PORT = process.env.PORT || 8084;
app.listen(PORT, () => {
    console.log(`Enhanced Medic Mouse API server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});