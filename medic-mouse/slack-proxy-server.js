const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const PORT = 8087;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/slack-proxy', (req, res) => {
    res.json({ status: 'ok', message: 'Slack proxy server is running' });
});

// Proxy endpoint for Slack API calls
app.post('/slack-proxy', async (req, res) => {
    const { url, token } = req.body;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get channel messages
app.post('/slack-proxy/messages', async (req, res) => {
    const { token, channel, limit, oldest, cursor } = req.body;
    
    try {
        let url = `https://slack.com/api/conversations.history?channel=${channel}&limit=${limit}`;
        if (oldest) url += `&oldest=${oldest}`;
        if (cursor) url += `&cursor=${cursor}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        // If successful and has messages with threads, fetch replies
        if (data.ok && data.messages) {
            for (let message of data.messages) {
                if (message.thread_ts) {
                    const repliesUrl = `https://slack.com/api/conversations.replies?channel=${channel}&ts=${message.thread_ts}`;
                    const repliesResponse = await fetch(repliesUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    const repliesData = await repliesResponse.json();
                    if (repliesData.ok) {
                        // Filter out the parent message
                        message.replies = repliesData.messages.filter(m => m.ts !== message.thread_ts);
                        message.reply_count = message.replies.length;
                    }
                }
            }
        }
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Slack proxy server running on http://localhost:${PORT}`);
});