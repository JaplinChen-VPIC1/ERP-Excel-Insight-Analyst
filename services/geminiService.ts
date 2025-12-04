
import { GoogleGenAI, Type } from "@google/genai";
import { ExcelDataRow, AnalysisResult, Language, ChatAttachment, ChatMessage, AnalysisTemplate } from '../types';

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "A professional executive summary of the dataset suitable for ERP reporting. If answering a user question, address it here.",
    },
    keyInsights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of 3-5 specific, actionable insights derived from the data trends.",
    },
    charts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['bar', 'line', 'area', 'pie', 'scatter', 'radar'] },
          xAxisKey: { type: Type.STRING, description: "Exact column name to use for the X-axis (category)." },
          dataKey: { type: Type.STRING, description: "Exact column name to use for the Y-axis (numerical value)." },
          description: { type: Type.STRING, description: "Why this chart is relevant." },
        },
        required: ['id', 'title', 'type', 'xAxisKey', 'dataKey', 'description'],
      },
    },
  },
  required: ['summary', 'keyInsights', 'charts'],
};

// Helper to create client instance safely
const createAIClient = () => {
  // Ensure process is defined before accessing, mostly for safety in strict browser envs
  const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
  
  if (!apiKey) {
    console.error("API_KEY is missing from environment variables.");
    throw new Error("API Key is missing. Please ensure process.env.API_KEY is configured.");
  }
  
  return new GoogleGenAI({ apiKey: apiKey });
};

export const analyzeDataWithGemini = async (
  data: ExcelDataRow[], 
  language: Language,
  userPrompt?: string,
  image?: ChatAttachment,
  history?: ChatMessage[],
  templates?: AnalysisTemplate[]
): Promise<AnalysisResult> => {
  
  // Create a fresh client for each request to ensure validity
  const ai = createAIClient();

  // We send a sample of the data to avoid token limits, but enough to understand the schema and values.
  const sampleSize = 40; 
  const dataSample = data.slice(0, sampleSize);
  const headers = Object.keys(dataSample[0] || {}).join(', ');

  const languageName = {
    'zh-TW': 'Traditional Chinese (Taiwan)',
    'en-US': 'English',
    'vi-VN': 'Vietnamese'
  }[language];

  // Base Context (Default or Template-based)
  let baseContext = "";
  // More specific persona for better ERP context
  let roleInstruction = `You are a Senior ERP Data Analysis Consultant specializing in Digiwin Workflow ERP (鼎新 ERP). Your goal is to provide actionable business intelligence. Always respond in ${languageName}.`;

  if (templates && templates.length > 0) {
     // Use Custom Template Logic (Combined)
     const combinedInstructions = templates.map(t => t.systemInstruction).join('\n\n');
     const combinedPrompts = templates.map(t => `[Template: ${t.name}]\n${t.customPrompt}`).join('\n\n');

     roleInstruction = `${combinedInstructions}. Always respond in ${languageName}.`;
     baseContext = `
       ${combinedPrompts}

       I have provided a dataset.
       Column Headers: ${headers}
       Sample Data: ${JSON.stringify(dataSample)}
     `;
  } else {
    // Default Digiwin ERP Logic with enhanced module detection
    baseContext = `
    **Context:**
    The user has uploaded an Excel export from Digiwin Workflow ERP. Analyze the column headers to determine the module (Sales, Inventory, Production, Purchase, Finance).

    **Common Digiwin ERP Patterns & Analysis Strategies:**
    1. **Sales (COP)**: 'Customer', 'Sales Order', 'Product', 'Qty', 'Amount', 'Gross Margin'. 
       - *Charts*: Sales Trends (Line), Top Customers (Bar), Profit Margin (Bar).
    2. **Inventory (INV)**: 'Warehouse', 'Item No', 'Stock Qty', 'Safety Stock', 'Aging Days'. 
       - *Charts*: Stock by Warehouse (Bar/Pie), Aging Analysis (Bar), Stock vs Safety (Line).
    3. **Production (MO/SFC)**: 'MO No', 'Work Center', 'Planned Qty', 'Completed Qty', 'Scrap', 'Efficiency', 'Completion Rate'. 
       - *Charts*: Yield Rate (Line), Output by Line (Bar), Scrap Reasons (Pie).
       - *Logic*: If user asks for 'Completion Rate', use the 'Rate' column. If 'Count of MO', use 'MO No'.
    4. **Purchase (PUR)**: 'Vendor', 'PO No', 'Qty', 'Price', 'Delivery Date'. 
       - *Charts*: Spend by Vendor (Bar), Price Trends (Line).

    **Analysis Rules:**
    1. **Data Consistency**: 'dataKey' MUST be a numeric field. 'xAxisKey' MUST be a category or date field.
    2. **Chart Selection**:
       - Use **Line Chart** for dates/time trends (e.g., Daily/Monthly).
       - Use **Bar Chart** for comparing categories (e.g., Sales by Customer).
       - Use **Pie Chart** ONLY for small sets (< 8 categories).
       - Use **Scatter/Radar** for complex multi-metric comparisons.
    3. **Aggregation Logic** (Internal): 
       - If you choose a column with "ID", "No", or "Code" as 'dataKey', the system will automatically *COUNT* occurrences.
       - If you choose a column with "Rate", "Percent", "Avg" as 'dataKey', the system will automatically *AVERAGE* it.
       - Otherwise, it will *SUM* the values.
    
    **Dataset Info:**
    - Headers: ${headers}
    - Sample Data (first ${sampleSize} rows): ${JSON.stringify(dataSample)}
    `;
  }

  let taskPrompt = "";

  if (userPrompt || (history && history.length > 0)) {
    // Refinement Request
    taskPrompt = `
      **USER REQUEST:** "${userPrompt || "Based on previous context"}"

      **Your Task:**
      1.  **Analyze**: Answer the User Request specifically using the provided data history.
      2.  **Summary**: Update the 'summary' to directly answer the question or explain the new perspective.
      3.  **Charts**: Generate NEW specific 'charts' that visualize the answer. 
          - *CRITICAL*: 'dataKey' MUST be a numeric column from the JSON. 'xAxisKey' MUST be a categorical or date column.
      4.  **Insights**: Update 'keyInsights' to be relevant to this specific request.
      5.  **Language**: Output STRICTLY in ${languageName}.
    `;
    
    if (image) {
      taskPrompt += `\n**Image Context**: The user has attached an image. Use visual cues from it to inform your analysis if relevant.`;
    }

    if (history && history.length > 0) {
      const recentHistory = history.slice(-6).map(msg => 
        `${msg.role.toUpperCase()}: ${msg.content} ${msg.attachment ? '[Image Attached]' : ''}`
      ).join('\n');
      taskPrompt += `\n**Conversation History** (for context only):\n${recentHistory}`;
    }

  } else {
    // Initial analysis
    taskPrompt = `
      **Your Task:**
      Perform a comprehensive analysis of the provided ERP dataset.

      1.  **Executive Summary**: Write a professional summary of what this data represents. Identify high-level trends and anomalies.
      2.  **Key Insights**: Provide 3-5 specific, actionable bullet points. 
          - Focus on: "What is wrong?", "What is good?", "What should we do?".
          - Example: "Production efficiency dropped 15% in Line A due to high scrap rates."
      3.  **Strategic Charts**: Suggest up to 4 charts to best visualize performance.
          - Choose the most relevant metrics (e.g., Amount, Qty, Rate).
      
      **Language**: Output STRICTLY in ${languageName}.
    `;
  }

  try {
    const parts: any[] = [{ text: baseContext + taskPrompt }];

    if (image) {
      parts.unshift({
        inlineData: {
          mimeType: image.mimeType,
          data: image.content
        }
      });
    }

    const performRequest = async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: analysisSchema,
                systemInstruction: roleInstruction,
            },
        });
        return response;
    };

    // Retry Logic for Stability
    let response;
    try {
        response = await performRequest();
    } catch (err: any) {
        if (err.message && (err.message.includes('500') || err.message.includes('xhr') || err.message.includes('fetch') || err.message.includes('Rpc'))) {
             console.warn("Retrying Gemini request due to network/server error:", err.message);
             // Wait briefly
             await new Promise(r => setTimeout(r, 1000));
             response = await performRequest();
        } else {
            throw err;
        }
    }

    if (response && response.text) {
      return JSON.parse(response.text) as AnalysisResult;
    }
    throw new Error("No response generated from AI.");

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
