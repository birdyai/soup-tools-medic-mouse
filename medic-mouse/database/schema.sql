-- Medic Mouse Database Schema

-- Table to store scraped messages
CREATE TABLE IF NOT EXISTS scraped_messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(50) UNIQUE NOT NULL,
    channel_id VARCHAR(50) NOT NULL,
    clinic_name VARCHAR(100),
    lead_name VARCHAR(100),
    conditions TEXT[], -- Array of conditions
    medications TEXT[], -- Array of medications
    medication_type VARCHAR(100),
    treatment VARCHAR(200),
    outcome_status VARCHAR(50), -- approved, rejected, approved_with_note
    outcome_details TEXT,
    outcome_requirements TEXT[], -- doctor_note, etc.
    timestamp TIMESTAMP,
    thread_replies INTEGER DEFAULT 0,
    raw_message JSONB, -- Store full message data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to store learned rules
CREATE TABLE IF NOT EXISTS learned_rules (
    id SERIAL PRIMARY KEY,
    rule_type VARCHAR(20) NOT NULL, -- 'condition' or 'medication'
    item_name VARCHAR(100) NOT NULL,
    clinic_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL, -- yes, no, yes_with_note
    requirements TEXT[],
    source_message_id VARCHAR(50),
    confidence_score DECIMAL(3,2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rule_type, item_name, clinic_name)
);

-- Table for unknown items that need checking
CREATE TABLE IF NOT EXISTS unknown_items (
    id SERIAL PRIMARY KEY,
    item_type VARCHAR(20) NOT NULL, -- 'condition' or 'medication'
    item_name VARCHAR(100) NOT NULL,
    clinic_name VARCHAR(100),
    first_seen_message_id VARCHAR(50),
    occurrence_count INTEGER DEFAULT 1,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_status VARCHAR(50),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_type, item_name, clinic_name)
);

-- Indexes for better query performance
CREATE INDEX idx_scraped_messages_clinic ON scraped_messages(clinic_name);
CREATE INDEX idx_scraped_messages_timestamp ON scraped_messages(timestamp);
CREATE INDEX idx_scraped_messages_outcome ON scraped_messages(outcome_status);
CREATE INDEX idx_learned_rules_lookup ON learned_rules(rule_type, item_name, clinic_name);
CREATE INDEX idx_unknown_items_unresolved ON unknown_items(resolved, item_type);

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scraped_messages_updated_at BEFORE UPDATE
    ON scraped_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learned_rules_updated_at BEFORE UPDATE
    ON learned_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();