const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

// Serve static files
app.use(express.static(__dirname));

// Proxy API requests to the backend
app.use('/api', createProxyMiddleware({
    target: 'http://localhost:8084',
    changeOrigin: true
}));

// Serve the dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'medic-mouse-test-dashboard-live.html'));
});

const PORT = 8085;
app.listen(PORT, () => {
    console.log(`Dashboard server running on http://localhost:${PORT}`);
});