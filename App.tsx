
import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BibEntry, ViewMode, Gender, Project, ResearchBlueprint } from './types.ts';
import NetworkGraph from './components/NetworkGraph.tsx';
import StatsDashboard from './components/StatsDashboard.tsx';
import WorldMap from './components/WorldMap.tsx';
import GlobalFlowBackground from './components/GlobalFlowBackground.tsx';
import TheoryLab from './components/TheoryLab.tsx';
import ArchitectStudio from './components/ArchitectStudio.tsx';
import { architectDatabaseSchema, ArchitectOutput, generateInsights, geocodeLocation, extractMetadataFromEntries } from './services/geminiService.ts';
import { SAMPLE_ENTRIES, COORDS as LOCAL_COORDS } from './constants.ts';

const STORAGE_KEY_PROJECTS = 'transdata_core_v34_gis_robust';
const STORAGE_KEY_ACTIVE_ID = 'transdata_active_id_v34_gis_robust';

const getColumnValue = (row: any, keys: string[], possibleNames: string[]) => {
  const normalizedNames = possibleNames.map(n => n.toLowerCase().trim());
  const foundKey = keys.find(k => {
    const nk = k.toLowerCase().trim();
    return normalizedNames.includes(nk) || 
           normalizedNames.some(pn => nk.startsWith(pn) || pn.startsWith(nk) || nk.includes(pn));
  });
  return foundKey ? row[foundKey] : null;
};

function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_ACTIVE_ID));
  const [showTheoryLab, setShowTheoryLab] = useState(false);
  const [showArchitectStudio, setShowArchitectStudio] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statsInsights, setStatsInsights] = useState("");
  
  const [yearFilter, setYearFilter] = useState<[number, number]>([1800, 2025]);
  const [isTimeFilterExpanded, setIsTimeFilterExpanded] = useState(true);
  
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<BibEntry>>({
    title: '', author: { name: '', gender: Gender.UNKNOWN }, 
    translator: { name: '', gender: Gender.UNKNOWN }, publicationYear: 2024,
    publisher: '', city: '', provinceState: '', sourceLanguage: 'Portuguese', targetLanguage: 'Chinese',
    customMetadata: {}
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);

  const filteredEntries = useMemo(() => {
    if (!activeProject) return [];
    return activeProject.entries.filter(e => {
        const matchesSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             e.author.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesYear = e.publicationYear >= yearFilter[0] && e.publicationYear <= yearFilter[1];
        return matchesSearch && matchesYear;
    });
  }, [activeProject, searchTerm, yearFilter]);

  const projectYearBounds = useMemo(() => {
    if (!activeProject || activeProject.entries.length === 0) return [1800, 2025];
    const years = activeProject.entries.map(e => e.publicationYear).filter(y => y > 0);
    return [Math.min(...years), Math.max(...years)];
  }, [activeProject]);

  useEffect(() => {
    if (activeProject) {
        setYearFilter([projectYearBounds[0], projectYearBounds[1]]);
    }
  }, [activeProjectId, projectYearBounds, activeProject]);

  useEffect(() => localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects)), [projects]);
  useEffect(() => {
    if (activeProjectId) localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeProjectId);
    else localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  }, [activeProjectId]);

  const enrichEntriesWithGIS = async (entries: BibEntry[]): Promise<BibEntry[]> => {
    const updated = [...entries];
    const needsGeocoding = updated.filter(e => 
      ((e.city && e.city.length > 0) || (e.provinceState && e.provinceState.length > 0)) && 
      !e.customMetadata?.targetCoord
    );
    
    if (needsGeocoding.length === 0) return updated;

    const getLocalCoord = (val?: string): [number, number] | null => {
      if (!val) return null;
      const clean = String(val).toLowerCase().trim();
      if (!clean || clean === 'unknown' || clean === 'null' || clean === '无' || clean === '未知') return null;
      if (LOCAL_COORDS[clean]) return LOCAL_COORDS[clean];
      const stem = clean.replace(/(市|省|自治区|特别行政区|街道|区|县|city|province|state|s\.a\.r\.)$/g, "").trim();
      if (LOCAL_COORDS[stem]) return LOCAL_COORDS[stem];
      return null;
    };

    const resultsMap = new Map<string, { coord: [number, number], source: 'local' | 'ai' }>();

    for (const e of needsGeocoding) {
      const city = e.city;
      const province = e.provinceState;
      const key = `${province}|${city}`;
      if (resultsMap.has(key)) continue;

      let localMatch = getLocalCoord(city);
      if (localMatch) {
        resultsMap.set(key, { coord: localMatch, source: 'local' });
        continue;
      }

      localMatch = getLocalCoord(province);
      if (localMatch) {
        resultsMap.set(key, { coord: localMatch, source: 'local' });
        continue;
      }

      if (e.customMetadata) {
          for (const val of Object.values(e.customMetadata)) {
              if (typeof val === 'string' && val.length > 1) {
                  const deepMatch = getLocalCoord(val);
                  if (deepMatch) {
                      resultsMap.set(key, { coord: deepMatch, source: 'local' });
                      break;
                  }
              }
          }
          if (resultsMap.has(key)) continue;
      }

      if (process.env.API_KEY) {
        const query = [province, city].filter(p => p && p.length > 1 && p.toLowerCase() !== 'unknown').join(" ").trim();
        if (query) {
          try {
            const aiCoord = await geocodeLocation(query);
            if (aiCoord) resultsMap.set(key, { coord: aiCoord, source: 'ai' });
          } catch (err) { console.warn(`Geocode failed for ${query}`); }
        }
      }
    }

    return updated.map(e => {
      const key = `${e.provinceState}|${e.city}`;
      if (resultsMap.has(key) && !e.customMetadata?.targetCoord) {
        const match = resultsMap.get(key)!;
        return { 
          ...e, 
          customMetadata: { 
            ...e.customMetadata, 
            targetCoord: match.coord,
            gisSource: match.source 
          } 
        };
      }
      return e;
    });
  };

  const reprocessProjectGIS = async () => {
    if (!activeProject) return;
    setIsGeocoding(true);
    const enrichedEntries = await enrichEntriesWithGIS(activeProject.entries);
    setProjects(prev => prev.map(p => p.id === activeProject.id ? {
      ...p, entries: enrichedEntries, lastModified: Date.now()
    } : p));
    setIsGeocoding(false);
  };

  const addManualEntry = async () => {
    if (!activeProject || !newEntry.title) return;
    setIsGeocoding(true);
    const entry: BibEntry = { ...newEntry as BibEntry, id: `manual-${Date.now()}` };
    const enriched = await enrichEntriesWithGIS([entry]);
    setProjects(prev => prev.map(p => p.id === activeProject.id ? {
      ...p, entries: [...p.entries, ...enriched], lastModified: Date.now()
    } : p));
    setNewEntry({
      title: '', author: { name: '', gender: Gender.UNKNOWN }, 
      translator: { name: '', gender: Gender.UNKNOWN }, publicationYear: 2024,
      publisher: '', city: '', provinceState: '', sourceLanguage: 'Portuguese', targetLanguage: 'Chinese',
      customMetadata: {}
    });
    setShowEntryForm(false);
    setIsGeocoding(false);
  };

  const loadSampleProject = () => {
    const sampleProj: Project = {
      id: `sample-${Date.now()}`,
      name: "Sample: Portuguese-Chinese Corpus / 示例项目：葡中翻译语料库",
      lastModified: Date.now(),
      entries: SAMPLE_ENTRIES,
      blueprint: null,
      customColumns: ["Source Genre", "Digital Circulation"]
    };
    setProjects(prev => [sampleProj, ...prev]);
    setActiveProjectId(sampleProj.id);
    setViewMode('network');
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this lab project? / 确定要删除该研究项目吗？此操作无法撤销。")) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) setActiveProjectId(null);
    }
  };

  const handleApplyBlueprint = (bp: ResearchBlueprint) => {
    const newProj: Project = { 
        id: `proj-${Date.now()}`, 
        name: bp.projectScope.slice(0, 30) + "...", 
        lastModified: Date.now(), 
        entries: [], 
        blueprint: bp,
        customColumns: bp.suggestedSchema.map(s => s.fieldName)
    };
    setProjects(prev => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setViewMode('list');
    setShowTheoryLab(false);
  };

  const handleDeploySchema = (output: ArchitectOutput) => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name: output.projectName,
      lastModified: Date.now(),
      entries: [],
      blueprint: null,
      customColumns: output.schema.map(f => f.name)
    };
    setProjects(prev => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setViewMode('list');
    setShowArchitectStudio(false);
  };

  const processImportFile = async (file: File, targetProjectId?: string) => {
    setIsGeocoding(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(ws) as any[];
      if (rawData.length === 0) throw new Error("Empty file");
      const keys = Object.keys(rawData[0]);
      
      const newEntries: BibEntry[] = rawData.map((row, i) => {
        const title = getColumnValue(row, keys, ['Title', '书名', '标题', 'Name', 'Original Title', 'Work', '作品名']) || 'Untitled';
        const yearRaw = getColumnValue(row, keys, ['Year', '年份', '出版年份', 'Date', 'Time', 'Period']);
        const author = getColumnValue(row, keys, ['Author', '作者', '著者', 'Writer', 'Creator']) || 'Unknown';
        const translator = getColumnValue(row, keys, ['Translator', '译者', '译著者', 'Mediator']) || 'Unknown';
        const publisher = getColumnValue(row, keys, ['Publisher', '出版社', '出版机构', 'Institution']) || 'Unknown';
        const city = getColumnValue(row, keys, ['City', '城市', '镇', 'Town', 'Site', 'PubPlace', '出版地', '地点', '市']) || '';
        const province = getColumnValue(row, keys, ['Province', 'State', '省', '省份', '州', 'Region', 'County', '地区', '行政区']) || '';
        const sourceLang = getColumnValue(row, keys, ['SourceLang', '源语', '原文语言', 'Source', 'From']) || 'Portuguese';
        const targetLang = getColumnValue(row, keys, ['TargetLang', '目标语', '译文语言', 'Target', 'To']) || 'Chinese';
        const lat = getColumnValue(row, keys, ['Latitude', 'Lat', '纬度', 'CoordY', 'Y']);
        const lon = getColumnValue(row, keys, ['Longitude', 'Lon', 'Long', '经度', 'CoordX', 'X']);
        const yearMatch = String(yearRaw || '').match(/\d{4}/);
        const publicationYear = yearMatch ? parseInt(yearMatch[0]) : 2024;
        const customMetadata: Record<string, any> = { ...row };
        if (lat !== null && lon !== null && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
           customMetadata.targetCoord = [Number(lon), Number(lat)];
           customMetadata.gisSource = 'file';
        }
        return {
          id: `imp-${Date.now()}-${i}`,
          title: String(title), publicationYear,
          author: { name: String(author), gender: Gender.UNKNOWN },
          translator: { name: String(translator), gender: Gender.UNKNOWN },
          publisher: String(publisher), city: String(city), provinceState: String(province),
          sourceLanguage: String(sourceLang), targetLanguage: String(targetLang), customMetadata
        };
      });

      const geocodedEntries = await enrichEntriesWithGIS(newEntries);
      if (targetProjectId) {
        setProjects(prev => prev.map(p => p.id === targetProjectId ? { 
          ...p, entries: [...p.entries, ...geocodedEntries], lastModified: Date.now() 
        } : p));
      } else {
        const newProj: Project = { 
          id: `proj-${Date.now()}`, name: `Import: ${file.name}`, lastModified: Date.now(), 
          entries: geocodedEntries, blueprint: null, 
          customColumns: keys.filter(k => !['Title', '书名', 'Author', '作者', 'Year', '年份', 'Publisher', '出版社', 'City', '出版地', 'Province', 'State', '省'].includes(k)) 
        };
        setProjects(prev => [newProj, ...prev]);
        setActiveProjectId(newProj.id);
      }
    } catch (err) { alert("Failed to parse the file."); } finally { setIsGeocoding(false); }
  };

  if (!activeProjectId) {
    return (
      <div className="h-screen bg-[#fcfcfd] flex flex-col items-center justify-center p-8 relative overflow-hidden text-slate-900">
        <GlobalFlowBackground />
        <div className="relative z-10 flex flex-col items-center text-center max-w-7xl animate-fadeIn w-full px-4">
            <div className="mb-12 space-y-2">
                <h1 className="text-[72px] md:text-[84px] font-bold serif text-slate-900 tracking-tighter leading-none">Translation as Data</h1>
                <h1 className="text-[54px] md:text-[64px] font-bold serif text-slate-800 tracking-tight leading-none">翻译即数据</h1>
                <div className="pt-6 space-y-1">
                  <p className="text-[12px] font-black tracking-[0.5em] uppercase text-indigo-600 italic">Methodological & Structural Lab for Scholars</p>
                  <p className="text-[12px] font-black tracking-[0.4em] uppercase text-indigo-500 italic">学术方法论与数据建构实验室</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-6xl mb-16">
                <button onClick={() => setShowArchitectStudio(true)} className="p-10 bg-white text-slate-900 rounded-[3rem] border border-slate-100 shadow-2xl hover:-translate-y-2 transition-all flex flex-col items-center gap-6 group">
                   <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shadow-inner">📐</div>
                   <div className="text-center space-y-1">
                     <h3 className="text-lg font-bold serif">AI Architect</h3>
                     <h3 className="text-sm font-bold text-slate-500 serif">AI 架构师</h3>
                     <div className="pt-2">
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Data Engineering & Schema</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">数据工程与架构设计</p>
                     </div>
                   </div>
                </button>
                <button onClick={() => setShowTheoryLab(true)} className="p-10 bg-white text-slate-900 rounded-[3rem] border border-slate-100 shadow-2xl hover:-translate-y-2 transition-all flex flex-col items-center gap-6 group">
                   <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">🔬</div>
                   <div className="text-center space-y-1">
                     <h3 className="text-lg font-bold serif text-slate-800">TAD Lab</h3>
                     <h3 className="text-sm font-bold text-slate-500 serif">TAD 实验室</h3>
                     <div className="pt-2">
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Theory-driven framework</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">理论驱动型研究框架</p>
                     </div>
                   </div>
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-10 bg-white text-slate-900 rounded-[3rem] border border-slate-100 shadow-2xl hover:-translate-y-2 transition-all flex flex-col items-center gap-6 group relative overflow-hidden">
                   {isGeocoding && (
                      <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center animate-fadeIn">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Parsing GIS / 地理编修中...</span>
                      </div>
                   )}
                   <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">📊</div>
                   <div className="text-center space-y-1">
                     <h3 className="text-lg font-bold serif text-slate-800">Import File</h3>
                     <h3 className="text-sm font-bold text-slate-500 serif">导入文件</h3>
                     <div className="pt-2">
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Excel/CSV Deployment</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">档案库快速部署</p>
                     </div>
                   </div>
                </button>
                <button onClick={loadSampleProject} className="p-10 bg-white text-slate-900 rounded-[3rem] border border-slate-100 shadow-2xl hover:-translate-y-2 transition-all flex flex-col items-center gap-6 group">
                   <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">📂</div>
                   <div className="text-center space-y-1">
                     <h3 className="text-lg font-bold serif text-slate-900">Sample Project</h3>
                     <h3 className="text-sm font-bold text-slate-500 serif">示例项目</h3>
                     <div className="pt-2">
                        <p className="text-[8px] text-amber-600 font-bold uppercase tracking-widest">Load PT-CN Corpus</p>
                        <p className="text-[8px] text-amber-600 font-bold uppercase tracking-widest">加载葡中语料库</p>
                     </div>
                   </div>
                </button>
            </div>

            {projects.length > 0 && (
                <div className="w-full max-w-5xl">
                    <div className="flex items-center gap-4 mb-6">
                       <div className="text-left space-y-0.5">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Active Lab Projects</h3>
                          <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-300">活跃研究项目</h3>
                       </div>
                       <div className="h-px bg-slate-100 flex-1"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {projects.sort((a,b) => b.lastModified - a.lastModified).slice(0, 9).map(p => (
                            <div key={p.id} onClick={() => setActiveProjectId(p.id)} className="p-6 bg-white border border-slate-100 rounded-[2.5rem] flex items-center gap-5 hover:border-indigo-200 transition-all text-left shadow-sm hover:shadow-xl group relative cursor-pointer">
                                <div className="text-2xl grayscale group-hover:grayscale-0 transition-all">📘</div>
                                <div className="flex-1">
                                    <h4 className="text-xs font-bold serif text-slate-800 line-clamp-1 pr-8">{p.name}</h4>
                                    <div className="mt-1">
                                      <p className="text-[8px] font-black uppercase text-indigo-500 tracking-widest">{p.entries.length} RECORDS</p>
                                    </div>
                                </div>
                                <button onClick={(e) => deleteProject(p.id, e)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500 transition-all z-[100]">&times;</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
        <footer className="absolute bottom-8 text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 serif italic">@Lidia Zhou Mengyuan 2026</footer>
        {showTheoryLab && <TheoryLab onClose={() => setShowTheoryLab(false)} onApplyBlueprint={handleApplyBlueprint} />}
        {showArchitectStudio && <ArchitectStudio onClose={() => setShowArchitectStudio(false)} onDeploy={handleDeploySchema} />}
        <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && processImportFile(e.target.files[0])} className="hidden" accept=".xlsx,.xls,.csv" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#fcfcfd] flex flex-col overflow-hidden text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-100 h-20 flex items-center px-10 z-[200]">
        <div className="max-w-[1920px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
             <button onClick={() => setActiveProjectId(null)} className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all shadow-sm">🏠</button>
             <div className="space-y-0.5">
               <h1 className="text-lg font-bold text-slate-800 serif leading-none">{activeProject?.name}</h1>
               <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Active Archives • {activeProject?.entries.length} items</p>
             </div>
          </div>
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-xl shadow-inner">
            {['list', 'network', 'stats', 'map', 'blueprint'].map(m => (
                <button key={m} onClick={() => setViewMode(m as any)} className={`px-6 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === m ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>
                    {m === 'list' ? 'Archive' : m === 'network' ? 'Network' : m === 'stats' ? 'Stats' : m === 'map' ? 'GIS Lab' : 'Framework'}
                </button>
            ))}
          </nav>
          <div className="flex items-center gap-4">
             <button onClick={() => setShowEntryForm(true)} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all">+ Add Entry</button>
             <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all">Import File</button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {viewMode === 'list' && (
            <div className="p-10 h-full overflow-auto bg-white custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-10">
                    <div className="flex justify-between items-end border-b border-slate-100 pb-6">
                        <div className="space-y-1">
                           <h2 className="text-3xl font-bold serif text-slate-900">Archive Laboratory / 档案研究室</h2>
                           <p className="text-slate-400 text-xs font-serif italic">Curating bibliographic records for computational analysis.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={reprocessProjectGIS} disabled={isGeocoding} className={`px-6 py-3 border border-indigo-100 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isGeocoding ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 shadow-sm'}`}>
                                {isGeocoding ? 'Identifying GIS...' : 'Scan & Geocode Missing / 识别缺失GIS'}
                            </button>
                            <input type="text" placeholder="Search entries..." className="pl-4 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] outline-none focus:ring-4 ring-indigo-50 w-56 font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    
                    {activeProject?.entries.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center text-center space-y-8 animate-fadeIn">
                             <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-4xl border border-slate-100 shadow-inner">📄</div>
                             <h3 className="text-xl font-bold serif text-slate-900">This lab is currently empty.</h3>
                             <div className="flex gap-4">
                                 <button onClick={() => setShowEntryForm(true)} className="px-10 py-5 bg-indigo-600 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-2xl">+ Add First Entry</button>
                             </div>
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden min-w-full pb-24">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-[8px] font-black uppercase text-slate-400 border-b border-slate-100">
                                    <tr>
                                        <th className="p-6 border-r border-slate-100">Bibliographic Record</th>
                                        <th className="p-6 border-r border-slate-100">Agents</th>
                                        <th className="p-6 border-r border-slate-100">GIS Context</th>
                                        {activeProject?.customColumns.map(c => <th key={c} className="p-6 text-indigo-500 font-black">{c}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-serif text-slate-800">
                                    {filteredEntries.map(e => (
                                        <tr key={e.id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="p-6 border-r border-slate-100">
                                                <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm">{e.title}</p>
                                                <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">{e.publicationYear} • {e.publisher}</p>
                                            </td>
                                            <td className="p-6 border-r border-slate-100">
                                                <p className="text-xs">A: {e.author.name}</p>
                                                <p className="text-xs text-indigo-400">T: {e.translator.name}</p>
                                            </td>
                                            <td className="p-6 border-r border-slate-100">
                                                <span className="text-xs font-bold italic">{[e.provinceState, e.city].filter(p => p && p.length > 0).join(", ") || 'No GIS'}</span>
                                            </td>
                                            {activeProject?.customColumns.map(c => (
                                                <td key={c} className="p-6 text-xs italic text-slate-500">{String(e.customMetadata?.[c] || '-')}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        )}
        
        {viewMode === 'network' && <NetworkGraph data={filteredEntries} customColumns={activeProject?.customColumns || []} blueprint={activeProject?.blueprint || null} onDataUpdate={() => {}} />}
        {viewMode === 'stats' && <StatsDashboard data={filteredEntries} insights={statsInsights} onGenerateInsights={async () => { setIsAnalyzing(true); setStatsInsights(await generateInsights(filteredEntries)); setIsAnalyzing(false); }} isAnalyzing={isAnalyzing} customColumns={activeProject?.customColumns || []} />}
        {viewMode === 'map' && <WorldMap data={filteredEntries} />}
        {viewMode === 'blueprint' && <div className="p-20 h-full overflow-auto bg-slate-50"><div className="max-w-4xl mx-auto space-y-10"><h2 className="text-3xl font-bold serif text-slate-900">{activeProject?.blueprint?.projectScope || 'Project Framework'}</h2><div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100"><p className="text-lg font-serif leading-relaxed text-slate-600 italic">"{activeProject?.blueprint?.methodology || 'No framework deployed.'}"</p></div></div></div>}
      </main>

      {showTheoryLab && <TheoryLab onClose={() => setShowTheoryLab(false)} onApplyBlueprint={handleApplyBlueprint} />}
      {showArchitectStudio && <ArchitectStudio onClose={() => setShowArchitectStudio(false)} onDeploy={handleDeploySchema} />}
      <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && processImportFile(e.target.files[0], activeProject?.id)} className="hidden" accept=".xlsx,.xls,.csv" />
    </div>
  );
}

export default App;
