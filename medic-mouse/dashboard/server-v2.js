const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json());
app.use(express.static(__dirname));

// Path to the medical rules JSON file
const RULES_FILE_V2 = path.join(__dirname, '../data/medical-rules-v2.json');
const RULES_FILE_V1 = path.join(__dirname, '../data/medical-rules.json');

// API endpoint to get rules (v2)
app.get('/api/rules/v2', async (req, res) => {
    try {
        const data = await fs.readFile(RULES_FILE_V2, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading rules v2:', error);
        res.status(500).json({ error: 'Failed to read rules' });
    }
});

// API endpoint to update rules (v2)
app.post('/api/rules/v2', async (req, res) => {
    try {
        const data = JSON.stringify(req.body, null, 2);
        await fs.writeFile(RULES_FILE_V2, data, 'utf8');
        res.json({ success: true, message: 'Rules updated successfully' });
    } catch (error) {
        console.error('Error writing rules v2:', error);
        res.status(500).json({ error: 'Failed to update rules' });
    }
});

// Legacy v1 endpoints for compatibility
app.get('/api/rules', async (req, res) => {
    try {
        const data = await fs.readFile(RULES_FILE_V1, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading rules v1:', error);
        res.status(500).json({ error: 'Failed to read rules' });
    }
});

app.post('/api/rules', async (req, res) => {
    try {
        const data = JSON.stringify(req.body, null, 2);
        await fs.writeFile(RULES_FILE_V1, data, 'utf8');
        res.json({ success: true, message: 'Rules updated successfully' });
    } catch (error) {
        console.error('Error writing rules v1:', error);
        res.status(500).json({ error: 'Failed to update rules' });
    }
});

// Serve the dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-v2.html'));
});

app.listen(PORT, () => {
    console.log(`Medic Mouse Dashboard v2 running at http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server');
});