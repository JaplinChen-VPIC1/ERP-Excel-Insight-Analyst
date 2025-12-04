
export interface ChartConfig {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'radar';
  xAxisKey: string;
  dataKey: string;
  description: string;
  color?: string;
}

export interface AnalysisResult {
  summary: string;
  keyInsights: string[];
  charts: ChartConfig[];
}

export interface ExcelDataRow {
  [key: string]: string | number | boolean | null;
}

export interface ChatAttachment {
  type: 'image';
  content: string; // Base64 string
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  attachment?: ChatAttachment;
}

export enum AppState {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export type Language = 'zh-TW' | 'en-US' | 'vi-VN';

// --- Configuration Features ---

export interface AnalysisTemplate {
  id: string;
  name: string;
  description: string;
  systemInstruction: string; // The "Persona" or Role definition
  customPrompt: string;      // Specific analysis instructions
}

export interface AnalysisGroup {
  id: string;
  name: string; // e.g. "CEO View", "Sales Manager"
  description: string;
  templateIds: string[]; // Changed from templateId to templateIds for multi-select
}

// --- File System Access Types (Polyfill-like) ---
export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: any): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  values(): AsyncIterableIterator<FileSystemHandle>;
}

export interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
  close(): Promise<void>;
}
