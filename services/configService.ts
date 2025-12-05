
import { AnalysisTemplate, AnalysisGroup } from '../types';
import { fileSystemService } from './fileSystemService';

// Storage Keys
const KEYS = {
  TEMPLATES: 'app_templates',
  GROUPS: 'app_groups',
};

// --- Storage Helpers ---
const save = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));
const load = <T>(key: string): T[] => {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : [];
};

/**
 * REFACTORED: This service now strictly manages Configuration (Groups/Templates)
 * and handles the sync with EXCEL_AI.json.
 */
export const configService = {
  // Config File Name - Fixed
  CONFIG_FILENAME: 'EXCEL_AI.json',

  // Templates CRUD
  getTemplates: () => load<AnalysisTemplate>(KEYS.TEMPLATES),
  saveTemplate: (tmpl: AnalysisTemplate) => {
    const list = load<AnalysisTemplate>(KEYS.TEMPLATES);
    const index = list.findIndex(t => t.id === tmpl.id);
    if (index >= 0) list[index] = tmpl;
    else list.push(tmpl);
    save(KEYS.TEMPLATES, list);
    configService.syncToDisk();
  },
  deleteTemplate: (id: string) => {
    const list = load<AnalysisTemplate>(KEYS.TEMPLATES).filter(t => t.id !== id);
    save(KEYS.TEMPLATES, list);
    configService.syncToDisk();
  },

  // Groups CRUD
  getGroups: () => load<AnalysisGroup>(KEYS.GROUPS),
  saveGroup: (group: AnalysisGroup) => {
    const list = load<AnalysisGroup>(KEYS.GROUPS);
    const index = list.findIndex(g => g.id === group.id);
    if (index >= 0) list[index] = group;
    else list.push(group);
    save(KEYS.GROUPS, list);
    configService.syncToDisk();
  },
  deleteGroup: (id: string) => {
    const list = load<AnalysisGroup>(KEYS.GROUPS).filter(g => g.id !== id);
    save(KEYS.GROUPS, list);
    configService.syncToDisk();
  },

  // --- Export / Import Logic (JSON only) ---
  
  exportConfigData: () => {
    return {
      groups: load<AnalysisGroup>(KEYS.GROUPS),
      templates: load<AnalysisTemplate>(KEYS.TEMPLATES),
      exportedAt: new Date().toISOString(),
      version: '3.0'
    };
  },

  importConfigData: (data: any) => {
    if (!data) throw new Error("Invalid config file");
    if (data.groups) save(KEYS.GROUPS, data.groups);
    if (data.templates) save(KEYS.TEMPLATES, data.templates);
  },
  
  // --- File System Sync Logic ---
  
  /**
   * Auto-load EXCEL_AI.json from root of storage
   */
  loadAutoConfig: async () => {
      if (!fileSystemService.isHandleReady()) return false;
      try {
          const files = await fileSystemService.readAllFiles(''); 
          const configFile = files.find(f => f.name === configService.CONFIG_FILENAME);
          
          if (configFile) {
              const json = JSON.parse(configFile.content);
              configService.importConfigData(json);
              console.log(`Auto-loaded ${configService.CONFIG_FILENAME}`);
              return true;
          }
      } catch (e) {
          console.warn("Failed to auto-load config", e);
      }
      return false;
  },

  syncToDisk: async () => {
     if (!fileSystemService.isHandleReady()) return false;
     try {
         const configObject = configService.exportConfigData();
         
         const blob = new Blob([JSON.stringify(configObject, null, 2)], { type: 'application/json' });
         // Save to root directory
         await fileSystemService.writeBinaryFile('', configService.CONFIG_FILENAME, blob);
         
         return true;
     } catch (e) {
         console.error("Sync to disk failed", e);
         return false;
     }
  }
};
