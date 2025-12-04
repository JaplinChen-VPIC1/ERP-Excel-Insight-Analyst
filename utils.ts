
import * as XLSX from 'xlsx';
import { ExcelDataRow, AnalysisResult, Language } from './types';
import { translations } from './i18n';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import PptxGenJS from 'pptxgenjs';

// Simple color palette for charts
export const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
];

export const PALETTES = {
  default: CHART_COLORS,
  pastel: [
    '#93c5fd', // blue-300
    '#fca5a5', // red-300
    '#6ee7b7', // emerald-300
    '#fcd34d', // amber-300
    '#c4b5fd', // violet-300
    '#f9a8d4', // pink-300
    '#67e8f9', // cyan-300
  ],
  vibrant: [
    '#2563eb', // blue-600
    '#dc2626', // red-600
    '#059669', // emerald-600
    '#d97706', // amber-600
    '#7c3aed', // violet-600
    '#db2777', // pink-600
    '#0891b2', // cyan-600
  ],
  ocean: [
    '#0c4a6e', // sky-900
    '#0369a1', // sky-700
    '#0284c7', // sky-600
    '#38bdf8', // sky-400
    '#7dd3fc', // sky-300
    '#bae6fd', // sky-200
    '#e0f2fe', // sky-100
  ],
  warm: [
    '#78350f', // amber-900
    '#b45309', // amber-700
    '#d97706', // amber-600
    '#fbbf24', // amber-400
    '#fcd34d', // amber-300
    '#fde68a', // amber-200
    '#fffbeb', // amber-50
  ],
  neon: [
    '#facc15', // yellow-400
    '#a3e635', // lime-400
    '#22d3ee', // cyan-400
    '#e879f9', // fuchsia-400
    '#f472b6', // pink-400
    '#818cf8', // indigo-400
    '#fb923c', // orange-400
  ]
};

const DATE_REGEX_8DIGIT = /^\d{8}$/;
const DATE_REGEX_6DIGIT = /^(19|20)\d{2}(0[1-9]|1[0-2])$/; // YYYYMM

/**
 * Helper to detect column type
 */
export const detectColumnType = (data: ExcelDataRow[], column: string): 'date' | 'number' | 'string' => {
  // 1. Force String for specific identifiers
  const colLower = column.toLowerCase();
  const stringKeywords = ['id', 'no', 'code', '單號', '編號', '料號', '工號', '客代', '廠商', '品號', '規格'];
  if (stringKeywords.some(kw => colLower.includes(kw))) {
    return 'string';
  }

  let numberCount = 0;
  let dateCount = 0;
  let sampleCount = 0;
  const maxSamples = 100;

  for (const row of data) {
    if (sampleCount >= maxSamples) break;
    const val = row[column];
    if (val === null || val === undefined || val === '') continue;
    
    sampleCount++;
    const strVal = String(val).trim();
    
    // Strict number check
    if (!isNaN(Number(val)) && strVal !== '') {
      numberCount++;
    }
    
    // Date Check
    if (DATE_REGEX_8DIGIT.test(strVal) || DATE_REGEX_6DIGIT.test(strVal)) {
       dateCount++;
    } 
    else if (!isNaN(Date.parse(strVal)) && (strVal.includes('-') || strVal.includes('/'))) {
       dateCount++;
    }
  }

  if (sampleCount > 0 && dateCount / sampleCount > 0.8) return 'date';
  if (sampleCount > 0 && numberCount / sampleCount > 0.9) return 'number';
  return 'string';
};

/**
 * Safe date parser
 */
export const parseDateSafe = (value: string): number => {
    if (!value) return 0;
    const strVal = String(value).trim();
    
    // Handle YYYYMMDD
    if (DATE_REGEX_8DIGIT.test(strVal)) {
      const y = parseInt(strVal.substring(0, 4));
      const m = parseInt(strVal.substring(4, 6)) - 1;
      const d = parseInt(strVal.substring(6, 8));
      return new Date(y, m, d).getTime();
    }
    
    // Handle YYYYMM (Assume 1st of month)
    if (DATE_REGEX_6DIGIT.test(strVal)) {
      const y = parseInt(strVal.substring(0, 4));
      const m = parseInt(strVal.substring(4, 6)) - 1;
      return new Date(y, m, 1).getTime();
    }

    return new Date(strVal).getTime();
};

/**
 * Clean and Enrich Data
 * 1. Fix invalid dates (e.g., 0025 -> 2025)
 * 2. Recalculate date differences if relevant columns exist
 */
export const cleanAndEnrichData = (data: ExcelDataRow[]): ExcelDataRow[] => {
  if (!data || data.length === 0) return data;
  
  const headers = Object.keys(data[0]);
  
  // Detect date columns
  const dateCols = headers.filter(h => detectColumnType(data, h) === 'date' || h.includes('日') || h.includes('Date'));

  // Detect Difference Columns (e.g. 差異天數)
  const diffCol = headers.find(h => h.includes('差異') || h.includes('Diff'));
  // Detect associated Date Columns for recalculation
  // e.g. 預計(Planned) vs 實際(Actual) / 交貨(Delivery)
  const plannedCol = headers.find(h => h.includes('預') || h.includes('Plan') || h.includes('Target'));
  const actualCol = headers.find(h => (h.includes('實') || h.includes('Actual') || h.includes('交')) && h !== diffCol && h !== plannedCol);

  return data.map(row => {
    const newRow = { ...row };
    let rowChanged = false;

    // 1. Fix Dates
    dateCols.forEach(col => {
      let val = String(newRow[col] || '').trim();
      if (!val) return;

      // Fix 0025 -> 2025 (8 digit)
      if (val.length === 8 && (val.startsWith('00') || val.startsWith('02'))) {
         const yearPrefix = val.substring(0, 2);
         if (yearPrefix === '00' || yearPrefix === '02') {
             // Assume 20xx
             const fixedVal = '20' + val.substring(2);
             newRow[col] = fixedVal;
             rowChanged = true;
         }
      }
      // Fix 0025/MM/DD or similar formats
      else if ((val.startsWith('00') || val.startsWith('02')) && (val.includes('/') || val.includes('-'))) {
         const parts = val.split(/[-/]/);
         if (parts[0].length === 4 && (parts[0].startsWith('00') || parts[0].startsWith('02'))) {
             parts[0] = '20' + parts[0].substring(2);
             newRow[col] = parts.join('/');
             rowChanged = true;
         }
      }
    });

    // 2. Recalculate Difference if dates changed
    if (rowChanged && diffCol && plannedCol && actualCol) {
        const d1 = parseDateSafe(String(newRow[plannedCol]));
        const d2 = parseDateSafe(String(newRow[actualCol]));
        
        if (d1 && d2) {
            // Diff in Days
            const diffTime = d2 - d1; 
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            newRow[diffCol] = diffDays;
        }
    }

    return newRow;
  });
};

/**
 * Format a number with thousands separator.
 */
export const formatNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Format a number with compact notation for chart axes.
 */
export const formatCompactNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (isNaN(num)) return String(value);

  return new Intl.NumberFormat('en-US', {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1
  }).format(num);
};

/**
 * Aggregates data for charts.
 */
export const aggregateData = (
  data: ExcelDataRow[],
  xAxisKey: string,
  dataKey: string
): any[] => {
  const map = new Map<string, { sum: number; count: number }>();
  
  // 1. Determine Aggregation Mode
  let mode: 'sum' | 'count' | 'average' = 'sum';
  
  const keyLower = dataKey.toLowerCase();
  
  // Logic for Average
  if (keyLower.includes('rate') || keyLower.includes('percent') || keyLower.includes('avg') || keyLower.includes('yield') || keyLower.includes('率') || keyLower.includes('平均') || keyLower.includes('占比') || keyLower.includes('達成')) {
    mode = 'average';
  }
  // Logic for Count (Explicit ID columns)
  else if (keyLower.includes('id') || keyLower.includes('no') || keyLower.includes('code') || keyLower.includes('號') || keyLower.includes('單') || keyLower.includes('代碼')) {
      mode = 'count';
  }

  // Fallback: Check if content is non-numeric string (force count)
  if (mode === 'sum') {
    const firstValid = data.find(r => r[dataKey] !== null && r[dataKey] !== undefined);
    if (firstValid) {
       const val = firstValid[dataKey];
       if (typeof val === 'string' && isNaN(Number(val))) {
           mode = 'count';
       }
    }
  }

  // 2. Aggregate
  data.forEach((row) => {
    const xValue = row[xAxisKey];
    const yValue = row[dataKey];

    // Skip if xValue is missing
    if (xValue === undefined || xValue === null) return;

    const key = String(xValue);
    let numVal = 0;

    if (mode === 'count') {
      numVal = 1; // Count existence
    } else {
      numVal = parseFloat(String(yValue));
      if (isNaN(numVal)) numVal = 0;
    }

    const current = map.get(key) || { sum: 0, count: 0 };
    map.set(key, {
      sum: current.sum + numVal,
      count: current.count + 1
    });
  });

  // 3. Finalize results
  const result = Array.from(map.entries())
    .map(([name, stat]) => {
      let finalValue = stat.sum;
      
      if (mode === 'average' && stat.count > 0) {
        finalValue = stat.sum / stat.count;
      }

      return {
        [xAxisKey]: name,
        [dataKey]: finalValue,
        name: name,
        value: finalValue,
      };
    });

  // 4. Sort and Slice
  // Check if X-Axis is likely a Date/Time
  const xColType = detectColumnType(data.slice(0, 50), xAxisKey);
  
  if (xColType === 'date' || xAxisKey.toLowerCase().includes('date') || xAxisKey.toLowerCase().includes('日')) {
      // For Time Series: Sort by Date Descending (to find latest), Slice 12, then Reverse for Chart
      return result.sort((a, b) => {
          const keyA = String(a.name);
          const keyB = String(b.name);
          // Try parse
          const dateA = parseDateSafe(keyA) || keyA;
          const dateB = parseDateSafe(keyB) || keyB;
          if (dateA > dateB) return -1;
          if (dateA < dateB) return 1;
          return 0;
      })
      .slice(0, 12)
      .sort((a, b) => {
          // Sort back to Ascending for display
          const keyA = String(a.name);
          const keyB = String(b.name);
          const dateA = parseDateSafe(keyA) || keyA;
          const dateB = parseDateSafe(keyB) || keyB;
           if (dateA > dateB) return 1;
          if (dateA < dateB) return -1;
          return 0;
      });
  } else {
      // For Categories: Sort by Value Descending (Top N)
      return result
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);
  }
};

/**
 * Exports data to CSV
 */
export const exportToCSV = (data: ExcelDataRow[], filename: string) => {
  if (!data || !data.length) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Exports data to JSON
 */
export const exportToJSON = (data: ExcelDataRow[], filename: string) => {
  if (!data || !data.length) return;
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Exports data to Excel with multiple sheets
 */
export const exportToExcel = (
  data: ExcelDataRow[], 
  filename: string,
  analysis: AnalysisResult | null,
  language: Language
) => {
  if (!data || !data.length) return;
  
  const t = translations[language];
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Insights & Summary
  if (analysis) {
    const ws1_data: any[][] = [];
    const merges: XLSX.Range[] = [];

    ws1_data.push([t.reportTitle.toUpperCase()]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }); 
    ws1_data.push([]); 

    ws1_data.push([t.aiSummary]);
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 6 } }); 
    
    ws1_data.push([analysis.summary]);
    merges.push({ s: { r: 3, c: 0 }, e: { r: 4, c: 6 } }); 
    ws1_data.push([]); 
    ws1_data.push([]); 

    ws1_data.push(["KEY INSIGHTS"]);
    merges.push({ s: { r: 6, c: 0 }, e: { r: 6, c: 6 } });

    analysis.keyInsights.forEach((insight, idx) => {
        const rowIdx = ws1_data.length;
        ws1_data.push([`${idx + 1}. ${insight}`]);
        merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 6 } }); 
    });

    const sheet1 = XLSX.utils.aoa_to_sheet(ws1_data);
    sheet1['!merges'] = merges;
    sheet1['!cols'] = [{ wch: 100 }];

    XLSX.utils.book_append_sheet(workbook, sheet1, t.sheetInsights);
  }

  // Sheet 2: Pivot Analysis Tables
  if (analysis && analysis.charts) {
    let ws2_data: any[][] = [];
    ws2_data.push(["VISUAL ANALYSIS DATA"]);
    ws2_data.push([]);

    analysis.charts.forEach((chart, index) => {
        ws2_data.push([`CHART #${index + 1}: ${chart.title}`]);
        ws2_data.push([`Analysis: ${chart.description}`]);
        ws2_data.push([]); 
        ws2_data.push([chart.xAxisKey, chart.dataKey]); 

        const aggData = aggregateData(data, chart.xAxisKey, chart.dataKey);
        
        aggData.forEach(item => {
            ws2_data.push([item[chart.xAxisKey], item[chart.dataKey]]);
        });

        const total = aggData.reduce((sum, item) => sum + (item[chart.dataKey] || 0), 0);
        ws2_data.push(["Total", total]);
        
        ws2_data.push([]);
        ws2_data.push([]);
        ws2_data.push([]);
    });

    const sheet2 = XLSX.utils.aoa_to_sheet(ws2_data);
    sheet2['!cols'] = [{ wch: 30 }, { wch: 20 }];
    
    XLSX.utils.book_append_sheet(workbook, sheet2, t.sheetCharts);
  }

  // Sheet 3: Raw Data
  const sheet3 = XLSX.utils.json_to_sheet(data);
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.min(30, Math.max(10, key.length + 5))
  }));
  sheet3['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, sheet3, t.sheetData);

  XLSX.writeFile(workbook, filename);
};

/**
 * Exports to PDF
 */
export const exportToPDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    const canvas = await html2canvas(element, {
      scale: 2, 
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const margin = 10; 
    const imgWidth = 210 - (margin * 2); 
    const pageHeight = 297; 
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = margin; 

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight; 
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, - (pageHeight - margin) + (heightLeft % pageHeight) , imgWidth, imgHeight); 
      heightLeft -= 297;
    }
    
    pdf.save(filename);
  } catch (error) {
    console.error("PDF Export failed:", error);
    throw error;
  }
};

/**
 * Exports to PPTX
 */
export const exportToPPTX = async (
  analysis: AnalysisResult, 
  filename: string,
  language: Language
) => {
  const t = translations[language];
  const pptx = new PptxGenJS();
  
  const slide1 = pptx.addSlide();
  slide1.addText(t.reportTitle, { x: 0.5, y: 1.5, w: '90%', fontSize: 36, bold: true, align: 'center', color: '363636' });
  slide1.addText(`${t.poweredBy}`, { x: 0.5, y: 3.5, w: '90%', fontSize: 18, align: 'center', color: '888888' });
  slide1.addText(new Date().toLocaleDateString(), { x: 0.5, y: 4.5, w: '90%', fontSize: 14, align: 'center', color: 'aaaaaa' });

  const slide2 = pptx.addSlide();
  slide2.addText(t.aiSummary, { x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '2563EB' });
  slide2.addText(analysis.summary, { x: 0.5, y: 1.2, w: '90%', h: 3, fontSize: 14, color: '333333', valign: 'top' });
  
  const slide3 = pptx.addSlide();
  slide3.addText('Key Insights', { x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '2563EB' });
  const insightsText = analysis.keyInsights.map((insight, idx) => `${idx + 1}. ${insight}`).join('\n\n');
  slide3.addText(insightsText, { x: 0.5, y: 1.2, w: '90%', h: 4, fontSize: 14, color: '333333', valign: 'top' });

  for (let i = 0; i < analysis.charts.length; i++) {
    const chartConfig = analysis.charts[i];
    const chartElement = document.getElementById(`chart-container-${i}`);
    
    if (chartElement) {
      const slide = pptx.addSlide();
      slide.addText(chartConfig.title, { x: 0.5, y: 0.4, w: '90%', fontSize: 20, bold: true, color: '333333' });
      slide.addText(chartConfig.description, { x: 0.5, y: 0.9, w: '90%', fontSize: 12, color: '666666' });

      try {
        const canvas = await html2canvas(chartElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/png');
        
        slide.addImage({ data: imgData, x: 0.5, y: 1.5, w: 9, h: 3.8, sizing: { type: 'contain', w: 9, h: 3.8 } });
      } catch (err) {
        console.error(`Failed to capture chart ${i}`, err);
        slide.addText("Image Capture Failed", { x: 4, y: 3, color: 'FF0000' });
      }
    }
  }

  pptx.writeFile({ fileName: filename });
};

/**
 * Export specific element to Image
 */
export const exportToImage = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  try {
    const canvas = await html2canvas(element, { 
      scale: 2, 
      useCORS: true, 
      logging: false,
      backgroundColor: '#ffffff' // Ensure white background
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Export image failed', err);
  }
};
