
import React, { useState, useEffect } from 'react';
import { ExcelDataRow, AnalysisResult, AppState, Language, AnalysisGroup, AnalysisTemplate } from './types';
import { parseMultipleExcelFiles } from './services/excelService';
import { analyzeDataWithGemini } from './services/geminiService';
import { configService } from './services/configService';
import { fileSystemService } from './services/fileSystemService';
import { cleanAndEnrichData } from './utils';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import ChatBot from './components/ChatBot';
import ConfigManager from './components/ConfigManager';
import { Bot, AlertCircle, Globe, Settings, FileSpreadsheet, Play, X, Layers, MessageSquare, Database, AlertTriangle } from 'lucide-react';
import { translations } from './i18n';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [data, setData] = useState<ExcelDataRow[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [language, setLanguage] = useState<Language>('en-US');
  const t = translations[language];

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // Storage State
  const [showRestoreStorage, setShowRestoreStorage] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Staging Area
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [selectedContextId, setSelectedContextId] = useState(''); // GroupID or TemplateID

  const [availableGroups, setAvailableGroups] = useState<AnalysisGroup[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<AnalysisTemplate[]>([]);

  useEffect(() => {
    document.title = t.appTitle;
  }, [language, t]);

  // Initial Load and Auto-Restore Logic
  useEffect(() => {
    const initApp = async () => {
        // 1. Try to restore file system handle from IndexedDB
        const savedHandle = await fileSystemService.getStoredHandle();
        
        if (savedHandle) {
            // Check permission silently
            const hasPermission = await fileSystemService.verifyPermission(savedHandle, false);
            
            fileSystemService.setRootHandle(savedHandle);

            if (hasPermission) {
                // If permission exists, auto-load immediately
                await configService.loadAutoConfig();
            } else {
                // If permission needed, show Restore button
                setShowRestoreStorage(true);
            }
        } else {
            // No handle, just try loading from local storage logic (if any)
            // But configService uses fileSystem primarily for sync
        }
        
        refreshConfigs();
    };
    initApp();
  }, []);

  const handleRestoreStorageAccess = async () => {
      const savedHandle = await fileSystemService.getStoredHandle();
      if (!savedHandle) return;

      setIsRestoring(true);
      try {
          // Request permission with prompt
          const granted = await fileSystemService.verifyPermission(savedHandle, true);
          if (granted) {
              fileSystemService.setRootHandle(savedHandle);
              await configService.loadAutoConfig();
              refreshConfigs();
              setShowRestoreStorage(false);
              alert(t.accessRestored);
          } else {
              alert(t.permissionDenied);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsRestoring(false);
      }
  };

  const refreshConfigs = () => {
    setAvailableGroups(configService.getGroups());
    setAvailableTemplates(configService.getTemplates());
  };

  const getActiveTemplates = (): AnalysisTemplate[] | undefined => {
    if (!selectedContextId) return undefined;

    // Multi-File Mode: Context is Group ID
    if (stagedFiles.length > 1) {
       const group = availableGroups.find(g => g.id === selectedContextId);
       if (!group) return undefined;
       return availableTemplates.filter(t => group.templateIds && group.templateIds.includes(t.id));
    }
    
    // Single-File Mode: Context is Template ID
    if (stagedFiles.length === 1) {
       const template = availableTemplates.find(t => t.id === selectedContextId);
       return template ? [template] : undefined;
    }
    
    return undefined;
  };

  useEffect(() => {
    const updateAnalysisForLanguage = async () => {
      if (appState === AppState.SUCCESS && data.length > 0) {
        setIsRefreshing(true);
        try {
          const activeTemplates = getActiveTemplates();
          const newAnalysis = await analyzeDataWithGemini(data, language, undefined, undefined, undefined, activeTemplates);
          setAnalysis(newAnalysis);
          setLastUpdated(Date.now());
        } catch (error) {
          console.error("Language update failed:", error);
        } finally {
          setIsRefreshing(false);
        }
      }
    };
    updateAnalysisForLanguage();
  }, [language]); 

  const handleFilesDropped = (files: File[]) => {
      setStagedFiles(files);
      
      // Smart Default Selection
      if (files.length === 1 && availableTemplates.length > 0) {
          setSelectedContextId(availableTemplates[0].id);
      } else if (files.length > 1 && availableGroups.length > 0) {
          setSelectedContextId(availableGroups[0].id);
      } else {
          setSelectedContextId('');
      }
      
      setErrorMessage('');
  };

  const handleClearStaged = () => {
      setStagedFiles([]);
      setSelectedContextId('');
      setErrorMessage('');
  };

  const handleStartAnalysis = async () => {
    try {
      setAppState(AppState.PARSING);
      const files = stagedFiles;
      
      if (files.length === 1) {
        setFileName(files[0].name);
      } else {
        setFileName(`${files[0].name} + ${files.length - 1} others`);
      }
      
      for (const file of files) {
          await fileSystemService.saveExcelFile(file);
      }

      const parsedData = await parseMultipleExcelFiles(files);
      // Clean Data immediately
      const cleanedData = cleanAndEnrichData(parsedData);
      
      setData(cleanedData);
      
      setAppState(AppState.ANALYZING);

      const activeTemplates = getActiveTemplates();

      const aiResult = await analyzeDataWithGemini(cleanedData, language, undefined, undefined, undefined, activeTemplates);
      
      setAnalysis(aiResult);
      setLastUpdated(Date.now());
      setAppState(AppState.SUCCESS);

    } catch (error: any) {
      console.error(error);
      setAppState(AppState.ERROR);
      setErrorMessage(error.message || t.unknownError);
    }
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setData([]);
    setAnalysis(null);
    setFileName('');
    setErrorMessage('');
    setIsRefreshing(false);
    setStagedFiles([]);
    setSelectedContextId('');
  };

  const handleAnalysisUpdate = (newAnalysis: AnalysisResult) => {
    setAnalysis(newAnalysis);
    setLastUpdated(Date.now());
  };

  const handleRefresh = async () => {
    if (isRefreshing || !data.length) return;
    setIsRefreshing(true);
    try {
      const activeTemplates = getActiveTemplates();
      const newAnalysis = await analyzeDataWithGemini(data, language, undefined, undefined, undefined, activeTemplates);
      setAnalysis(newAnalysis);
      setLastUpdated(Date.now());
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
               <Bot className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 hidden sm:block">
              {t.appTitle}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {showRestoreStorage && (
                <button 
                    onClick={handleRestoreStorageAccess}
                    disabled={isRestoring}
                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-sm hover:bg-amber-100 transition-colors animate-pulse"
                    title="Click to restore access to your Config Folder"
                >
                    <Database className="w-4 h-4" />
                    {isRestoring ? 'Restoring...' : t.restoreAccess}
                    <AlertTriangle className="w-4 h-4" />
                </button>
            )}

            <button 
              onClick={() => setIsConfigOpen(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2"
              title={t.configManagerTitle}
            >
              <Settings className="w-5 h-5" />
            </button>

            <div className="relative group">
              <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 py-2">
                <Globe className="w-4 h-4" />
                <span className="pt-2">
                  {language === 'zh-TW' && '繁體中文'}
                  {language === 'en-US' && 'English'}
                  {language === 'vi-VN' && 'Tiếng Việt'}
                </span>
              </button>
              <div className="absolute right-0 top-full pt-2 w-32 hidden group-hover:block z-50">
                <div className="bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden">
                  <button onClick={() => setLanguage('zh-TW')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700">繁體中文</button>
                  <button onClick={() => setLanguage('en-US')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700">English</button>
                  <button onClick={() => setLanguage('vi-VN')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700">Tiếng Việt</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 w-full flex-grow ${appState === AppState.SUCCESS ? 'pt-0' : 'pt-8'}`}>
        
        {appState === AppState.ERROR && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 mt-6">
            <AlertCircle className="w-5 h-5" />
            <p>{errorMessage}</p>
            <button onClick={handleReset} className="ml-auto text-sm underline hover:text-red-800">{t.retry}</button>
          </div>
        )}

        {(appState === AppState.IDLE || appState === AppState.PARSING || appState === AppState.ANALYZING) && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="text-center mb-8 max-w-2xl">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                {t.heroTitle}
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t.heroDesc}
              </p>
            </div>
            
            {stagedFiles.length === 0 ? (
                // 1. UPLOAD VIEW
                <FileUpload 
                     onFileUpload={handleFilesDropped} 
                     isLoading={false} 
                     language={language}
                />
            ) : (
                // 2. CONTEXT SELECTION VIEW (Staged)
                <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-200 p-8 animate-slide-up">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                           <div className="bg-green-100 p-2 rounded-full">
                               <FileSpreadsheet className="w-6 h-6 text-green-600" />
                           </div>
                           <div>
                               <h3 className="text-lg font-bold text-gray-800">{t.filesSelected}</h3>
                               <p className="text-sm text-gray-500">{stagedFiles.length} file(s) ready</p>
                           </div>
                        </div>
                        <button onClick={handleClearStaged} className="text-gray-400 hover:text-red-500 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* File List Summary */}
                        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 max-h-32 overflow-y-auto">
                            {stagedFiles.map((f, i) => (
                                <div key={i} className="flex items-center gap-2 py-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                    {f.name}
                                </div>
                            ))}
                        </div>

                        {/* Context Selector */}
                        <div>
                           <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                              {stagedFiles.length > 1 ? <Layers className="w-4 h-4 text-purple-600" /> : <MessageSquare className="w-4 h-4 text-blue-600" />}
                              {stagedFiles.length > 1 ? t.multiFileContext : t.singleFileContext}
                           </label>
                           
                           {stagedFiles.length > 1 ? (
                               // Group Selector (Multi File)
                               <select 
                                  value={selectedContextId}
                                  onChange={(e) => setSelectedContextId(e.target.value)}
                                  className="w-full p-3 border border-gray-300 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                               >
                                  <option value="">{t.defaultAnalysis}</option>
                                  {availableGroups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                  ))}
                               </select>
                           ) : (
                               // Template Selector (Single File)
                               <select 
                                  value={selectedContextId}
                                  onChange={(e) => setSelectedContextId(e.target.value)}
                                  className="w-full p-3 border border-gray-300 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                               >
                                  <option value="">{t.defaultAnalysis}</option>
                                  {availableTemplates.map(tmpl => (
                                    <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                                  ))}
                               </select>
                           )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={handleClearStaged}
                                className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                            >
                                {t.reselect}
                            </button>
                            <button 
                                onClick={handleStartAnalysis}
                                className={`flex-[2] px-4 py-3 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all ${
                                    stagedFiles.length > 1 ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                }`}
                            >
                                <Play className="w-5 h-5 fill-current" />
                                {t.startAnalysis}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {(appState === AppState.PARSING || appState === AppState.ANALYZING) && (
              <div className="mt-8 w-full max-w-md space-y-3">
                 <div className="flex items-center gap-3">
                   <div className={`w-3 h-3 rounded-full ${appState === AppState.PARSING ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
                   <span className={appState === AppState.PARSING ? 'font-bold text-blue-700' : 'text-gray-500'}>
                     {t.stepParsing}
                   </span>
                 </div>
                 <div className="flex items-center gap-3">
                   <div className={`w-3 h-3 rounded-full ${appState === AppState.ANALYZING ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`} />
                   <span className={appState === AppState.ANALYZING ? 'font-bold text-blue-700' : 'text-gray-500'}>
                     {t.stepAnalyzing}
                   </span>
                 </div>
              </div>
            )}
          </div>
        )}

        {appState === AppState.SUCCESS && analysis && (
          <>
            <Dashboard 
              analysis={analysis} 
              data={data} 
              fileName={fileName}
              onReset={handleReset}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              lastUpdated={lastUpdated}
              language={language}
            />
            <ChatBot 
              data={data} 
              onAnalysisUpdate={handleAnalysisUpdate} 
              language={language}
            />
          </>
        )}
      </main>

      <ConfigManager 
         isOpen={isConfigOpen} 
         onClose={() => setIsConfigOpen(false)} 
         language={language} 
         onUpdate={refreshConfigs}
      />

      <footer className="py-6 text-center text-sm text-gray-500 border-t border-gray-100 bg-white">
        {t.poweredBy}
      </footer>
    </div>
  );
};

export default App;
