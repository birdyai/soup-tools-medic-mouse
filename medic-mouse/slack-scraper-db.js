#!/usr/bin/env node

/**
 * Enhanced Slack Channel Scraper CLI with Direct Database Saving
 * Usage: node slack-scraper-db.js <bot-token> <channel-id> [batch-size] [days-back]
 * Example: node slack-scraper-db.js xoxb-token C0XXXXXXXXX 10 7
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'medic_mouse',
    user: 'markjarvis',
    password: ''
});

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node slack-scraper-db.js <bot-token> <channel-id> [batch-size] [days-back]');
    console.error('Example: node slack-scraper-db.js xoxb-your-token C0XXXXXXXXX 10 7');
    process.exit(1);
}

const [token, channelId, batchSizeArg = '10', daysBackArg = '7'] = args;
const batchSize = parseInt(batchSizeArg);
const daysBack = parseInt(daysBackArg);

console.log(`🔍 Starting Slack channel scraper with database integration...`);
console.log(`📍 Channel: ${channelId}`);
console.log(`📊 Batch size: ${batchSize} messages`);
console.log(`📅 Looking back: ${daysBack} days`);
console.log(`💾 Saving directly to PostgreSQL database`);

// Helper function to make Slack API calls
function slackApiCall(method, params = {}) {
    return new Promise((resolve, reject) => {
        const queryParams = new URLSearchParams(params).toString();
        const options = {
            hostname: 'slack.com',
            path: `/api/${method}${queryParams ? '?' + queryParams : ''}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        
        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (!result.ok) {
                        reject(new Error(`Slack API error: ${result.error}`));
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Helper function to parse message text
function parseMessage(text) {
    const lines = text.split('\n');
    const parsed = {
        clinic: '',
        firstName: '',
        conditions: [],
        medications: [],
        medicationType: '',
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
        } else if (cleanLine.includes('Medication Type')) {
            parsed.medicationType = cleanLine.split(/Medication Type:/)[1]?.trim();
        } else if (cleanLine.includes('Treating:')) {
            parsed.treatment = cleanLine.split('Treating:')[1].trim();
        }
    });
    
    return parsed;
}

// Helper function to extract outcome from replies
function extractOutcome(replies) {
    let outcome = {
        status: '',
        details: '',
        requirements: []
    };
    
    replies.forEach(reply => {
        const text = reply.text.toLowerCase();
        const originalText = reply.text;
        
        if (text.includes('❌') || text.includes('cannot book') || text.includes(' no ') || text.includes('universal no')) {
            outcome.status = 'rejected';
            if (text.includes('says:') || text.includes('confirmed:')) {
                outcome.details = originalText;
            }
        } else if (text.includes('✅') || text.includes('booked')) {
            if (text.includes('doctor note') || text.includes('with note')) {
                outcome.status = 'approved_with_note';
                outcome.requirements = ['doctor_note'];
            } else {
                outcome.status = 'approved';
            }
        } else if (text.includes('pending') || text.includes('requires')) {
            outcome.status = 'approved_with_note';
            if (text.includes('oncologist')) {
                outcome.requirements = ['oncologist_letter'];
            }
        } else if (text.includes('postponed') || text.includes('wait')) {
            outcome.status = 'rejected';
            outcome.details = originalText;
        }
        
        if (text.includes('says:') || text.includes('confirmed:')) {
            outcome.details = originalText;
        }
    });
    
    return outcome;
}

// Save message to database
async function saveToDatabase(messageData) {
    const query = `
        INSERT INTO scraped_messages (
            message_id, channel_id, clinic_name, lead_name,
            conditions, medications, medication_type, treatment,
            outcome_status, outcome_details, outcome_requirements,
            timestamp, thread_replies, raw_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (message_id) DO UPDATE SET
            outcome_status = EXCLUDED.outcome_status,
            outcome_details = EXCLUDED.outcome_details,
            outcome_requirements = EXCLUDED.outcome_requirements,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id
    `;
    
    const values = [
        messageData.message_id,
        messageData.channel_id,
        messageData.clinic_name,
        messageData.lead_name,
        messageData.conditions || [],
        messageData.medications || [],
        messageData.medication_type,
        messageData.treatment,
        messageData.outcome_status,
        messageData.outcome_details,
        messageData.outcome_requirements || [],
        messageData.timestamp,
        messageData.thread_replies || 0,
        messageData.raw_message || {}
    ];
    
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error saving to database:', error.message);
        throw error;
    }
}

// Save learned rules
async function saveLearnedRule(ruleData) {
    const query = `
        INSERT INTO learned_rules (
            rule_type, item_name, clinic_name, status,
            requirements, source_message_id, confidence_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (rule_type, item_name, clinic_name) DO UPDATE SET
            status = EXCLUDED.status,
            requirements = EXCLUDED.requirements,
            confidence_score = EXCLUDED.confidence_score,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id
    `;
    
    const values = [
        ruleData.rule_type,
        ruleData.item_name.toLowerCase(),
        ruleData.clinic_name.toLowerCase(),
        ruleData.status,
        ruleData.requirements || [],
        ruleData.source_message_id,
        ruleData.confidence_score || 1.00
    ];
    
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error saving rule:', error.message);
    }
}

// Main function to fetch and process messages
async function scrapeChannel() {
    const oldest = Math.floor((Date.now() - (daysBack * 24 * 60 * 60 * 1000)) / 1000);
    let cursor = null;
    let hasMore = true;
    let totalMessages = 0;
    let savedMessages = 0;
    let newRules = 0;
    const allData = [];
    
    console.log('\n📊 Processing messages...\n');
    
    while (hasMore && totalMessages < 1000) { // Safety limit
        try {
            // Fetch messages
            const params = {
                channel: channelId,
                limit: batchSize,
                oldest: oldest
            };
            if (cursor) params.cursor = cursor;
            
            process.stdout.write(`\r⏳ Fetching batch ${Math.floor(totalMessages / batchSize) + 1}...`);
            const response = await slackApiCall('conversations.history', params);
            
            if (response.messages && response.messages.length > 0) {
                // Process each message
                for (const message of response.messages) {
                    const parsed = parseMessage(message.text || '');
                    
                    if (parsed.clinic && parsed.firstName) {
                        // Fetch thread replies if any
                        let replies = [];
                        if (message.reply_count > 0) {
                            try {
                                const threadResponse = await slackApiCall('conversations.replies', {
                                    channel: channelId,
                                    ts: message.ts
                                });
                                replies = threadResponse.messages.slice(1); // Skip the parent message
                            } catch (e) {
                                console.error(`Error fetching replies for ${message.ts}:`, e.message);
                            }
                        }
                        
                        const outcome = extractOutcome(replies);
                        
                        // Save to database
                        try {
                            const dbData = {
                                message_id: message.ts,
                                channel_id: channelId,
                                clinic_name: parsed.clinic,
                                lead_name: parsed.firstName,
                                conditions: parsed.conditions,
                                medications: parsed.medications,
                                medication_type: parsed.medicationType,
                                treatment: parsed.treatment,
                                outcome_status: outcome.status,
                                outcome_details: outcome.details,
                                outcome_requirements: outcome.requirements,
                                timestamp: new Date(parseFloat(message.ts) * 1000).toISOString(),
                                thread_replies: message.reply_count || 0,
                                raw_message: { text: message.text, user: message.user }
                            };
                            
                            await saveToDatabase(dbData);
                            savedMessages++;
                            
                            // Save learned rules if outcome exists
                            if (outcome.status) {
                                const status = outcome.status === 'approved' ? 'yes' :
                                             outcome.status === 'approved_with_note' ? 'yes_with_note' :
                                             outcome.status === 'rejected' ? 'no' : 'unknown';
                                
                                for (const condition of parsed.conditions) {
                                    await saveLearnedRule({
                                        rule_type: 'condition',
                                        item_name: condition,
                                        clinic_name: parsed.clinic,
                                        status: status,
                                        requirements: outcome.requirements,
                                        source_message_id: message.ts
                                    });
                                    newRules++;
                                }
                                
                                for (const medication of parsed.medications) {
                                    await saveLearnedRule({
                                        rule_type: 'medication',
                                        item_name: medication,
                                        clinic_name: parsed.clinic,
                                        status: status,
                                        requirements: outcome.requirements,
                                        source_message_id: message.ts
                                    });
                                    newRules++;
                                }
                            }
                            
                            // Also collect for JSON backup
                            allData.push({
                                ...parsed,
                                outcome,
                                timestamp: new Date(parseFloat(message.ts) * 1000).toISOString(),
                                threadReplies: message.reply_count || 0,
                                messageTs: message.ts
                            });
                            
                            process.stdout.write(`\r✅ Processed ${totalMessages + 1} messages, saved ${savedMessages} to database, ${newRules} rules learned`);
                        } catch (dbError) {
                            console.error(`\nError saving message ${message.ts}:`, dbError.message);
                        }
                    }
                }
                
                totalMessages += response.messages.length;
                
                // Check for more messages
                if (response.has_more && response.response_metadata?.next_cursor) {
                    cursor = response.response_metadata.next_cursor;
                } else {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
            
        } catch (error) {
            console.error('\n❌ Error:', error.message);
            hasMore = false;
        }
    }
    
    console.log('\n\n✅ Scraping complete!');
    console.log(`📊 Total messages processed: ${totalMessages}`);
    console.log(`💾 Messages saved to database: ${savedMessages}`);
    console.log(`🧠 New rules learned: ${newRules}`);
    
    // Also save JSON backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `slack-scrape-${channelId}-${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(allData, null, 2));
    console.log(`📄 Backup saved to: ${filename}`);
    
    // Close database connection
    await pool.end();
}

// Run the scraper
scrapeChannel().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});