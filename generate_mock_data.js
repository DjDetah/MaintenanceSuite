import * as XLSX from 'xlsx';
import * as fs from 'fs';

// Define Mock Data for MTZ Main File
const data = [
    {
        "Numero": "INC-TEST-AUTO-001",
        "Breve descrizione": "Test Import Automatico",
        "Stato": "Aperto",
        "Data apertura": "2026-01-02",
        "Regione": "Lombardia", // Must match valid region
        "Violazione avvenuta": false
    },
    {
        "Numero": "INC-TEST-AUTO-002",
        "Breve descrizione": "Test Import Auto 2",
        "Stato": "Chiuso",
        "Data apertura": "2026-01-01",
        "Regione": "Sicilia",
        "Violazione avvenuta": true
    }
];

// Create Workbook
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(data);
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

// Write File (Name must contain MTZ and not OUT to be detected as Main)
const fileName = 'AAA_TEST_MTZ.xlsx';
XLSX.writeFile(wb, fileName);

console.log(`Generated ${fileName}`);
