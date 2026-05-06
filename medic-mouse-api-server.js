const http = require('http');
const url = require('url');

// Mock data
const mockData = {
  analytics: {
    totalQueries: 2847,
    successRate: 93,
    avgResponseTime: 1.2,
    activeClinics: 6
  },
  rules: {
    conditions: [
      { id: 1, name: "Botox", rejectionType: "universal", confidence: 0.95 },
      { id: 2, name: "Lip Fillers", rejectionType: "clinic-specific", confidence: 0.90 },
      { id: 3, name: "CoolSculpting", rejectionType: "conditional", confidence: 0.85 }
    ]
  },
  responses: {
    recent: [
      { id: 1, timestamp: new Date().toISOString(), query: "Can I get Botox?", response: "Unfortunately, Botox is not covered", status: "rejected" },
      { id: 2, timestamp: new Date().toISOString(), query: "Dental checkup needed", response: "Yes, dental checkups are covered", status: "approved" }
    ]
  }
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // API endpoints
  if (parsedUrl.pathname === '/api/analytics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData.analytics));
  } else if (parsedUrl.pathname === '/api/rules/v2') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData.rules));
  } else if (parsedUrl.pathname === '/api/responses/recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData.responses));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(3000, () => {
  console.log('Mock API server running on port 3000');
});