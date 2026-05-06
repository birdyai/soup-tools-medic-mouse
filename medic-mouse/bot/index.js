require('dotenv').config();
const { App } = require('@slack/bolt');
const fs = require('fs').promises;
const path = require('path');
const fuse = require('fuse.js');

// Initialize the app with your bot token
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// Load medical rules
let medicalRules = null;
let clinicFuse = null;

async function loadRules() {
  try {
    const data = await fs.readFile(path.join(__dirname, '../data/medical-rules.json'), 'utf8');
    medicalRules = JSON.parse(data);
    
    // Extract unique clinic names for fuzzy matching
    const uniqueClinics = new Set();
    medicalRules.rules.forEach(rule => {
      rule.clinics.forEach(clinic => {
        if (!clinic.includes('None') && !clinic.includes('All clinics') && !clinic.includes('wait')) {
          uniqueClinics.add(clinic);
        }
      });
    });
    
    // Setup fuzzy search
    const clinicList = Array.from(uniqueClinics).map(name => ({ name }));
    clinicFuse = new fuse(clinicList, {
      keys: ['name'],
      threshold: 0.4,
      includeScore: true
    });
    
    console.log('Medical rules loaded successfully');
    console.log(`Loaded ${medicalRules.rules.length} rules and ${clinicList.length} clinics`);
  } catch (error) {
    console.error('Error loading medical rules:', error);
  }
}

// Fuzzy clinic matching with confidence score
function findBestClinicMatch(inputClinic) {
  if (!clinicFuse || !inputClinic) return null;
  
  const results = clinicFuse.search(inputClinic);
  if (results.length > 0 && results[0].score < 0.6) {
    return {
      name: results[0].item.name,
      confidence: 1 - results[0].score
    };
  }
  
  return null;
}

// Enhanced message parser
function parseMessage(text) {
  const result = {
    clinic: null,
    conditions: [],
    medications: [],
    treatmentArea: null,
    rawText: text
  };
  
  // Condition mapping for better matching
  const conditionMappings = {
    'diabetes': 'Diabetes',
    'diabetic': 'Diabetes',
    'high blood pressure': 'High Blood Pressure',
    'hypertension': 'High Blood Pressure',
    'blood pressure': 'High Blood Pressure',
    'bp': 'High Blood Pressure',
    'accutane': 'Accutane/Isotretinoin',
    'isotretinoin': 'Accutane/Isotretinoin',
    'roaccutane': 'Accutane/Isotretinoin',
    'pregnant': 'Pregnancy',
    'pregnancy': 'Pregnancy',
    'blood thinner': 'Blood Thinners',
    'warfarin': 'Blood Thinners',
    'aspirin': 'Blood Thinners',
    'cancer': 'Cancer',
    'keloid': 'Keloids',
    'keloids': 'Keloids',
    'infection': 'Active Infection',
    'thyroid': 'Thyroid Disease',
    'autoimmune': 'Autoimmune Disease',
    'epilepsy': 'Epilepsy',
    'seizure': 'Epilepsy',
    'heart disease': 'Heart Disease',
    'heart condition': 'Heart Disease',
    'pcos': 'PCOS',
    'melasma': 'Melasma',
    'herpes': 'Herpes',
    'cold sore': 'Herpes',
    'cold sores': 'Herpes'
  };
  
  // Extract conditions
  const lowerText = text.toLowerCase();
  Object.entries(conditionMappings).forEach(([pattern, condition]) => {
    if (lowerText.includes(pattern) && !result.conditions.includes(condition)) {
      result.conditions.push(condition);
    }
  });
  
  // Extract clinic name - multiple patterns
  const clinicPatterns = [
    /(?:at|@)\s+([A-Za-z\s]+?)(?:\.|,|$|wants|for|has)/i,
    /clinic:\s*([A-Za-z\s]+?)(?:\.|,|$)/i,
    /([A-Za-z\s]+?)\s+(?:clinic|aesthetics|medical)/i,
    /for\s+([A-Za-z\s]+?)(?:\.|,|$|patient)/i
  ];
  
  for (const pattern of clinicPatterns) {
    const match = text.match(pattern);
    if (match) {
      const potentialClinic = match[1].trim();
      const clinicMatch = findBestClinicMatch(potentialClinic);
      if (clinicMatch && clinicMatch.confidence > 0.6) {
        result.clinic = clinicMatch.name;
        break;
      }
    }
  }
  
  // Extract treatment area
  const treatments = {
    'laser': 'Laser Treatment',
    'botox': 'Botox',
    'filler': 'Filler',
    'hydrafacial': 'Hydrafacial',
    'face': 'Facial Treatment',
    'body': 'Body Treatment',
    'hair removal': 'Laser Hair Removal',
    'chemical peel': 'Chemical Peel',
    'microneedling': 'Microneedling'
  };
  
  Object.entries(treatments).forEach(([pattern, treatment]) => {
    if (lowerText.includes(pattern)) {
      result.treatmentArea = treatment;
    }
  });
  
  return result;
}

// Check rules and generate response
function checkRules(parsedData) {
  if (!medicalRules) {
    return {
      text: "❌ ERROR: Medical rules not loaded. Please contact support.",
      blocks: []
    };
  }
  
  let overallStatus = 'allowed';
  const ruleResults = [];
  const notes = [];
  
  // If no conditions found
  if (parsedData.conditions.length === 0) {
    return {
      text: "❓ No medical conditions detected",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "❓ *UNCLEAR - Please provide more information*\n\nI couldn't detect any medical conditions in your message."
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Please include:*\n• Clinic name (e.g., 'at Plush Aesthetics')\n• Medical conditions\n• Treatment type"
          }
        }
      ]
    };
  }
  
  // Check each condition
  parsedData.conditions.forEach(condition => {
    const rule = medicalRules.rules.find(r => 
      r.condition === condition ||
      r.condition.toLowerCase() === condition.toLowerCase()
    );
    
    if (rule) {
      let status = 'unknown';
      let clinicStatus = '';
      
      // Check clinic restrictions
      if (rule.clinics.some(c => c.includes('None'))) {
        status = 'contraindicated';
        clinicStatus = 'NOT ALLOWED at any clinic';
        overallStatus = 'contraindicated';
      } else if (rule.clinics.some(c => c.includes('All clinics'))) {
        status = 'allowed';
        clinicStatus = 'Allowed at all clinics';
        if (rule.clinics[0].includes('wait')) {
          const waitMatch = rule.clinics[0].match(/wait (\d+) months?/);
          if (waitMatch) {
            clinicStatus += ` (wait ${waitMatch[1]} months)`;
            notes.push(`⏱️ ${condition}: Must wait ${waitMatch[1]} months after last dose`);
          }
        }
      } else if (parsedData.clinic) {
        const isAllowed = rule.clinics.some(c => 
          c.toLowerCase() === parsedData.clinic.toLowerCase()
        );
        if (isAllowed) {
          status = 'allowed';
          clinicStatus = `Allowed at ${parsedData.clinic}`;
        } else {
          status = 'restricted';
          clinicStatus = `NOT allowed at ${parsedData.clinic}`;
          overallStatus = overallStatus === 'allowed' ? 'restricted' : overallStatus;
        }
      } else {
        status = 'needs-clinic';
        clinicStatus = `Allowed only at: ${rule.clinics.join(', ')}`;
        overallStatus = overallStatus === 'allowed' ? 'needs-info' : overallStatus;
      }
      
      // Add exceptions as notes
      if (status === 'allowed' && rule.exceptions.length > 0) {
        rule.exceptions.forEach(exc => {
          notes.push(`📋 ${condition}: ${exc}`);
        });
      }
      
      ruleResults.push({
        condition: rule.condition,
        status,
        clinicStatus,
        confidence: rule.confidence || 1.0
      });
    }
  });
  
  // Generate response blocks
  const blocks = [];
  
  // Header block based on overall status
  if (overallStatus === 'contraindicated') {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "❌ *NO - TREATMENT NOT ALLOWED*"
      }
    });
  } else if (overallStatus === 'restricted') {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "⚠️ *RESTRICTED - CHECK CLINIC*"
      }
    });
  } else if (overallStatus === 'needs-info') {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "❓ *MORE INFO NEEDED*"
      }
    });
  } else {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "✅ *YES - TREATMENT ALLOWED*"
      }
    });
  }
  
  // Add detected info
  if (parsedData.clinic || parsedData.treatmentArea) {
    let detectedInfo = "*Detected:*\n";
    if (parsedData.clinic) detectedInfo += `• Clinic: ${parsedData.clinic}\n`;
    if (parsedData.treatmentArea) detectedInfo += `• Treatment: ${parsedData.treatmentArea}\n`;
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: detectedInfo
      }
    });
  }
  
  // Add condition results
  if (ruleResults.length > 0) {
    let conditionText = "*Conditions:*\n";
    ruleResults.forEach(result => {
      const emoji = result.status === 'allowed' ? '✅' : 
                    result.status === 'contraindicated' ? '❌' : 
                    result.status === 'restricted' ? '⚠️' : '❓';
      conditionText += `${emoji} *${result.condition}*: ${result.clinicStatus}\n`;
    });
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: conditionText
      }
    });
  }
  
  // Add notes if any
  if (notes.length > 0) {
    blocks.push({
      type: "divider"
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Important Notes:*\n" + notes.join('\n')
      }
    });
  }
  
  // Generate plain text summary
  const plainText = blocks.map(block => 
    block.text ? block.text.text : ''
  ).join('\n').replace(/\*/g, '');
  
  return { text: plainText, blocks };
}

// Listen for app mentions
app.event('app_mention', async ({ event, say }) => {
  try {
    console.log('Received mention:', event.text);
    
    // Remove the bot mention from the text
    const cleanText = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    
    // Parse the message
    const parsedData = parseMessage(cleanText);
    console.log('Parsed data:', parsedData);
    
    // Check rules and generate response
    const response = checkRules(parsedData);
    
    // Reply in thread
    await say({
      text: response.text,
      blocks: response.blocks,
      thread_ts: event.ts
    });
  } catch (error) {
    console.error('Error handling mention:', error);
    await say({
      text: "❌ Sorry, I encountered an error processing your request.",
      thread_ts: event.ts
    });
  }
});

// Health check endpoint
app.receiver.router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    rulesLoaded: medicalRules !== null,
    ruleCount: medicalRules ? medicalRules.rules.length : 0
  });
});

// Start the app
(async () => {
  await loadRules();
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Medic Mouse is running!');
  console.log(`Health check available at http://localhost:${process.env.PORT || 3000}/health`);
})();