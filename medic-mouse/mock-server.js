const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Mock data
const mockData = {
  analytics: {
    totalQueries: 2847,
    successRate: 93,
    avgResponseTime: 1.2,
    activeClinics: 6,
    queryTrends: [120, 145, 180, 165, 200, 215, 230],
    topConditions: [
      { name: "Botox", count: 523 },
      { name: "Dental Checkup", count: 412 },
      { name: "Lip Fillers", count: 389 }
    ]
  },
  rules: {
    conditions: [
      { id: 1, name: "Botox", rejectionType: "universal", confidence: 0.95, clinics: ["All"], status: "active" },
      { id: 2, name: "Lip Fillers", rejectionType: "clinic-specific", confidence: 0.90, clinics: ["Bloom", "Glow"], status: "active" },
      { id: 3, name: "CoolSculpting", rejectionType: "conditional", confidence: 0.85, clinics: ["Elite"], status: "pending" },
      { id: 4, name: "Dental Cleaning", rejectionType: "none", confidence: 0.99, clinics: ["All"], status: "active" },
      { id: 5, name: "Dermal Fillers", rejectionType: "universal", confidence: 0.92, clinics: ["All"], status: "active" }
    ],
    total: 5
  },
  responses: {
    recent: [
      { 
        id: 1, 
        timestamp: new Date(Date.now() - 3600000).toISOString(), 
        query: "Can I get Botox at Bloom clinic?", 
        response: "Unfortunately, Botox is not covered under your insurance plan at any clinic.", 
        status: "rejected",
        confidence: 0.95,
        clinic: "Bloom"
      },
      { 
        id: 2, 
        timestamp: new Date(Date.now() - 7200000).toISOString(), 
        query: "Need dental checkup", 
        response: "Yes, dental checkups are covered! You can visit any of our partner clinics.", 
        status: "approved",
        confidence: 0.99,
        clinic: "All"
      },
      { 
        id: 3, 
        timestamp: new Date(Date.now() - 10800000).toISOString(), 
        query: "Is lip augmentation covered?", 
        response: "Lip augmentation procedures are not covered at Bloom and Glow clinics.", 
        status: "rejected",
        confidence: 0.90,
        clinic: "Bloom, Glow"
      }
    ]
  },
  testing: {
    status: "ready",
    lastTest: new Date().toISOString()
  }
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Serve static files
  if (pathname === '/' || pathname.endsWith('.html') || pathname.endsWith('.js') || pathname.endsWith('.css')) {
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      
      const ext = path.extname(filePath);
      const contentType = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css'
      }[ext] || 'text/plain';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
    return;
  }
  
  // API endpoints
  if (pathname === '/api/analytics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData.analytics));
  } else if (pathname === '/api/rules/v2') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData.rules));
  } else if (pathname === '/api/responses/recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData.responses));
  } else if (pathname === '/api/testing/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData.testing));
  } else if (pathname.startsWith('/api/')) {
    // Generic API response for other endpoints
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Mock response' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 57992;
server.listen(PORT, () => {
  console.log(`Mock API server running on port ${PORT}`);
  console.log('Serving API endpoints:');
  console.log('- /api/analytics');
  console.log('- /api/rules/v2');
  console.log('- /api/responses/recent');
  console.log('- /api/testing/status');
});