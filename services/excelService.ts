
import * as XLSX from 'xlsx';
import { ExcelDataRow } from '../types';

export const parseExcelFile = async (file: File): Promise<ExcelDataRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("File is empty"));
          return;
        }

        // Use 'array' type for ArrayBuffer, which is more robust than binary strings
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
            reject(new Error("Excel file has no sheets"));
            return;
        }

        let bestSheetName = "";
        let bestHeaderIndex = 0;
        let maxScore = -1;

        // Check up to first 3 sheets to find the most data-rich one
        // This handles cases where Sheet 1 is a summary/title page and Sheet 2 has the actual data.
        const sheetsToCheck = workbook.SheetNames.slice(0, 3);

        for (const sheetName of sheetsToCheck) {
            const sheet = workbook.Sheets[sheetName];
            // Convert to AOA to inspect structure without parsing keys yet
            const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

            if (!aoa || aoa.length === 0) continue;

            // Header Detection Logic (per sheet)
            let currentHeaderIndex = 0;
            let currentMaxCols = 0;
            const searchLimit = Math.min(aoa.length, 25);

            for (let i = 0; i < searchLimit; i++) {
                const row = aoa[i];
                if (!row) continue;
                // Count valid cells (not null/undefined/empty string)
                const filledCells = row.filter(cell => 
                    cell !== null && cell !== undefined && String(cell).trim() !== ''
                ).length;
                
                // If this row has significantly more columns than what we've seen, it's likely the header
                if (filledCells > currentMaxCols) {
                    currentMaxCols = filledCells;
                    currentHeaderIndex = i;
                }
            }

            // Score calculation: (Total Rows - Header Offset) * Columns
            // This favors sheets with actual data tables over summary sheets with few cells.
            if (currentMaxCols > 0) {
                const rowCount = aoa.length;
                const dataRowCount = Math.max(0, rowCount - currentHeaderIndex);
                const score = dataRowCount * currentMaxCols;
                
                // console.log(`Sheet: ${sheetName}, HeaderIdx: ${currentHeaderIndex}, Cols: ${currentMaxCols}, Rows: ${dataRowCount}, Score: ${score}`);

                if (score > maxScore) {
                    maxScore = score;
                    bestSheetName = sheetName;
                    bestHeaderIndex = currentHeaderIndex;
                }
            }
        }

        // Fallback: If no good sheet found, just try the first one with index 0
        if (!bestSheetName) {
             bestSheetName = workbook.SheetNames[0];
             bestHeaderIndex = 0;
        }

        // Final Processing on Best Sheet
        const finalSheet = workbook.Sheets[bestSheetName];
        
        // Convert to JSON using the detected header row from the best sheet
        const jsonData = XLSX.utils.sheet_to_json(finalSheet, { 
          range: bestHeaderIndex,
          defval: null // Ensure empty cells are null, not undefined
        }) as ExcelDataRow[];
        
        if (jsonData.length === 0) {
          reject(new Error("No data found in the Excel sheet"));
          return;
        }

        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => {
      reject(err);
    };

    // Use readAsArrayBuffer instead of readAsBinaryString
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parses multiple Excel files and merges them into a single dataset.
 * It assumes the files have similar schemas, or at least that merging them is the desired intent.
 */
export const parseMultipleExcelFiles = async (files: File[]): Promise<ExcelDataRow[]> => {
    try {
        const promises = files.map(file => parseExcelFile(file));
        const results = await Promise.all(promises);
        
        // Flatten array of arrays into a single array
        return results.flat();
    } catch (error) {
        console.error("Error parsing multiple files:", error);
        throw error;
    }
};
