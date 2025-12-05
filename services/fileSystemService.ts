
import { FileSystemDirectoryHandle, FileSystemFileHandle } from '../types';

let rootHandle: FileSystemDirectoryHandle | null = null;

// --- IndexedDB Helper for Persisting Handles ---
const DB_NAME = 'ERP_AI_DB';
const STORE_NAME = 'handles';
const KEY_ROOT = 'root_dir';

const idb = {
  open: (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  put: async (handle: FileSystemDirectoryHandle) => {
    const db = await idb.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, KEY_ROOT);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  get: async (): Promise<FileSystemDirectoryHandle | undefined> => {
    const db = await idb.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_ROOT);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
};

export const fileSystemService = {
  /**
   * Checks if the file system handle is active and ready in memory.
   */
  isHandleReady: (): boolean => {
    return rootHandle !== null;
  },

  /**
   * Tries to retrieve a persisted handle from IndexedDB.
   */
  getStoredHandle: async (): Promise<FileSystemDirectoryHandle | null> => {
    try {
      const handle = await idb.get();
      return handle || null;
    } catch (e) {
      console.warn("IndexedDB access failed", e);
      return null;
    }
  },

  /**
   * Sets the root handle directly (e.g., after restoring from DB).
   */
  setRootHandle: (handle: FileSystemDirectoryHandle) => {
    rootHandle = handle;
  },

  /**
   * Verifies if we have permission to access the handle.
   * If 'withPrompt' is true, it will show the browser permission prompt if needed.
   */
  verifyPermission: async (handle: FileSystemDirectoryHandle, withPrompt: boolean): Promise<boolean> => {
    try {
        // @ts-ignore
        const opts = { mode: 'readwrite' };
        // @ts-ignore
        if ((await handle.queryPermission(opts)) === 'granted') {
          return true;
        }
        if (withPrompt) {
          // @ts-ignore
          if ((await handle.requestPermission(opts)) === 'granted') {
            return true;
          }
        }
        return false;
    } catch (e) {
        console.warn("Permission verification failed (likely security restriction):", e);
        return false;
    }
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
      // Persist to IndexedDB
      await idb.put(handle);
      
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
