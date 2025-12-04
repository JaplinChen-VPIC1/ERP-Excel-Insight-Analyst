
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Settings, MessageSquare, Briefcase, Download, Upload, X, CheckSquare, Square } from 'lucide-react';
import { translations } from '../i18n';
import { Language, AnalysisTemplate, AnalysisGroup } from '../types';
import { configService } from '../services/sqlService'; 

interface ConfigManagerProps {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

type Tab = 'groups' | 'templates';

const SqlConfigManager: React.FC<ConfigManagerProps> = ({ language, isOpen, onClose, onUpdate }) => {
  const t = translations[language];
  
  const [activeTab, setActiveTab] = useState<Tab>('groups');
  const [groups, setGroups] = useState<AnalysisGroup[]>([]);
  const [templates, setTemplates] = useState<AnalysisTemplate[]>([]);

  const [editGroup, setEditGroup] = useState<Partial<AnalysisGroup> | null>(null);
  const [editTemplate, setEditTemplate] = useState<Partial<AnalysisTemplate> | null>(null);

  const configImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  const refreshData = () => {
    setGroups(configService.getGroups());
    setTemplates(configService.getTemplates());
  };

  const handleExportConfig = () => {
    const data = configService.exportConfigData();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = configService.CONFIG_FILENAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name !== configService.CONFIG_FILENAME) {
       if(!confirm(`You are importing "${file.name}". The system expects "${configService.CONFIG_FILENAME}". Continue?`)) {
           return;
       }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        configService.importConfigData(json);
        refreshData();
        onUpdate?.();
        alert(t.syncSuccess);
      } catch (err) {
        console.error(err);
        alert(t.syncError);
      }
    };
    reader.readAsText(file);
    if (configImportRef.current) configImportRef.current.value = '';
  };

  const handleSaveGroup = () => {
    if (!editGroup?.name) return;
    const newGroup: AnalysisGroup = {
      id: editGroup.id || Date.now().toString(),
      name: editGroup.name,
      description: editGroup.description || '',
      templateIds: editGroup.templateIds || [],
    };
    configService.saveGroup(newGroup);
    setEditGroup(null);
    refreshData();
    onUpdate?.();
  };

  const toggleGroupTemplate = (tmplId: string) => {
      if (!editGroup) return;
      const currentIds = editGroup.templateIds || [];
      if (currentIds.includes(tmplId)) {
          setEditGroup({ ...editGroup, templateIds: currentIds.filter(id => id !== tmplId) });
      } else {
          setEditGroup({ ...editGroup, templateIds: [...currentIds, tmplId] });
      }
  };

  const handleDeleteGroup = (id: string) => {
    configService.deleteGroup(id);
    refreshData();
    onUpdate?.();
  };

  const handleSaveTemplate = () => {
    if (!editTemplate?.name || !editTemplate?.systemInstruction) return;
    const newTemplate: AnalysisTemplate = {
      id: editTemplate.id || Date.now().toString(),
      name: editTemplate.name,
      description: editTemplate.description || '',
      systemInstruction: editTemplate.systemInstruction,
      customPrompt: editTemplate.customPrompt || ''
    };
    configService.saveTemplate(newTemplate);
    setEditTemplate(null);
    refreshData();
  };

  const handleDeleteTemplate = (id: string) => {
    configService.deleteTemplate(id);
    refreshData();
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center shrink-0">
           <div className="flex items-center gap-3">
             <Settings className="w-5 h-5" />
             <h2 className="text-xl font-bold">{t.sqlConfigTitle}</h2>
           </div>
           
           <div className="flex gap-2 items-center">
                 <button onClick={handleExportConfig} className="flex items-center gap-1 px-3 py-1.5 hover:bg-gray-700 rounded text-gray-200 text-xs font-medium transition-colors">
                    <Download className="w-4 h-4" /> {t.exportConfig}
                 </button>
                 <button onClick={() => configImportRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 hover:bg-gray-700 rounded text-gray-200 text-xs font-medium transition-colors">
                    <Upload className="w-4 h-4" /> {t.importConfig}
                 </button>
                 <input type="file" ref={configImportRef} className="hidden" accept=".json" onChange={handleImportConfig} />
                 
                 <div className="w-px h-5 bg-gray-600 mx-2"></div>

                 <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-full transition-colors">
                    <X className="w-6 h-6" />
                 </button>
           </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-60 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-2 overflow-y-auto shrink-0">
            <button 
              onClick={() => setActiveTab('groups')} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'groups' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-white hover:shadow-sm'}`}
            >
              <Briefcase className="w-4 h-4" /> {t.tabGroups}
            </button>
            <button 
              onClick={() => setActiveTab('templates')} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'templates' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-white hover:shadow-sm'}`}
            >
              <MessageSquare className="w-4 h-4" /> {t.tabTemplates}
            </button>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-8 overflow-y-auto bg-white">
            
            {/* GROUPS TAB */}
            {activeTab === 'groups' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-2xl font-bold text-gray-800">{t.tabGroups}</h3>
                   <button onClick={() => setEditGroup({ })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"><Plus className="w-4 h-4" /> {t.add}</button>
                </div>
                
                {editGroup ? (
                  <div className="bg-gray-50 p-6 rounded-xl border border-blue-100 shadow-inner space-y-4">
                    <h4 className="font-bold text-lg text-blue-700">{editGroup.id ? t.edit : t.create}</h4>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">{t.lblRoleName}</label>
                        <input className="w-full p-2.5 border rounded-lg bg-white" placeholder={t.lblRoleName} value={editGroup.name || ''} onChange={e => setEditGroup({...editGroup, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">{t.lblDesc}</label>
                        <input className="w-full p-2.5 border rounded-lg bg-white" placeholder={t.lblDesc} value={editGroup.description || ''} onChange={e => setEditGroup({...editGroup, description: e.target.value})} />
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-2 block">{t.lblLinkTemplates}</label>
                        <div className="bg-white border rounded-lg p-2 max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {templates.map(tmp => {
                                const isSelected = (editGroup.templateIds || []).includes(tmp.id);
                                return (
                                    <div 
                                        key={tmp.id} 
                                        onClick={() => toggleGroupTemplate(tmp.id)}
                                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}
                                    >
                                        {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                                        <span className={`text-sm ${isSelected ? 'text-blue-800 font-medium' : 'text-gray-600'}`}>{tmp.name}</span>
                                    </div>
                                );
                            })}
                            {templates.length === 0 && <span className="text-gray-400 text-xs italic p-2">{t.noItems}</span>}
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-4">
                      <button onClick={() => setEditGroup(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">{t.cancel}</button>
                      <button onClick={handleSaveGroup} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{t.save}</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groups.map(group => (
                      <div key={group.id} className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition-shadow bg-white flex flex-col">
                        <h4 className="font-bold text-lg text-gray-800">{group.name}</h4>
                        <p className="text-sm text-gray-500 mb-3 flex-1">{group.description}</p>
                        <div className="text-xs bg-blue-50 text-blue-800 px-2 py-1.5 rounded mb-3 flex flex-wrap gap-2 border border-blue-100">
                          <MessageSquare className="w-3 h-3"/> 
                          {group.templateIds && group.templateIds.length > 0 ? (
                              group.templateIds.map(tid => {
                                  const tName = templates.find(t => t.id === tid)?.name;
                                  return tName ? <span key={tid} className="bg-white px-1 rounded border border-blue-100">{tName}</span> : null;
                              })
                          ) : (
                              <span>{t.lblNoTemplate}</span>
                          )}
                        </div>
                        <div className="flex gap-3 mt-auto pt-3 border-t border-gray-100">
                          <button onClick={() => setEditGroup(group)} className="text-sm text-blue-600 hover:underline font-medium">{t.edit}</button>
                          <button onClick={() => handleDeleteGroup(group.id)} className="text-sm text-red-500 hover:underline ml-auto">{t.delete}</button>
                        </div>
                      </div>
                    ))}
                    {groups.length === 0 && <p className="text-gray-400 italic">{t.noItems}</p>}
                  </div>
                )}
              </div>
            )}

            {/* TEMPLATES TAB */}
            {activeTab === 'templates' && (
               <div>
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-2xl font-bold text-gray-800">{t.tabTemplates}</h3>
                   <button onClick={() => setEditTemplate({})} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"><Plus className="w-4 h-4" /> {t.add}</button>
                </div>
                {editTemplate ? (
                   <div className="bg-gray-50 p-6 rounded-xl border border-blue-100 space-y-4">
                      <h4 className="font-bold text-lg text-blue-700">{editTemplate.id ? t.edit : t.create}</h4>
                      <div>
                         <label className="text-xs font-bold text-gray-500 mb-1 block">{t.lblTmplName}</label>
                         <input className="w-full p-2.5 border rounded-lg bg-white" placeholder={t.lblTmplName} value={editTemplate.name || ''} onChange={e => setEditTemplate({...editTemplate, name: e.target.value})} />
                      </div>
                      <div>
                         <label className="text-xs font-bold text-gray-500 mb-1 block">{t.lblDesc}</label>
                         <input className="w-full p-2.5 border rounded-lg bg-white" placeholder={t.lblDesc} value={editTemplate.description || ''} onChange={e => setEditTemplate({...editTemplate, description: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">{t.lblSysInstr}</label>
                        <textarea className="w-full p-2.5 border rounded-lg bg-white text-sm h-24" placeholder="e.g., You are a Senior Inventory Analyst..." value={editTemplate.systemInstruction || ''} onChange={e => setEditTemplate({...editTemplate, systemInstruction: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">{t.lblAnalysisPrompt}</label>
                        <textarea className="w-full p-2.5 border rounded-lg bg-white text-sm h-40 font-mono" placeholder="Focus on turnover rates, aging stock..." value={editTemplate.customPrompt || ''} onChange={e => setEditTemplate({...editTemplate, customPrompt: e.target.value})} />
                      </div>
                      <div className="flex gap-2 justify-end pt-4">
                        <button onClick={() => setEditTemplate(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">{t.cancel}</button>
                        <button onClick={handleSaveTemplate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{t.save}</button>
                      </div>
                   </div>
                ) : (
                  <div className="space-y-4">
                    {templates.map(tmp => (
                       <div key={tmp.id} className="p-5 border border-gray-200 rounded-xl bg-white hover:shadow-sm transition-shadow">
                          <div className="flex justify-between mb-2">
                             <div>
                                <div className="font-bold text-gray-800 text-lg">{tmp.name}</div>
                                <div className="text-sm text-gray-500">{tmp.description}</div>
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => setEditTemplate(tmp)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Settings className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteTemplate(tmp.id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                             </div>
                          </div>
                          <div className="bg-gray-50 text-gray-600 text-xs p-3 rounded-lg border border-gray-200 font-mono line-clamp-3">
                            {tmp.systemInstruction}
                          </div>
                       </div>
                    ))}
                    {templates.length === 0 && <p className="text-gray-400 italic">{t.noItems}</p>}
                  </div>
                )}
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqlConfigManager;
