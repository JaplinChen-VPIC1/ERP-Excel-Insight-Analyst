
import { FileSystemDirectoryHandle, FileSystemFileHandle } from '../types';

let rootHandle: FileSystemDirectoryHandle | null = null;

export const fileSystemService = {
  /**
   * Checks if the file system handle is active and ready.
   */
  isHandleReady: (): boolean => {
    return rootHandle !== null;
  },

  /**
   * Opens the directory picker and sets the root handle.
   * Logic: If the user picks a folder NOT named 'ERP_AI', try to create/open 'ERP_AI' inside it.
   */
  selectDirectory: async (): Promise<string> => {
    // @ts-ignore
    if (typeof window.showDirectoryPicker === 'undefined') {
        throw new Error("This browser does not support the File System Access API.");
    }

    try {
      // @ts-ignore - TypeScript doesn't know window.showDirectoryPicker yet in some envs
      let handle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });

      // Feature: Auto-create 'ERP_AI' if the user didn't pick a folder named that.
      if (handle.name !== 'ERP_AI') {
          try {
             const subHandle = await handle.getDirectoryHandle('ERP_AI', { create: true });
             handle = subHandle; 
          } catch (e) {
             console.warn("Could not auto-create ERP_AI subfolder, using selected folder instead.", e);
          }
      }

      rootHandle = handle;
      return handle.name;
    } catch (error: any) {
      if (error.name === 'AbortError') {
          throw error;
      }
      if (error.message && (error.message.includes('Cross origin') || error.message.includes('SecurityError'))) {
          console.warn("File System Access blocked: iframe detected.");
          throw new Error("Local file storage is blocked in this embedded preview. Please open the app in a new tab or full window to use this feature.");
      }
      console.error('Directory selection failed', error);
      throw error;
    }
  },

  getDir: async (name: string): Promise<FileSystemDirectoryHandle | null> => {
    if (!rootHandle) return null;
    try {
      return await rootHandle.getDirectoryHandle(name, { create: true });
    } catch (e) {
      console.error(`Failed to get dir ${name}`, e);
      return null;
    }
  },

  writeBinaryFile: async (dirName: string, fileName: string, content: Blob | File) => {
    // If dirName is empty, write to root
    let dir = rootHandle;
    if (dirName) {
        dir = await fileSystemService.getDir(dirName);
    }
    
    if (!dir) return;

    try {
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    } catch (e) {
        console.error(`Failed to write binary file ${dirName}/${fileName}`, e);
    }
  },

  readAllFiles: async (dirName: string): Promise<{ name: string; content: string }[]> => {
    // If dirName is empty, read from root
    let dir = rootHandle;
    if (dirName) {
        dir = await fileSystemService.getDir(dirName);
    }

    if (!dir) return [];

    const results: { name: string; content: string }[] = [];
    try {
      for await (const entry of dir.values()) {
        if (entry.kind === 'file') {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          const content = await file.text();
          results.push({ name: entry.name, content });
        }
      }
    } catch (e) {
      console.error(`Failed to read files from ${dirName}`, e);
    }
    return results;
  },

  saveExcelFile: async (file: File) => {
     await fileSystemService.writeBinaryFile('excel_history', file.name, file);
  }
};
