// Create a test Excel file for CONSENTIMIENTO/RENUNCIA either-or logic
// Run with: node test-consentimiento-renuncia.js

const XLSX = require('xlsx');
const path = require('path');

// Test data based on the requirements (reference date: 2026-03-25)
const testData = [
  // Case 1: RENUNCIA expired later -> Should send RENUNCIA only
  {
    name: 'Case 1 - RENUNCIA Later',
    dni: 'CASE1',
    email: 'case1@test.com',
    position: 'Worker',
    certificates: [
      { category: 'CONSENTIMIENTO - 2025', expiration: '2026-01-10' },
      { category: 'RENUNCIA - 2025', expiration: '2026-02-10' },
    ]
  },
  // Case 2: CONSENTIMIENTO expired later -> Should send CONSENTIMIENTO only
  {
    name: 'Case 2 - CONSENTIMIENTO Later',
    dni: 'CASE2',
    email: 'case2@test.com',
    position: 'Worker',
    certificates: [
      { category: 'CONSENTIMIENTO - 2025', expiration: '2026-02-10' },
      { category: 'RENUNCIA - 2025', expiration: '2026-01-10' },
    ]
  },
  // Case 3: One not expired (CONSENTIMIENTO valid) -> Should send NOTHING
  {
    name: 'Case 3 - CONSENTIMIENTO Valid',
    dni: 'CASE3',
    email: 'case3@test.com',
    position: 'Worker',
    certificates: [
      { category: 'CONSENTIMIENTO - 2026', expiration: '2027-02-10' },
      { category: 'RENUNCIA - 2025', expiration: '2026-01-10' },
    ]
  },
  // Case 4: One not expired (RENUNCIA valid) -> Should send NOTHING
  {
    name: 'Case 4 - RENUNCIA Valid',
    dni: 'CASE4',
    email: 'case4@test.com',
    position: 'Worker',
    certificates: [
      { category: 'CONSENTIMIENTO - 2025', expiration: '2026-01-10' },
      { category: 'RENUNCIA - 2026', expiration: '2027-02-10' },
    ]
  },
  // Case 5: Both expired same date -> Should send CONSENTIMIENTO only
  {
    name: 'Case 5 - Same Date',
    dni: 'CASE5',
    email: 'case5@test.com',
    position: 'Worker',
    certificates: [
      { category: 'CONSENTIMIENTO - 2025', expiration: '2026-01-10' },
      { category: 'RENUNCIA - 2025', expiration: '2026-01-10' },
    ]
  },
  // Additional test: Only CONSENTIMIENTO expired (no RENUNCIA)
  {
    name: 'Case 6 - Only CONSENTIMIENTO',
    dni: 'CASE6',
    email: 'case6@test.com',
    position: 'Worker',
    certificates: [
      { category: 'CONSENTIMIENTO - 2025', expiration: '2026-01-10' },
    ]
  },
  // Additional test: Only RENUNCIA expired (no CONSENTIMIENTO)
  {
    name: 'Case 7 - Only RENUNCIA',
    dni: 'CASE7',
    email: 'case7@test.com',
    position: 'Worker',
    certificates: [
      { category: 'RENUNCIA - 2025', expiration: '2026-01-10' },
    ]
  },
  // Additional test: Other certificates should still work
  {
    name: 'Case 8 - Other Certificates',
    dni: 'CASE8',
    email: 'case8@test.com',
    position: 'Worker',
    certificates: [
      { category: 'FICHA - 2025', expiration: '2026-01-15' },
      { category: 'APTO - 2025', expiration: '2026-01-20' },
      { category: 'EPIS - 2025', expiration: '2026-01-25' },
    ]
  },
];

// Flatten test data into Excel rows
const excelData = [];

testData.forEach(testCase => {
  testCase.certificates.forEach(cert => {
    excelData.push({
      'Nombre Trabajador': testCase.name,
      'DNI': testCase.dni,
      'Puesto Trabajo': testCase.position,
      'Documentacion': cert.category,
      'Fecha Alta': '2025-01-01',
      'Fecha Caducidad': cert.expiration,
      'Email': testCase.email,
    });
  });
});

// Create workbook
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(excelData);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Worksheet');

// Save file
const outputPath = path.join(__dirname, 'test-consentimiento-renuncia-cases.xlsx');
XLSX.writeFile(wb, outputPath);

console.log('✅ Test Excel file created: ' + outputPath);
console.log('');
console.log('Test cases included:');
console.log('  Case 1: RENUNCIA expired later (10/02) vs CONSENTIMIENTO (10/01) -> Expect RENUNCIA only');
console.log('  Case 2: CONSENTIMIENTO expired later (10/02) vs RENUNCIA (10/01) -> Expect CONSENTIMIENTO only');
console.log('  Case 3: CONSENTIMIENTO valid (2027) vs RENUNCIA expired (10/01) -> Expect NOTHING');
console.log('  Case 4: CONSENTIMIENTO expired (10/01) vs RENUNCIA valid (2027) -> Expect NOTHING');
console.log('  Case 5: Both expired same date (10/01) -> Expect CONSENTIMIENTO only');
console.log('  Case 6: Only CONSENTIMIENTO expired -> Expect CONSENTIMIENTO');
console.log('  Case 7: Only RENUNCIA expired -> Expect RENUNCIA');
console.log('  Case 8: Other certificates (FICHA, APTO, EPIS) -> Expect all 3');
console.log('');
console.log('Upload this file to the app at http://localhost:3030 to test!');
