
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AnalysisResult, ExcelDataRow, Language } from '../types';
import ChartRenderer from './ChartRenderer';
import DataTable from './DataTable';
import { Sparkles, FileText, Download, Filter, Plus, X, Trash2, ChevronDown, FilterX, RefreshCw, Clock, AlertCircle, Calendar, Lightbulb, Loader2 } from 'lucide-react';
import { exportToCSV, exportToJSON, exportToExcel, exportToPDF, exportToPPTX, detectColumnType, parseDateSafe } from '../utils';
import { translations } from '../i18n';
import { Responsive, WidthProvider } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardProps {
  analysis: AnalysisResult;
  data: ExcelDataRow[];
  fileName: string;
  onReset: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: number;
  language: Language;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  analysis, 
  data, 
  fileName, 
  onReset,
  onRefresh,
  isRefreshing,
  lastUpdated,
  language
}) => {
  const t = translations[language];
  
  // Refresh settings
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);

  // Export settings
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Drill Down State
  const [drillDown, setDrillDown] = useState<{ column: string; value: string } | null>(null);

  // Grid Layout State
  const [layouts, setLayouts] = useState<any>({ lg: [] });

  // Init Layout
  useEffect(() => {
    const initialLayout = analysis.charts.map((chart, i) => ({
      i: chart.id,
      x: (i % 2) * 6,
      y: Math.floor(i / 2) * 10,
      w: 6,
      h: 12,
      minW: 3,
      minH: 8
    }));
    setLayouts({ lg: initialLayout, md: initialLayout, sm: initialLayout });
  }, [analysis]);

  // Auto-refresh logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isAutoRefresh) {
      interval = setInterval(() => {
        onRefresh();
      }, 5 * 60 * 1000); // 5 minutes
    }
    return () => clearInterval(interval);
  }, [isAutoRefresh, onRefresh]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Drill Down Filtering Logic (Global for Charts)
  const filteredData = useMemo(() => {
    let res = data;
    // Apply Drill Down
    if (drillDown) {
      res = res.filter(row => String(row[drillDown.column]) === drillDown.value);
    }
    return res;
  }, [data, drillDown]);

  const handleChartClick = (column: string, value: string) => {
    setDrillDown({ column, value });
  };

  const handleExport = async (format: 'csv' | 'json' | 'excel' | 'pdf' | 'pptx') => {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    setTimeout(async () => {
      try {
        if (format === 'csv') exportToCSV(filteredData, `${fileName || 'export'}.csv`);
        if (format === 'json') exportToJSON(filteredData, `${fileName || 'export'}.json`);
        if (format === 'excel') exportToExcel(filteredData, `${fileName || 'export'}.xlsx`, analysis, language);
        if (format === 'pdf') await exportToPDF('dashboard-content', `${fileName || 'report'}.pdf`);
        if (format === 'pptx') await exportToPPTX(analysis, `${fileName || 'presentation'}.pptx`, language);
      } catch (e) {
        console.error(e);
        alert(t.unknownError);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  return (
    <div className="flex flex-col gap-3 w-full animate-fade-in" id="dashboard-content">
      
      {/* 1. Toolbar / Report Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm w-full">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
             <div>
                <div className="flex items-center gap-2">
                   <FileText className="w-5 h-5 text-blue-600" />
                   <h2 className="text-lg font-bold text-gray-800">{t.reportTitle}</h2>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                   <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium truncate max-w-[200px]" title={fileName}>{fileName}</span>
                   <span>•</span>
                   <span>{t.displayCount} <strong className="text-gray-800">{filteredData.length.toLocaleString()}</strong> {t.dataCount}</span>
                </div>
             </div>

             <div className="flex items-center gap-2 ml-auto">
                <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-200 mr-2">
                   <button onClick={onRefresh} disabled={isRefreshing} className={`p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-white transition-all ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} title={t.manualRefresh}>
                     <RefreshCw className="w-4 h-4" />
                   </button>
                   <div className="w-px h-4 bg-gray-300 mx-1"></div>
                   <button onClick={() => setIsAutoRefresh(!isAutoRefresh)} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${isAutoRefresh ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:text-gray-700 hover:bg-white'}`} title={t.autoRefresh}>
                     <Clock className="w-3 h-3" /> {isAutoRefresh ? 'ON' : 'OFF'}
                   </button>
                </div>

                <div className="relative" ref={exportMenuRef}>
                   <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} disabled={isExporting} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-70">
                     {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {isExporting ? t.exporting : t.export} <ChevronDown className="w-3 h-3" />
                   </button>
                   {isExportMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 p-1 z-50 animate-fade-in">
                         {['csv', 'json', 'excel', 'pdf', 'pptx'].map(fmt => (
                            <button key={fmt} onClick={() => handleExport(fmt as any)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">{(t as any)[`export${fmt.toUpperCase()}`]}</button>
                         ))}
                      </div>
                   )}
                </div>

                <button onClick={onReset} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
                  <Plus className="w-4 h-4" /> {t.uploadNew}
                </button>
             </div>
         </div>
      </div>

      {/* 2. AI Summary Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 md:w-1/3 text-white flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="relative z-10">
                 <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-yellow-300" />
                    <h3 className="text-lg font-bold tracking-wide uppercase opacity-90">{t.aiSummary}</h3>
                 </div>
                 <div className="w-12 h-1 bg-white/30 rounded-full mb-4"></div>
                 <p className="text-blue-100 text-sm italic">{t.insightNote}</p>
              </div>
          </div>
          <div className="p-6 md:w-2/3 bg-white text-gray-700 text-base leading-relaxed space-y-4">
              {isRefreshing ? (
                <div className="flex items-center gap-2 text-gray-400 italic"><Loader2 className="w-4 h-4 animate-spin" />{t.updating}</div>
              ) : (
                analysis.summary.split('\n').map((para, i) => <p key={i} className="text-justify">{para}</p>)
              )}
          </div>
      </div>

      {/* 3. Drill Down Banner */}
      {drillDown && (
         <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between animate-fade-in shadow-sm">
            <div className="flex items-center gap-3">
               <div className="bg-blue-100 p-1.5 rounded-full"><FilterX className="w-4 h-4 text-blue-600" /></div>
               <div>
                  <h4 className="font-bold text-blue-800 text-sm flex items-center gap-2">{t.drillDownActive}: <span className="bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-600 font-mono">{drillDown.column} = {drillDown.value}</span></h4>
                  <p className="text-xs text-blue-600 mt-0.5">{t.drillDownDesc}</p>
               </div>
            </div>
            <button onClick={() => setDrillDown(null)} className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline px-3 py-1">{t.clearDrillDown}</button>
         </div>
      )}

      {/* 4. Key Insights */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
         <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-bold text-gray-800">{t.sheetInsights}</h3>
         </div>
         <div className="space-y-4">
           {analysis.keyInsights.map((insight, idx) => {
              const parts = insight.split(/[:：]/);
              const title = parts.length > 1 ? parts[0] : null;
              const content = parts.length > 1 ? parts.slice(1).join(':') : insight;
              return (
                <div key={idx} className="flex gap-4 p-4 rounded-xl border border-gray-50 hover:border-blue-100 hover:shadow-sm transition-all group bg-white">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">{idx + 1}</div>
                  <div className="text-gray-700 leading-relaxed">{title && <strong className="block text-gray-900 mb-1 text-lg">{title}</strong>}{content}</div>
                </div>
              );
           })}
         </div>
      </div>

      {/* 5. Charts Grid (Draggable) */}
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768 }}
        cols={{ lg: 12, md: 12, sm: 12 }}
        rowHeight={30}
        draggableHandle=".drag-handle"
        onLayoutChange={(currentLayout, allLayouts) => setLayouts(allLayouts)}
      >
        {analysis.charts.map((chart, index) => {
          const hasData = filteredData.length > 0;
          return (
             <div key={chart.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                {hasData ? (
                   <ChartRenderer 
                     config={chart} 
                     data={filteredData} 
                     index={index} 
                     onDataClick={handleChartClick}
                     language={language}
                     drillDown={drillDown}
                     onClearDrillDown={() => setDrillDown(null)}
                   />
                ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                      <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                      <p>{t.chartNoData}</p>
                   </div>
                )}
             </div>
          );
        })}
      </ResponsiveGridLayout>

      {/* 6. Data Preview Table (Now handles its own filtering UI) */}
      <DataTable data={filteredData} language={language} itemsPerPage={10} />

    </div>
  );
};

export default Dashboard;
