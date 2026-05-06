#!/usr/bin/env node
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs').promises;

// Configuration
const config = {
    token: process.argv[2],
    channelId: process.argv[3],
    batchSize: parseInt(process.argv[4]) || 10,
    dateRange: parseInt(process.argv[5]) || 7
};

if (!config.token || !config.channelId) {
    console.error('Usage: node slack-scraper-cli.js <token> <channelId> [batchSize] [daysBack]');
    console.error('Example: node slack-scraper-cli.js xoxb-123... C0RNSC8N2TZ 10 7');
    process.exit(1);
}

// Emoji mapping
const emojiMap = {
    ':hospital:': '🏥',
    ':woman-raising-hand:': '🙋‍♀️',
    ':stethoscope:': '🩺',
    ':pill:': '💊',
    ':clipboard:': '📋',
    ':syringe:': '💉'
};

function convertEmojis(text) {
    let converted = text;
    Object.keys(emojiMap).forEach(code => {
        converted = converted.replace(new RegExp(code, 'g'), emojiMap[code]);
    });
    return converted;
}

function parseMessage(text) {
    const lines = text.split('\n');
    const parsed = {
        clinic: '',
        firstName: '',
        conditions: [],
        medications: [],
        treatment: ''
    };
    
    lines.forEach(line => {
        const cleanLine = line.replace(/:[a-zA-Z0-9_-]+:\s*/g, '');
        
        if (cleanLine.includes('Clinic Name:')) {
            parsed.clinic = cleanLine.split('Clinic Name:')[1].trim();
        } else if (cleanLine.includes('Lead First Name:')) {
            parsed.firstName = cleanLine.split('Lead First Name:')[1].trim();
        } else if (cleanLine.includes('Medical Condition:')) {
            const conditions = cleanLine.split('Medical Condition:')[1].trim();
            if (conditions && conditions.toLowerCase() !== 'none') {
                parsed.conditions = conditions.split(',').map(c => c.trim());
            }
        } else if (cleanLine.includes('Current Medications')) {
            const meds = cleanLine.split(/Current Medications?:/)[1]?.trim();
            if (meds && meds.toLowerCase() !== 'none') {
                parsed.medications = meds.split(',').map(m => m.trim());
            }
        } else if (cleanLine.includes('Treating:')) {
            parsed.treatment = cleanLine.split('Treating:')[1].trim();
        }
    });
    
    return parsed;
}

async function fetchMessages(oldest, cursor = null) {
    let url = `https://slack.com/api/conversations.history?channel=${config.channelId}&limit=${config.batchSize}`;
    if (oldest) url += `&oldest=${oldest}`;
    if (cursor) url += `&cursor=${cursor}`;
    
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${config.token}` }
    });
    
    const data = await response.json();
    if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
    
    // Fetch thread replies
    for (const message of data.messages || []) {
        if (message.thread_ts) {
            const repliesUrl = `https://slack.com/api/conversations.replies?channel=${config.channelId}&ts=${message.thread_ts}`;
            const repliesResponse = await fetch(repliesUrl, {
                headers: { 'Authorization': `Bearer ${config.token}` }
            });
            
            const repliesData = await repliesResponse.json();
            if (repliesData.ok) {
                message.replies = repliesData.messages.filter(m => m.ts !== message.thread_ts);
            }
        }
    }
    
    return data;
}

async function scrapeSlack() {
    console.log('🚀 Starting Slack scraper...');
    console.log(`Channel: ${config.channelId}`);
    console.log(`Batch size: ${config.batchSize}`);
    console.log(`Date range: Last ${config.dateRange} days`);
    
    const oldest = Math.floor((Date.now() - (config.dateRange * 24 * 60 * 60 * 1000)) / 1000);
    let cursor = null;
    let hasMore = true;
    let totalMessages = 0;
    let allMessages = [];
    
    while (hasMore && totalMessages < 250) {
        console.log(`\n📥 Fetching batch ${Math.floor(totalMessages / config.batchSize) + 1}...`);
        
        try {
            const data = await fetchMessages(oldest, cursor);
            const messages = data.messages || [];
            
            console.log(`Found ${messages.length} messages`);
            
            for (const message of messages) {
                const parsed = parseMessage(convertEmojis(message.text));
                if (parsed.clinic && parsed.firstName) {
                    const outcome = extractOutcome(message.replies || []);
                    
                    console.log(`\n📋 Message ${totalMessages + 1}:`);
                    console.log(`  Clinic: ${parsed.clinic}`);
                    console.log(`  Patient: ${parsed.firstName}`);
                    console.log(`  Conditions: ${parsed.conditions.join(', ') || 'None'}`);
                    console.log(`  Medications: ${parsed.medications.join(', ') || 'None'}`);
                    console.log(`  Outcome: ${outcome.status || 'Unknown'}`);
                    
                    allMessages.push({
                        ...parsed,
                        outcome,
                        timestamp: new Date(parseInt(message.ts) * 1000).toISOString(),
                        threadReplies: message.replies ? message.replies.length : 0
                    });
                }
            }
            
            totalMessages += messages.length;
            cursor = data.response_metadata?.next_cursor;
            hasMore = data.has_more && cursor;
            
        } catch (error) {
            console.error(`\n❌ Error: ${error.message}`);
            hasMore = false;
        }
    }
    
    // Save results
    const outputFile = `slack-scrape-${Date.now()}.json`;
    await fs.writeFile(outputFile, JSON.stringify(allMessages, null, 2));
    
    console.log(`\n✅ Scraping complete!`);
    console.log(`Total messages processed: ${totalMessages}`);
    console.log(`Medical queries found: ${allMessages.length}`);
    console.log(`Results saved to: ${outputFile}`);
}

function extractOutcome(replies) {
    let outcome = {
        status: '',
        requirements: []
    };
    
    replies.forEach(reply => {
        const text = reply.text.toLowerCase();
        
        if (text.includes('❌') || text.includes('cannot book') || text.includes(' no ')) {
            outcome.status = 'rejected';
        } else if (text.includes('✅') || text.includes('booked')) {
            if (text.includes('doctor note')) {
                outcome.status = 'approved_with_note';
                outcome.requirements = ['doctor_note'];
            } else {
                outcome.status = 'approved';
            }
        }
    });
    
    return outcome;
}

// Run the scraper
scrapeSlack().catch(console.error);