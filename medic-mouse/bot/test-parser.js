// Quick test script for the message parser
const fs = require('fs');
const path = require('path');

// Load medical rules
const medicalRules = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/medical-rules.json'), 'utf8'));

// Test messages
const testMessages = [
  "@medic-mouse Patient at Plush Aesthetics has diabetes",
  "@medic-mouse Client at Aura wants botox but is pregnant",
  "@medic-mouse Person with high blood pressure at Villa Aesthetics",
  "@medic-mouse Someone on accutane wants laser treatment",
  "@medic-mouse Patient at plush has PCOS",
  "@medic-mouse Client with thyroid issues for face treatment"
];

// Simple parser test
testMessages.forEach(msg => {
  console.log('\n-------------------');
  console.log('Message:', msg);
  
  // Extract conditions
  const conditions = [];
  if (/diabetes/i.test(msg)) conditions.push('Diabetes');
  if (/pregnant|pregnancy/i.test(msg)) conditions.push('Pregnancy');
  if (/high blood pressure|hypertension/i.test(msg)) conditions.push('High Blood Pressure');
  if (/accutane|isotretinoin/i.test(msg)) conditions.push('Accutane/Isotretinoin');
  if (/pcos/i.test(msg)) conditions.push('PCOS');
  if (/thyroid/i.test(msg)) conditions.push('Thyroid Disorders');
  
  console.log('Conditions found:', conditions);
  
  // Extract clinic
  const clinicMatch = msg.match(/at\s+([A-Za-z\s]+?)(?:\s+has|\s+wants|\s+for|$)/i);
  const clinic = clinicMatch ? clinicMatch[1].trim() : null;
  console.log('Clinic found:', clinic);
});