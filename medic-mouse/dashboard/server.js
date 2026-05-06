const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Path to the medical rules JSON file
const RULES_FILE = path.join(__dirname, '../data/medical-rules.json');

// API endpoint to get rules
app.get('/api/rules', async (req, res) => {
    try {
        const data = await fs.readFile(RULES_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading rules:', error);
        res.status(500).json({ error: 'Failed to read rules' });
    }
});

// API endpoint to update rules
app.post('/api/rules', async (req, res) => {
    try {
        const data = JSON.stringify(req.body, null, 2);
        await fs.writeFile(RULES_FILE, data, 'utf8');
        res.json({ success: true, message: 'Rules updated successfully' });
    } catch (error) {
        console.error('Error writing rules:', error);
        res.status(500).json({ error: 'Failed to update rules' });
    }
});

// Serve the dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Medic Mouse Dashboard running at http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server');
});