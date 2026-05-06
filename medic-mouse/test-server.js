const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8087;

const server = http.createServer((req, res) => {
    console.log(`Request: ${req.method} ${req.url}`);
    
    if (req.url === '/' || req.url === '/enhanced-dashboard.html') {
        const filePath = path.join(__dirname, 'enhanced-dashboard.html');
        
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading dashboard: ' + err.message);
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`Enhanced Medic Mouse Test Dashboard running at http://localhost:${PORT}`);
    console.log('Dashboard includes emoji shortcode conversion!');
});