// Test the parser locally without Slack
const { parseMessage, checkRules, loadRules } = require('./parser');

const testCases = [
  "Patient at Plush Aesthetics has diabetes",
  "Someone with high blood pressure wants botox at Aura",
  "Pregnant patient asking about laser treatment",
  "Client on Accutane for facial",
  "Person with melasma at Villa Aesthetics",
  "diabetic patient plush clinic",
  "Has epilepsy, wants treatment at NOVA",
  "On blood thinners, botox question"
];

async function runTests() {
  // Load rules first
  const fs = require('fs').promises;
  const path = require('path');
  const fuse = require('fuse.js');
  
  const data = await fs.readFile(path.join(__dirname, '../data/medical-rules.json'), 'utf8');
  const medicalRules = JSON.parse(data);
  
  console.log(`Loaded ${medicalRules.rules.length} medical rules\n`);
  
  // Extract clinics for reference
  const clinics = new Set();
  medicalRules.rules.forEach(rule => {
    rule.clinics.forEach(c => {
      if (!c.includes('None') && !c.includes('All clinics') && !c.includes('wait')) {
        clinics.add(c);
      }
    });
  });
  
  console.log('Available clinics:', Array.from(clinics).join(', '));
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Run test cases
  testCases.forEach((testCase, i) => {
    console.log(`Test ${i + 1}: "${testCase}"`);
    
    // This would use the actual parser from index.js
    // For now, showing expected format
    console.log('Expected parsing would extract:');
    console.log('- Clinic name (fuzzy matched)');
    console.log('- Medical conditions');
    console.log('- Treatment type');
    console.log('- Generate appropriate response\n');
  });
}

runTests().catch(console.error);