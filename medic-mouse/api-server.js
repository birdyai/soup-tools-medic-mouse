const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Load database
let database = {};
const dbPath = path.join(__dirname, 'database', 'medical_database.json');

function loadDatabase() {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        database = JSON.parse(data);
        console.log('Database loaded successfully');
    } catch (error) {
        console.error('Error loading database:', error);
        database = { conditions: {}, medications: {}, medication_types: {} };
    }
}

// Load database on startup
loadDatabase();

// Watch for database changes
fs.watchFile(dbPath, (curr, prev) => {
    console.log('Database file changed, reloading...');
    loadDatabase();
});

// API Routes

// Get all database data
app.get('/api/database', (req, res) => {
    res.json(database);
});

// Get conditions
app.get('/api/conditions', (req, res) => {
    res.json(database.conditions || {});
});

// Get medications
app.get('/api/medications', (req, res) => {
    res.json(database.medications || {});
});

// Get medication types
app.get('/api/medication-types', (req, res) => {
    res.json(database.medication_types || {});
});

// Add or update a condition
app.post('/api/conditions/:name', (req, res) => {
    const conditionName = req.params.name.toLowerCase();
    database.conditions[conditionName] = req.body;
    saveDatabase();
    res.json({ success: true, condition: database.conditions[conditionName] });
});

// Add or update a medication
app.post('/api/medications/:name', (req, res) => {
    const medicationName = req.params.name.toLowerCase();
    database.medications[medicationName] = req.body;
    saveDatabase();
    res.json({ success: true, medication: database.medications[medicationName] });
});

// Delete a condition
app.delete('/api/conditions/:name', (req, res) => {
    const conditionName = req.params.name.toLowerCase();
    delete database.conditions[conditionName];
    saveDatabase();
    res.json({ success: true });
});

// Delete a medication
app.delete('/api/medications/:name', (req, res) => {
    const medicationName = req.params.name.toLowerCase();
    delete database.medications[medicationName];
    saveDatabase();
    res.json({ success: true });
});

// Validate a query (main endpoint for testing dashboard)
app.post('/api/validate', (req, res) => {
    const { conditions, medications, medicationType, clinic } = req.body;
    const clinicLower = clinic?.toLowerCase() || '';
    
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
            const condData = database.conditions[condLower];
            
            if (condData) {
                const status = condData.universal || 
                              condData.clinics?.[clinicLower] || 
                              'unknown';
                
                results.conditions.push({
                    name: condition,
                    status: status,
                    inDatabase: true
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
    
    // Validate medications
    if (medications && medications.length > 0) {
        for (const medication of medications) {
            const medLower = medication.toLowerCase().trim();
            const medData = database.medications[medLower];
            
            if (medData) {
                const status = medData.universal || 
                              medData.clinics?.[clinicLower] || 
                              'unknown';
                
                results.medications.push({
                    name: medication,
                    type: medData.type,
                    status: status,
                    inDatabase: true
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
    
    // Validate medication type
    if (medicationType) {
        const typeLower = medicationType.toLowerCase().replace(' ', '_');
        const typeStatus = database.medication_types[typeLower];
        
        if (typeStatus) {
            results.medicationType = {
                name: medicationType,
                status: typeStatus
            };
            
            if (typeStatus === 'no') {
                results.canBook = false;
                results.reasons.push(`Medication type "${medicationType}" is not allowed`);
            }
        }
    }
    
    res.json(results);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        database: {
            conditions: Object.keys(database.conditions || {}).length,
            medications: Object.keys(database.medications || {}).length,
            medicationTypes: Object.keys(database.medication_types || {}).length
        }
    });
});

function saveDatabase() {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(database, null, 2));
        console.log('Database saved successfully');
    } catch (error) {
        console.error('Error saving database:', error);
    }
}

const PORT = process.env.PORT || 8084;
app.listen(PORT, () => {
    console.log(`Medic Mouse API server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});