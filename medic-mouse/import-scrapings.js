#!/usr/bin/env node
/**
 * import-scrapings.js
 *
 * Walks every slack-scrape-*.json file in this directory and loads them
 * into the medic_mouse Postgres database (scraped_messages + learned_rules
 * + unknown_items). Idempotent — re-runs are safe (ON CONFLICT DO UPDATE).
 *
 * Usage:
 *   node import-scrapings.js                     # dry run (no writes)
 *   node import-scrapings.js --commit            # actually write to DB
 *   node import-scrapings.js --commit --quiet    # less per-row noise
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const COMMIT = process.argv.includes('--commit');
const QUIET = process.argv.includes('--quiet');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medic_mouse',
  user: process.env.DB_USER || 'markjarvis',
  password: process.env.DB_PASSWORD || ''
});

const SCRAPE_DIR = __dirname;

// Try to extract channel id from filename like
//   slack-scrape-C06N5CBN2TZ-2026-04-06T07-18-58-094Z.json
function channelIdFromFilename(filename) {
  const m = filename.match(/slack-scrape-(C[A-Z0-9]+)-/);
  return m ? m[1] : 'UNKNOWN';
}

function statusToRuleStatus(outcomeStatus) {
  switch ((outcomeStatus || '').toLowerCase()) {
    case 'approved': return 'yes';
    case 'approved_with_note': return 'yes_with_note';
    case 'rejected': return 'no';
    default: return null; // skip — no usable signal
  }
}

function cleanItemName(s) {
  if (!s) return '';
  let v = s
    .toString()
    .toLowerCase()
    .trim()
    .replace(/^[\-•*]\s+/, '')   // leading bullet
    .replace(/<https?:\/\/[^>|]+(?:\|([^>]+))?>/g, '$1') // <url|label> -> label
    .replace(/<[^>]+>/g, '')                              // strip leftover slack mentions
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  // schema caps item_name at varchar(100). Truncate gracefully.
  if (v.length > 100) v = v.slice(0, 97) + '...';
  return v;
}

function cleanClinicName(s) {
  if (!s) return '';
  return s
    .toString()
    .toLowerCase()
    .replace(/[*_~`]/g, '')      // mrkdwn cruft
    .replace(/<!subteam\^[A-Z0-9]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Skip obvious non-medical noise
const NOISE_TOKENS = new Set([
  '', 'no meds', 'none', 'no', 'n/a', 'na', 'nothing', 'nil', 'not on any', 'not on any meds'
]);
function isNoise(item) {
  return NOISE_TOKENS.has(item) || /^no medication/.test(item);
}

async function ensureSchema(client) {
  // Schema already exists in this DB, but be defensive on first runs.
  const schemaPath = path.join(__dirname, 'database', 'schema.sql');
  if (!fs.existsSync(schemaPath)) return;
  // No-op if already created (CREATE TABLE IF NOT EXISTS).
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await client.query(sql).catch(() => {/* trigger re-create harmless */});
}

async function upsertMessage(client, row) {
  const q = `
    INSERT INTO scraped_messages (
      message_id, channel_id, clinic_name, lead_name,
      conditions, medications, medication_type, treatment,
      outcome_status, outcome_details, outcome_requirements,
      timestamp, thread_replies, raw_message
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (message_id) DO UPDATE SET
      clinic_name = EXCLUDED.clinic_name,
      lead_name = EXCLUDED.lead_name,
      conditions = EXCLUDED.conditions,
      medications = EXCLUDED.medications,
      medication_type = EXCLUDED.medication_type,
      treatment = EXCLUDED.treatment,
      outcome_status = COALESCE(NULLIF(EXCLUDED.outcome_status,''), scraped_messages.outcome_status),
      outcome_details = EXCLUDED.outcome_details,
      outcome_requirements = EXCLUDED.outcome_requirements,
      thread_replies = EXCLUDED.thread_replies,
      updated_at = CURRENT_TIMESTAMP
    RETURNING (xmax = 0) AS inserted
  `;
  const vals = [
    row.message_id, row.channel_id, row.clinic_name, row.lead_name,
    row.conditions, row.medications, row.medication_type, row.treatment,
    row.outcome_status, row.outcome_details, row.outcome_requirements,
    row.timestamp, row.thread_replies, row.raw_message
  ];
  const r = await client.query(q, vals);
  return r.rows[0]?.inserted === true;
}

async function upsertRule(client, rule) {
  const q = `
    INSERT INTO learned_rules (
      rule_type, item_name, clinic_name, status,
      requirements, source_message_id, confidence_score
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (rule_type, item_name, clinic_name) DO UPDATE SET
      status = EXCLUDED.status,
      requirements = EXCLUDED.requirements,
      source_message_id = EXCLUDED.source_message_id,
      confidence_score = EXCLUDED.confidence_score,
      updated_at = CURRENT_TIMESTAMP
    RETURNING (xmax = 0) AS inserted
  `;
  const vals = [
    rule.rule_type, rule.item_name, rule.clinic_name, rule.status,
    rule.requirements, rule.source_message_id, rule.confidence_score
  ];
  const r = await client.query(q, vals);
  return r.rows[0]?.inserted === true;
}

async function upsertUnknown(client, item) {
  const q = `
    INSERT INTO unknown_items (
      item_type, item_name, clinic_name, first_seen_message_id
    ) VALUES ($1,$2,$3,$4)
    ON CONFLICT (item_type, item_name, clinic_name) DO UPDATE SET
      occurrence_count = unknown_items.occurrence_count + 1
    RETURNING (xmax = 0) AS inserted
  `;
  const vals = [item.item_type, item.item_name, item.clinic_name, item.first_seen_message_id];
  const r = await client.query(q, vals);
  return r.rows[0]?.inserted === true;
}

async function main() {
  const files = fs.readdirSync(SCRAPE_DIR)
    .filter(f => /^slack-scrape-.*\.json$/.test(f))
    .map(f => path.join(SCRAPE_DIR, f))
    .sort();

  console.log(`📂 Found ${files.length} scrape file(s)`);
  if (!COMMIT) console.log('🟡 DRY RUN — no DB writes (use --commit to actually write)');

  // Stats
  let filesProcessed = 0;
  let totalRecords = 0;
  let skippedNoClinic = 0;
  let skippedNoMessageTs = 0;
  let messagesInserted = 0;
  let messagesUpdated = 0;
  let rulesInserted = 0;
  let rulesUpdated = 0;
  let unknownsInserted = 0;
  let unknownsBumped = 0;

  // Pre-counts
  let pre = null;
  if (COMMIT) {
    const r = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM scraped_messages) AS msgs,
        (SELECT COUNT(*) FROM learned_rules) AS rules,
        (SELECT COUNT(*) FROM unknown_items) AS unknowns
    `);
    pre = r.rows[0];
    console.log(`📊 BEFORE: ${pre.msgs} messages, ${pre.rules} rules, ${pre.unknowns} unknowns`);
  }

  const client = COMMIT ? await pool.connect() : null;
  // Schema is already set up; skip re-running schema.sql inside a tx (its
  // CREATE OR REPLACE FUNCTION / trigger statements can poison a tx).
  // Use a SAVEPOINT per row so one bad insert can't poison the rest.

  try {
    for (const file of files) {
      filesProcessed++;
      const channelId = channelIdFromFilename(path.basename(file));
      let records;
      try {
        records = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        console.error(`❌ ${path.basename(file)} — invalid JSON: ${e.message}`);
        continue;
      }
      if (!Array.isArray(records)) {
        console.error(`❌ ${path.basename(file)} — not an array, skipping`);
        continue;
      }
      console.log(`\n📄 ${path.basename(file)} — ${records.length} record(s) [channel ${channelId}]`);

      for (const rec of records) {
        totalRecords++;
        const clinic = cleanClinicName(rec.clinic);
        if (!clinic) { skippedNoClinic++; continue; }

        // Synth a stable message_id when scrape predates messageTs field
        let messageId = rec.messageTs;
        if (!messageId) {
          // Stable short hash fallback (schema caps message_id at varchar(50))
          const stamp = rec.timestamp || 'no-ts';
          const raw = `${stamp}|${clinic}|${rec.firstName || ''}`;
          const hash = require('crypto').createHash('sha1').update(raw).digest('hex').slice(0, 16);
          messageId = `s:${hash}`; // 18 chars, well under 50
          skippedNoMessageTs++;
        }
        // Belt + braces: hard cap to 50 chars regardless of source
        if (messageId.length > 50) messageId = messageId.slice(0, 50);

        const conditions = (rec.conditions || []).map(cleanItemName).filter(c => c && !isNoise(c));
        const medications = (rec.medications || []).map(cleanItemName).filter(m => m && !isNoise(m));
        const outcome = rec.outcome || {};
        const ruleStatus = statusToRuleStatus(outcome.status);

        const msgRow = {
          message_id: messageId,
          channel_id: channelId,
          clinic_name: clinic,
          lead_name: (rec.firstName || '').toString().trim(),
          conditions,
          medications,
          medication_type: rec.medicationType || '',
          treatment: rec.treatment || '',
          outcome_status: outcome.status || '',
          outcome_details: outcome.details || '',
          outcome_requirements: outcome.requirements || [],
          timestamp: rec.timestamp ? new Date(rec.timestamp) : null,
          thread_replies: rec.threadReplies || 0,
          raw_message: rec
        };

        if (COMMIT) {
          try {
            await client.query('BEGIN');
            const inserted = await upsertMessage(client, msgRow);
            if (inserted) messagesInserted++; else messagesUpdated++;
            await client.query('COMMIT');
          } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            console.error(`  ⚠ msg ${messageId} failed: ${e.message}`);
            continue; // skip rules/unknowns for this row
          }
        }

        // Derive rules + unknowns
        const allItems = [
          ...conditions.map(c => ({ type: 'condition', name: c })),
          ...medications.map(m => ({ type: 'medication', name: m })),
        ];

        for (const it of allItems) {
          if (ruleStatus) {
            // Confident enough — write to learned_rules
            const rule = {
              rule_type: it.type,
              item_name: it.name,
              clinic_name: clinic,
              status: ruleStatus,
              requirements: outcome.requirements || [],
              source_message_id: messageId,
              confidence_score: 0.8 // single-message evidence; bumpable later
            };
            if (COMMIT) {
              try {
                await client.query('BEGIN');
                const inserted = await upsertRule(client, rule);
                if (inserted) rulesInserted++; else rulesUpdated++;
                await client.query('COMMIT');
              } catch (e) {
                await client.query('ROLLBACK').catch(() => {});
                console.error(`  ⚠ rule ${it.type}/${it.name}@${clinic} failed: ${e.message}`);
              }
            }
          } else {
            // No outcome → flag as unknown
            const unk = {
              item_type: it.type,
              item_name: it.name,
              clinic_name: clinic,
              first_seen_message_id: messageId,
            };
            if (COMMIT) {
              try {
                await client.query('BEGIN');
                const inserted = await upsertUnknown(client, unk);
                if (inserted) unknownsInserted++; else unknownsBumped++;
                await client.query('COMMIT');
              } catch (e) {
                await client.query('ROLLBACK').catch(() => {});
                console.error(`  ⚠ unknown ${it.type}/${it.name}@${clinic} failed: ${e.message}`);
              }
            }
          }
        }

        if (!QUIET && totalRecords % 50 === 0) {
          process.stdout.write(`  …${totalRecords} records seen\n`);
        }
      }
    }

  } catch (err) {
    console.error('\n💥 Error during import:', err);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
  }

  console.log('\n────────────────────────────────────────────');
  console.log(`📦 Files processed:        ${filesProcessed}`);
  console.log(`📦 Records seen:           ${totalRecords}`);
  console.log(`⏭  Skipped (no clinic):    ${skippedNoClinic}`);
  console.log(`⚠  No messageTs (synth'd): ${skippedNoMessageTs}`);
  if (COMMIT) {
    console.log(`✅ Messages inserted:      ${messagesInserted}`);
    console.log(`♻  Messages updated:       ${messagesUpdated}`);
    console.log(`✅ Rules inserted:         ${rulesInserted}`);
    console.log(`♻  Rules updated:          ${rulesUpdated}`);
    console.log(`✅ Unknowns inserted:      ${unknownsInserted}`);
    console.log(`♻  Unknowns bumped:        ${unknownsBumped}`);
    const r = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM scraped_messages) AS msgs,
        (SELECT COUNT(*) FROM learned_rules) AS rules,
        (SELECT COUNT(*) FROM unknown_items) AS unknowns
    `);
    console.log(`📊 AFTER:  ${r.rows[0].msgs} messages, ${r.rows[0].rules} rules, ${r.rows[0].unknowns} unknowns`);
    console.log(`📈 Δ:      +${r.rows[0].msgs - pre.msgs} messages, +${r.rows[0].rules - pre.rules} rules, +${r.rows[0].unknowns - pre.unknowns} unknowns`);
  } else {
    console.log('🟡 (dry run — pass --commit to actually write)');
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
