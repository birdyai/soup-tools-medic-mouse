const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'medic_mouse',
    user: process.env.DB_USER || 'markjarvis',
    password: process.env.DB_PASSWORD || ''
});

// Initialize database schema
async function initializeDatabase() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('Database schema initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Save scraped message to database
async function saveScrapedMessage(messageData) {
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
        console.error('Error saving scraped message:', error);
        throw error;
    }
}

// Save learned rule to database
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
        console.error('Error saving learned rule:', error);
        throw error;
    }
}

// Get learned rules for analysis
async function getLearnedRules(clinic = null) {
    let query = 'SELECT * FROM learned_rules';
    const values = [];
    
    if (clinic) {
        query += ' WHERE clinic_name = $1';
        values.push(clinic.toLowerCase());
    }
    
    try {
        const result = await pool.query(query, values);
        return result.rows;
    } catch (error) {
        console.error('Error fetching learned rules:', error);
        return [];
    }
}

// Get scraped messages with pagination
async function getScrapedMessages(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM scraped_messages WHERE 1=1';
    const values = [];
    let valueIndex = 1;
    
    // Add filters
    if (filters.clinic) {
        query += ` AND clinic_name ILIKE $${valueIndex}`;
        values.push(`%${filters.clinic}%`);
        valueIndex++;
    }
    
    if (filters.outcome) {
        query += ` AND outcome_status = $${valueIndex}`;
        values.push(filters.outcome);
        valueIndex++;
    }
    
    if (filters.dateFrom) {
        query += ` AND timestamp >= $${valueIndex}`;
        values.push(filters.dateFrom);
        valueIndex++;
    }
    
    if (filters.dateTo) {
        query += ` AND timestamp <= $${valueIndex}`;
        values.push(filters.dateTo);
        valueIndex++;
    }
    
    // Add pagination
    query += ` ORDER BY timestamp DESC LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
    values.push(limit, offset);
    
    try {
        const result = await pool.query(query, values);
        
        // Get total count
        const countQuery = 'SELECT COUNT(*) FROM scraped_messages WHERE 1=1';
        const countResult = await pool.query(countQuery);
        const totalCount = parseInt(countResult.rows[0].count);
        
        return {
            messages: result.rows,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                limit: limit
            }
        };
    } catch (error) {
        console.error('Error fetching scraped messages:', error);
        return {
            messages: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalCount: 0,
                limit: limit
            }
        };
    }
}

// Save unknown item for review
async function saveUnknownItem(itemData) {
    const query = `
        INSERT INTO unknown_items (
            item_type, item_name, clinic_name, first_seen_message_id
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (item_type, item_name, clinic_name) DO UPDATE SET
            occurrence_count = unknown_items.occurrence_count + 1
        RETURNING id
    `;
    
    const values = [
        itemData.item_type,
        itemData.item_name.toLowerCase(),
        itemData.clinic_name?.toLowerCase() || null,
        itemData.message_id
    ];
    
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error saving unknown item:', error);
        throw error;
    }
}

// Get database statistics
async function getDatabaseStats() {
    try {
        const stats = {};
        
        // Total messages
        const messagesResult = await pool.query('SELECT COUNT(*) FROM scraped_messages');
        stats.totalMessages = parseInt(messagesResult.rows[0].count);
        
        // Messages by outcome
        const outcomesResult = await pool.query(`
            SELECT outcome_status, COUNT(*) as count 
            FROM scraped_messages 
            WHERE outcome_status IS NOT NULL 
            GROUP BY outcome_status
        `);
        stats.outcomeBreakdown = outcomesResult.rows;
        
        // Total learned rules
        const rulesResult = await pool.query('SELECT COUNT(*) FROM learned_rules');
        stats.totalRules = parseInt(rulesResult.rows[0].count);
        
        // Unknown items pending
        const unknownsResult = await pool.query('SELECT COUNT(*) FROM unknown_items WHERE resolved = false');
        stats.pendingUnknowns = parseInt(unknownsResult.rows[0].count);
        
        // Recent activity
        const recentResult = await pool.query(`
            SELECT COUNT(*) FROM scraped_messages 
            WHERE created_at > NOW() - INTERVAL '24 hours'
        `);
        stats.messagesLast24h = parseInt(recentResult.rows[0].count);
        
        return stats;
    } catch (error) {
        console.error('Error getting database stats:', error);
        return {
            totalMessages: 0,
            totalRules: 0,
            pendingUnknowns: 0,
            messagesLast24h: 0,
            outcomeBreakdown: []
        };
    }
}

module.exports = {
    pool,
    initializeDatabase,
    saveScrapedMessage,
    saveLearnedRule,
    getLearnedRules,
    getScrapedMessages,
    saveUnknownItem,
    getDatabaseStats
};