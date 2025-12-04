
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LabelList
} from 'recharts';
import { 
  Palette, 
  BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Activity, Radar as RadarIcon, MousePointer2,
  Minus, Plus, ImageDown, Loader2, MoveVertical, GripHorizontal
} from 'lucide-react';
import { ChartConfig, ExcelDataRow, Language } from '../types';
import { aggregateData, PALETTES, formatNumber, formatCompactNumber, exportToImage } from '../utils';
import { translations } from '../i18n';

interface ChartRendererProps {
  config: ChartConfig;
  data: ExcelDataRow[];
  index: number;
  onDataClick?: (column: string, value: string) => void;
  language: Language;
  drillDown?: { column: string; value: string } | null;
  onClearDrillDown?: () => void;
}

const ChartRenderer: React.FC<ChartRendererProps> = ({ config, data, index, onDataClick, language, drillDown, onClearDrillDown }) => {
  const [currentPalette, setCurrentPalette] = useState<keyof typeof PALETTES>('default');
  const [currentType, setCurrentType] = useState<ChartConfig['type']>(config.type);
  const [showLabels, setShowLabels] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // Menu States
  const [activeMenu, setActiveMenu] = useState<'none' | 'type' | 'palette' | 'layout'>('none');
  
  // Font size state
  const [xAxisFontSize, setXAxisFontSize] = useState(11);
  
  // Chart Height State
  const [chartHeight, setChartHeight] = useState(300); // Default set to 300px per request
  
  // Resizing State
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const t = translations[language];

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu('none');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Drag Resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeStartRef.current) return;
      
      const deltaY = e.clientY - resizeStartRef.current.startY;
      const newHeight = Math.max(250, Math.min(1000, resizeStartRef.current.startHeight + deltaY));
      
      setChartHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; 
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = { startY: e.clientY, startHeight: chartHeight };
    document.body.style.cursor = 'ns-resize';
  };

  const chartData = useMemo(() => {
    const aggregated = aggregateData(data, config.xAxisKey, config.dataKey);
    const isDateKey = aggregated.every(item => {
      const key = String(item[config.xAxisKey]);
      return /^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(key) || /^(19|20)\d{2}(0[1-9]|1[0-2])$/.test(key);
    });

    if (isDateKey) {
       return aggregated.sort((a, b) => {
         const keyA = String(a[config.xAxisKey]);
         const keyB = String(b[config.xAxisKey]);
         return keyA.localeCompare(keyB);
       });
    }

    return aggregated;
  }, [data, config.xAxisKey, config.dataKey]);

  const colors = useMemo(() => PALETTES[currentPalette], [currentPalette]);

  const handleChartClick = (data: any) => {
    if (onDataClick && data) {
      const activeLabel = data.activeLabel || data.name || data.payload?.[config.xAxisKey];
      if (activeLabel) {
        onDataClick(config.xAxisKey, String(activeLabel));
      } else if (data.payload && data.payload[config.xAxisKey]) {
         onDataClick(config.xAxisKey, String(data.payload[config.xAxisKey]));
      }
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportToImage(`chart-container-${index}`, `${config.title}.png`);
    } finally {
      setIsExporting(false);
    }
  };

  const renderCustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null;
    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight="bold" style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm p-3 border border-gray-100 shadow-xl rounded-xl text-sm min-w-[150px]">
          <p className="font-bold text-gray-800 mb-2 border-b border-gray-100 pb-1">{label}</p>
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-4 text-gray-600">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                 <span>{entry.name || config.dataKey}</span>
               </div>
               <span className="font-mono font-bold text-gray-900">{formatNumber(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = (isExpanded: boolean) => {
    const marginBottom = isExpanded 
        ? Math.max(120, xAxisFontSize * 10) 
        : Math.max(60, xAxisFontSize * 6); 
    
    const axisHeight = Math.max(50, marginBottom);

    const XAxisProps = {
      dataKey: config.xAxisKey,
      tick: { fontSize: xAxisFontSize, fill: '#64748b' },
      interval: (isExpanded ? 0 : 'preserveStartEnd') as 'preserveStartEnd' | 0,
      angle: -45,
      textAnchor: 'end' as const,
      height: axisHeight,
      tickMargin: 8,
      tickFormatter: (val: any) => {
        const str = String(val);
        if (/^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(str)) {
           return `${str.substring(0,4)}/${str.substring(4,6)}/${str.substring(6,8)}`;
        }
        if (/^(19|20)\d{2}(0[1-9]|1[0-2])$/.test(str)) {
           return `${str.substring(0,4)}/${str.substring(4,6)}`;
        }
        if (!isNaN(Number(val)) && str !== '') {
            const num = Number(val);
            const isYear = Number.isInteger(num) && num >= 1900 && num <= 2100;
            if (!isYear && Math.abs(num) >= 1000) return formatCompactNumber(num);
        }
        const maxLen = isExpanded ? 30 : 12;
        return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
      }
    };

    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 10, bottom: marginBottom },
      onClick: isExpanded ? undefined : handleChartClick,
    };

    const YAxisProps = {
       tickFormatter: formatCompactNumber,
       tick: { fontSize: 11, fill: '#64748b' },
       width: 45,
       axisLine: false,
       tickLine: false,
    };

    const GridProps = {
      strokeDasharray: "3 3", 
      vertical: false, 
      stroke: "#cbd5e1", // Darker to be visible
      opacity: 0.6
    };

    const LabelProps = {
      position: "top" as const, 
      offset: 10, 
      formatter: formatCompactNumber, 
      style: { fontSize: 10, fill: '#64748b' }
    };

    // Gradient Definitions for visual pop (Used for Area Chart)
    const Gradients = (
      <defs>
        {chartData.map((_, i) => (
          <linearGradient key={i} id={`gradient-${index}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity={0.9}/>
            <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0.4}/>
          </linearGradient>
        ))}
        <linearGradient id={`gradient-area-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors[0]} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={colors[0]} stopOpacity={0}/>
        </linearGradient>
      </defs>
    );

    switch (currentType) {
      case 'bar':
        return (
          <BarChart key={isExpanded ? 'exp-bar' : 'bar'} {...commonProps}>
            {/* Gradients defs included if needed for other things, but Bar uses solid fill now */}
            {Gradients}
            {showGrid && <CartesianGrid {...GridProps} />}
            <XAxis {...XAxisProps} />
            <YAxis {...YAxisProps} />
            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc', opacity: 0.5}} />
            <Bar dataKey={config.dataKey} name={config.dataKey} radius={[6, 6, 0, 0]} maxBarSize={60}>
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={colors[index % colors.length]} 
                  cursor={onDataClick ? 'pointer' : 'default'} 
                />
              ))}
              {showLabels && <LabelList dataKey={config.dataKey} {...LabelProps} />}
            </Bar>
          </BarChart>
        );
      case 'line':
        return (
          <LineChart key={isExpanded ? 'exp-line' : 'line'} {...commonProps}>
            {showGrid && <CartesianGrid {...GridProps} />}
            <XAxis {...XAxisProps} />
            <YAxis {...YAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey={config.dataKey} 
              stroke={colors[0]} 
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: colors[0] }}
              activeDot={{ r: 6, stroke: colors[0], strokeWidth: 2, fill: '#fff' }}
            >
               {showLabels && <LabelList dataKey={config.dataKey} {...LabelProps} />}
            </Line>
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart key={isExpanded ? 'exp-area' : 'area'} {...commonProps}>
            {Gradients}
            {showGrid && <CartesianGrid {...GridProps} />}
            <XAxis {...XAxisProps} />
            <YAxis {...YAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey={config.dataKey} 
              stroke={colors[0]} 
              strokeWidth={2}
              fillOpacity={1} 
              fill={`url(#gradient-area-${config.id})`} 
            >
               {showLabels && <LabelList dataKey={config.dataKey} {...LabelProps} />}
            </Area>
          </AreaChart>
        );
      case 'pie':
        return (
          <PieChart key={isExpanded ? 'exp-pie' : 'pie'} margin={{ top: 0, bottom: 20, left: 0, right: 0 }}>
             <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={showLabels ? renderCustomPieLabel : undefined}
              outerRadius={isExpanded ? "75%" : "70%"}
              innerRadius={isExpanded ? "40%" : "35%"} // Donut chart style
              paddingAngle={2}
              dataKey={config.dataKey}
              nameKey={config.xAxisKey}
              onClick={onDataClick ? handleChartClick : undefined} 
              cursor={onDataClick ? 'pointer' : 'default'}
              stroke="#fff"
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
               layout="horizontal" 
               verticalAlign="bottom" 
               align="center"
               wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
            />
          </PieChart>
        );
      case 'scatter':
        return (
          <ScatterChart key={isExpanded ? 'exp-scatter' : 'scatter'} {...commonProps}>
            {showGrid && <CartesianGrid {...GridProps} />}
            <XAxis dataKey={config.xAxisKey} name={config.xAxisKey} {...XAxisProps} />
            <YAxis dataKey={config.dataKey} name={config.dataKey} {...YAxisProps} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
            <Scatter name={config.title} data={chartData} fill={colors[0]} onClick={onDataClick ? (data) => handleChartClick(data) : undefined} cursor={onDataClick ? 'pointer' : 'default'}>
              {chartData.map((entry, index) => (
                 <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
              {showLabels && <LabelList dataKey={config.dataKey} position="top" style={{ fontSize: 10, fill: '#666' }} formatter={formatCompactNumber} />}
            </Scatter>
          </ScatterChart>
        );
      case 'radar':
        return (
          <RadarChart key={isExpanded ? 'exp-radar' : 'radar'} cx="50%" cy="50%" outerRadius={isExpanded ? "70%" : "60%"} data={chartData} margin={{ top: 10, bottom: 30, left: 10, right: 10 }}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey={config.xAxisKey} tick={{ fontSize: 10, fill: '#64748b' }} />
            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tickFormatter={formatCompactNumber} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} />
            <Radar
              name={config.dataKey}
              dataKey={config.dataKey}
              stroke={colors[0]}
              fill={colors[0]}
              fillOpacity={0.4}
              onClick={onDataClick ? handleChartClick : undefined}
              style={{ cursor: onDataClick ? 'pointer' : 'default' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }} />
          </RadarChart>
        );
      default:
        return null;
    }
  };

  const ChartIcon = {
    bar: BarChart3,
    line: LineChartIcon,
    pie: PieChartIcon,
    area: Activity,
    scatter: MousePointer2,
    radar: RadarIcon
  }[currentType] || BarChart3;

  return (
    <>
      <div 
        id={`chart-container-${index}`}
        className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 relative group flex flex-col"
        role="img"
        aria-label={`${config.title}. ${config.description}`}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 pr-4">
            <h3 className="font-bold text-gray-800 text-lg leading-tight mb-1">{config.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{config.description}</p>
          </div>
          
          {/* Controls Toolbar */}
          <div 
            className="flex items-center gap-1 bg-white shadow-sm border border-gray-100 rounded-lg p-1 z-20"
            data-html2canvas-ignore
            ref={menuRef}
          >
             {/* 1. Chart Type */}
             <div className="relative">
               <button 
                  onClick={() => setActiveMenu(activeMenu === 'type' ? 'none' : 'type')}
                  className={`p-1.5 rounded-md transition-colors ${activeMenu === 'type' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-blue-600 hover:bg-gray-50'}`}
                  title={t.chartType}
               >
                 <ChartIcon className="w-4 h-4" />
               </button>
               {activeMenu === 'type' && (
                 <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-30 animate-fade-in">
                    {(Object.keys(t.chartTypes) as Array<keyof typeof t.chartTypes>).map((type) => {
                       const Icon = { bar: BarChart3, line: LineChartIcon, pie: PieChartIcon, area: Activity, scatter: MousePointer2, radar: RadarIcon }[type];
                       return (
                        <button
                          key={type}
                          onClick={() => { setCurrentType(type); setActiveMenu('none'); }}
                          className={`flex items-center gap-2 w-full p-2 text-xs rounded-lg ${currentType === type ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {t.chartTypes[type]}
                        </button>
                       );
                    })}
                 </div>
               )}
             </div>

             {/* 2. Palette */}
             <div className="relative">
               <button 
                  onClick={() => setActiveMenu(activeMenu === 'palette' ? 'none' : 'palette')}
                  className={`p-1.5 rounded-md transition-colors ${activeMenu === 'palette' ? 'bg-pink-50 text-pink-600' : 'text-gray-400 hover:text-pink-600 hover:bg-gray-50'}`}
                  title={t.customizeColor}
               >
                 <Palette className="w-4 h-4" />
               </button>
               {activeMenu === 'palette' && (
                 <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-30 animate-fade-in">
                    {(Object.keys(PALETTES) as Array<keyof typeof PALETTES>).map((paletteName) => (
                      <button
                        key={paletteName}
                        onClick={() => { setCurrentPalette(paletteName); setActiveMenu('none'); }}
                        className="flex items-center gap-2 w-full p-2 text-xs text-gray-600 hover:bg-gray-50 rounded-lg"
                      >
                         <div className="flex gap-0.5">
                           {PALETTES[paletteName].slice(0, 3).map((c, i) => (
                             <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                           ))}
                         </div>
                         <span className="capitalize flex-1 text-left">{t.palettes[paletteName]}</span>
                      </button>
                    ))}
                 </div>
               )}
             </div>
             
             {/* 3. Layout / Size */}
             <div className="relative">
                <button
                   onClick={() => setActiveMenu(activeMenu === 'layout' ? 'none' : 'layout')}
                   className={`p-1.5 rounded-md transition-colors ${activeMenu === 'layout' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-50'}`}
                   title={t.adjustHeight}
                >
                   <MoveVertical className="w-4 h-4" />
                </button>
                {activeMenu === 'layout' && (
                   <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-30 animate-fade-in flex flex-col gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">{t.adjustHeight}</label>
                        <input 
                           type="range" 
                           min="200" 
                           max="800" 
                           step="50" 
                           value={chartHeight} 
                           onChange={(e) => setChartHeight(Number(e.target.value))}
                           className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                           <span>Small</span>
                           <span>Large</span>
                        </div>
                      </div>
                      
                      <div>
                         <label className="text-xs font-bold text-gray-500 mb-1 block">{t.adjustFontSize}</label>
                         <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg">
                            <button onClick={() => setXAxisFontSize(Math.max(8, xAxisFontSize - 1))} className="p-1 hover:bg-white rounded shadow-sm"><Minus className="w-3 h-3" /></button>
                            <span className="flex-1 text-center text-xs font-mono">{xAxisFontSize}px</span>
                            <button onClick={() => setXAxisFontSize(Math.min(16, xAxisFontSize + 1))} className="p-1 hover:bg-white rounded shadow-sm"><Plus className="w-3 h-3" /></button>
                         </div>
                      </div>

                      <div className="flex items-center gap-2">
                         <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} id={`labels-${index}`} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                         <label htmlFor={`labels-${index}`} className="text-xs text-gray-600 cursor-pointer select-none">{t.showLabels}</label>
                      </div>

                      <div className="flex items-center gap-2">
                         <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} id={`grid-${index}`} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                         <label htmlFor={`grid-${index}`} className="text-xs text-gray-600 cursor-pointer select-none">Show Grid</label>
                      </div>
                   </div>
                )}
             </div>

             {/* 4. Export Image */}
             <button 
                onClick={handleExport}
                disabled={isExporting}
                className="p-1.5 rounded-md text-gray-400 hover:text-green-600 hover:bg-gray-50 transition-colors"
                title={t.exportImage}
             >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
             </button>

             {/* 5. Drag Handle (if using grid layout) */}
             <div className="drag-handle p-1.5 cursor-move text-gray-300 hover:text-gray-600">
                <GripHorizontal className="w-4 h-4" />
             </div>

          </div>
        </div>
        
        {/* Chart Content */}
        <div 
           className="flex-1 w-full relative min-w-0"
           style={{ height: chartHeight, minHeight: chartHeight }}
        >
             <ResponsiveContainer width="100%" height="100%" minWidth={0}>
               {renderChart(false)}
             </ResponsiveContainer>
        </div>
        
        {/* Drill Down Banner (Inside Card Footer) */}
        {drillDown && onClearDrillDown && (
            <div className="bg-blue-50 border-t border-blue-100 px-3 py-2 flex justify-between items-center text-xs mt-auto">
                <span className="text-blue-700 truncate max-w-[70%] flex items-center gap-1">
                    <span className="bg-blue-200 text-blue-800 px-1 rounded font-mono font-bold text-[10px]">FILTER</span>
                    <span className="font-semibold">{drillDown.column}</span>
                    <span className="text-gray-400">=</span>
                    <span className="font-bold">{drillDown.value}</span>
                </span>
                <button
                    onClick={(e) => { e.stopPropagation(); onClearDrillDown(); }}
                    className="text-blue-600 hover:text-blue-800 font-bold hover:underline px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                >
                    {t.clearDrillDown || "Clear"}
                </button>
            </div>
        )}

        {/* Resize Handle (Bottom) */}
        <div 
           className="h-4 w-full cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-0 left-0 hover:bg-gray-50"
           onMouseDown={handleResizeStart}
        >
           <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

      </div>
    </>
  );
};

export default ChartRenderer;
