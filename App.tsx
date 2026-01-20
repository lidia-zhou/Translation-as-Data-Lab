
import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BibEntry, ViewMode, Gender, Project, ResearchBlueprint } from './types';
import NetworkGraph from './components/NetworkGraph';
import StatsDashboard from './components/StatsDashboard';
import WorldMap from './components/WorldMap';
import GlobalFlowBackground from './components/GlobalFlowBackground';
import TheoryLab from './components/TheoryLab';
import { generateResearchBlueprint, generateInsights, geocodeLocation } from './services/geminiService';
import { SAMPLE_ENTRIES, COORDS as LOCAL_COORDS } from './constants';

const STORAGE_KEY_PROJECTS = 'transdata_core_v23_final';
const STORAGE_KEY_ACTIVE_ID = 'transdata_active_id_v23_final';

const resolveOfflineCoords = (name: string): [number, number] | null => {
    if (!name) return null;
    const clean = name.trim().toLowerCase();
    if (LOCAL_COORDS[clean]) return LOCAL_COORDS[clean];
    const matchedKey = Object.keys(LOCAL_COORDS).find(k => clean.includes(k) || k.includes(clean));
    return matchedKey ? LOCAL_COORDS[matchedKey] : null;
};

const ServiceStatus = () => {
    const hasAPI = !!process.env.API_KEY;
    const handleSelectKey = async () => {
        if (typeof window !== 'undefined' && (window as any).aistudio) {
            await (window as any).aistudio.openSelectKey();
        }
    };
    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                <div className={`w-1.5 h-1.5 rounded-full ${hasAPI ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></div>
                <span className="text-[9px] font-black uppercase tracking-widest text-white/80">
                    {hasAPI ? 'AI Engine Active' : 'Offline Mode'}
                </span>
            </div>
            <button 
                onClick={handleSelectKey}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl transition-all border border-indigo-400/30"
            >
                {hasAPI ? 'Switch API Key' : 'Unlock AI Features'}
            </button>
        </div>
    );
};

const ProjectHubOverlay = ({ projects, setProjects, onEnter, onClose }: { 
  projects: Project[], 
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
  onEnter: (id: string) => void,
  onClose: () => void 
}) => (
  <div className="fixed inset-0 bg-white/95 backdrop-blur-3xl z-[800] flex flex-col p-12 md:p-24 animate-fadeIn overflow-auto text-slate-900">
    <div className="max-w-7xl w-full mx-auto space-y-20">
      <div className="flex justify-between items-end border-b border-slate-100 pb-16">
        <div className="space-y-4">
           <h2 className="text-6xl font-bold serif leading-none tracking-tight text-slate-900">Project Hub</h2>
           <h2 className="text-4xl font-bold serif leading-none tracking-tight text-slate-400">项目中心</h2>
           <p className="text-xl font-bold serif text-slate-300 italic mt-4">Research Archive Management / 研究档案管理</p>
        </div>
        <button onClick={onClose} className="text-7xl font-light hover:text-indigo-600 transition-transform hover:scale-110 leading-none">&times;</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        {projects.map(p => (
          <div key={p.id} className="p-12 bg-white border border-slate-100 rounded-[3.5rem] shadow-sm hover:shadow-2xl transition-all relative flex flex-col justify-between h-[450px] group ring-1 ring-slate-100">
            <div className="space-y-8">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-4xl">📓</div>
              <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Project Title</p>
                  <input 
                    className="w-full text-2xl font-bold serif bg-transparent border-none outline-none focus:ring-4 ring-indigo-50 p-3 rounded-2xl" 
                    value={p.name} 
                    onChange={(e) => setProjects(prev => prev.map(x => x.id === p.id ? {...x, name: e.target.value} : x))}
                  />
              </div>
            </div>
            <div className="flex flex-col gap-4">
               <button onClick={() => onEnter(p.id)} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-bold text-sm uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl">
                 <span className="block">Enter Lab</span>
                 <span className="block text-[10px] opacity-60">进入实验室</span>
               </button>
               <button onClick={() => setProjects(prev => prev.filter(x => x.id !== p.id))} className="text-xs font-bold text-rose-400 uppercase tracking-widest hover:text-rose-600 py-2">Delete / 删除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_ACTIVE_ID));
  const [showProjectOverlay, setShowProjectOverlay] = useState(false);
  const [showTheoryLab, setShowTheoryLab] = useState(false);
  const [showArchitectPrompt, setShowArchitectPrompt] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [processingIdx, setProcessingIdx] = useState<number | null>(null);
  const [statsInsights, setStatsInsights] = useState("");
  const [showBulkSourceHubModal, setShowBulkSourceHubModal] = useState(false);
  const [bulkSourceCity, setBulkSourceCity] = useState("Portugal");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);

  const isSampleProjectActive = useMemo(() => activeProject?.id === 'sample-pcc', [activeProject]);

  useEffect(() => localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects)), [projects]);
  useEffect(() => {
    if (activeProjectId) localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeProjectId);
    else localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  }, [activeProjectId]);

  const createNewProject = (name: string, entries: BibEntry[] = [], blueprint?: ResearchBlueprint, customId?: string) => {
    const entriesWithGIS = entries.map(e => {
        let meta = { ...e.customMetadata };
        if (!meta.sourceCoord) meta.sourceCoord = LOCAL_COORDS["portugal"]; 
        if (!meta.targetCoord) {
            const coords = resolveOfflineCoords(e.city || '') || resolveOfflineCoords(e.provinceState || '');
            if (coords) meta.targetCoord = coords;
        }
        return { ...e, customMetadata: meta };
    });

    const newProj: Project = { 
        id: customId || `proj-${Date.now()}`, 
        name, 
        lastModified: Date.now(), 
        entries: entriesWithGIS, 
        blueprint: blueprint || null,
        customColumns: blueprint?.suggestedSchema.map(s => s.fieldName) || []
    };
    setProjects(prev => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setViewMode('list');
  };

  const updateEntry = (id: string, updates: Partial<BibEntry>) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return {
              ...p,
              entries: p.entries.map(e => e.id === id ? { ...e, ...updates } : e)
          };
      }));
  };

  const handleManualSourceHubChange = async (id: string, cityName: string) => {
      const coords = resolveOfflineCoords(cityName);
      if (coords) {
          updateEntry(id, { originalCity: cityName, customMetadata: { ...activeProject?.entries.find(e => e.id === id)?.customMetadata, sourceCoord: coords } });
      } else {
          if (process.env.API_KEY) {
              const geoCoords = await geocodeLocation(cityName);
              if (geoCoords) {
                  updateEntry(id, { originalCity: cityName, customMetadata: { ...activeProject?.entries.find(e => e.id === id)?.customMetadata, sourceCoord: geoCoords } });
                  return;
              }
          }
          updateEntry(id, { originalCity: cityName });
      }
  };

  const handleBulkSourceHubApply = async () => {
      if (!activeProject) return;
      let coords = resolveOfflineCoords(bulkSourceCity);
      if (!coords && process.env.API_KEY) {
          coords = await geocodeLocation(bulkSourceCity);
      }
      
      if (!coords) {
          alert("Location not found in local cache. Please try a major city name like 'Lisbon' or 'Porto'.");
          return;
      }

      setProjects(prev => prev.map(p => {
          if (p.id !== activeProject.id) return p;
          return {
              ...p,
              entries: p.entries.map(e => ({
                  ...e,
                  originalCity: bulkSourceCity,
                  customMetadata: { ...e.customMetadata, sourceCoord: coords }
              }))
          };
      }));
      setShowBulkSourceHubModal(false);
  };

  const handleArchitectBuild = async () => {
    if (!projectInput.trim()) return;
    setIsArchitecting(true);
    try {
        const bp = await generateResearchBlueprint(projectInput);
        createNewProject(bp.projectScope, [], bp);
        setViewMode('blueprint');
        setShowArchitectPrompt(false);
    } catch (e) { alert("AI Architect failed."); }
    finally { setIsArchitecting(false); }
  };

  const handleApplyBlueprint = (bp: ResearchBlueprint) => {
    createNewProject(bp.projectScope, [], bp);
    setViewMode('blueprint');
    setShowTheoryLab(false);
  };

  const handleGenerateBlueprintInLab = async () => {
    if (!activeProject || isArchitecting) return;
    setIsArchitecting(true);
    try {
        const bp = await generateResearchBlueprint(activeProject.name);
        setProjects(prev => prev.map(p => p.id === activeProject.id ? { 
            ...p, 
            blueprint: bp,
            customColumns: Array.from(new Set([...p.customColumns, ...bp.suggestedSchema.map(s => s.fieldName)]))
        } : p));
    } catch (e) { alert("AI Architect failed to generate lab blueprint."); }
    finally { setIsArchitecting(false); }
  };

  const handleRepairGIS = async () => {
    if (!activeProject || isGeocoding) return;
    setIsGeocoding(true);
    const hasAPI = !!process.env.API_KEY;
    const updatedEntries = [...activeProject.entries];
    let count = 0;

    for (let i = 0; i < updatedEntries.length; i++) {
        const entry = updatedEntries[i];
        const locationName = entry.city || entry.provinceState;
        if (locationName && !entry.customMetadata?.targetCoord) {
            setProcessingIdx(i);
            let coords = resolveOfflineCoords(entry.city || '') || resolveOfflineCoords(entry.provinceState || '');
            if (!coords && hasAPI) {
                coords = await geocodeLocation(locationName);
            }
            if (coords) {
                updatedEntries[i] = { ...entry, customMetadata: { ...entry.customMetadata, targetCoord: coords } };
                count++;
                setProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, entries: updatedEntries } : p));
                await new Promise(r => setTimeout(r, 50));
            }
        }
    }
    setProcessingIdx(null);
    setIsGeocoding(false);
    alert(`GIS Mapping Complete: ${count} locations resolved.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];
        
        const parsed: BibEntry[] = rawData.map((row, idx) => {
          const city = (row.City || row.city || row['城市'] || '').toString().trim();
          const province = (row.Province || row.province || row['省份'] || '').toString().trim();
          const sourceCity = (row.OriginalCity || row.sourceCity || 'Portugal').toString().trim();
          const offlineCoords = resolveOfflineCoords(city) || resolveOfflineCoords(province);
          const sourceCoords = resolveOfflineCoords(sourceCity) || LOCAL_COORDS["portugal"];

          return {
            id: `imp-${Date.now()}-${idx}`,
            title: String(row.Title || row.title || row['书名'] || 'Untitled'),
            publicationYear: parseInt(row.Year || row.year || row['年份']) || 2024,
            author: { name: String(row.Author || row.author || row['著者'] || 'Unknown'), gender: Gender.UNKNOWN },
            translator: { name: String(row.Translator || row.translator || row['译者'] || 'Unknown'), gender: Gender.UNKNOWN },
            publisher: String(row.Publisher || row.publisher || row['出版社'] || 'N/A'),
            city: city,
            originalCity: sourceCity,
            provinceState: province,
            sourceLanguage: row.SourceLanguage || row.sourceLanguage || 'N/A',
            targetLanguage: row.TargetLanguage || row.targetLanguage || 'N/A',
            customMetadata: { targetCoord: offlineCoords, sourceCoord: sourceCoords }
          };
        });
        createNewProject(`Import: ${file.name}`, parsed);
      } catch (err) { alert("Import Failed."); }
    };
    reader.readAsBinaryString(file);
  };

  if (!activeProjectId) {
    return (
      <div className="h-screen bg-[#fcfcfd] flex flex-col items-center justify-center p-8 relative overflow-hidden select-none text-slate-900">
        <GlobalFlowBackground />
        <div className="absolute top-10 right-10 z-[100]"><ServiceStatus /></div>
        
        <div className="relative z-10 flex flex-col items-center text-center max-w-7xl animate-fadeIn w-full px-4">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-bold serif text-4xl shadow-2xl mb-8">T</div>
            <h1 className="text-[54px] md:text-[72px] font-bold serif text-slate-900 tracking-tighter leading-none mb-2">Translation as Data</h1>
            <h1 className="text-[44px] md:text-[62px] font-bold serif text-slate-700 tracking-tighter leading-none mb-4">翻译即数据</h1>
            <p className="text-[10px] font-black tracking-[0.4em] uppercase text-indigo-500 mb-20 italic">
              Computational Research Lab / 计算翻译学实验室
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl mb-12">
                {/* AI ARCHITECT MODULE */}
                <div 
                  className="bg-white/70 backdrop-blur-xl p-10 rounded-[3rem] border border-white shadow-lg hover:shadow-2xl transition-all ring-1 ring-slate-100 flex flex-col justify-between text-left group cursor-pointer hover:-translate-y-2 duration-500"
                  onClick={() => setShowArchitectPrompt(true)}
                >
                    <div className="space-y-6">
                        <div className="text-4xl bg-indigo-50 w-20 h-20 rounded-[2rem] flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-500">🏗️</div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold serif text-slate-800">AI Architect</h3>
                            <h3 className="text-lg font-bold serif text-slate-600">AI 架构师</h3>
                            <p className="text-[9px] text-slate-400 font-serif italic tracking-widest uppercase pt-2">Data Schema Design (数据模型设计)</p>
                            <div className="pt-4 space-y-1">
                              <p className="text-xs text-slate-600 leading-relaxed">设计项目专属的数据库列名与自定义字段。</p>
                              <p className="text-xs text-slate-400 leading-relaxed font-serif italic">Design project-specific database columns and custom fields.</p>
                            </div>
                        </div>
                    </div>
                    <button className="mt-8 w-full py-4 bg-slate-50 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-widest group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <span className="block">Design Schema</span>
                      <span className="block opacity-60">启动架构 →</span>
                    </button>
                </div>

                {/* DATA PIPELINE MODULE */}
                <div 
                   className="bg-white/70 backdrop-blur-xl p-10 rounded-[3rem] border border-white shadow-lg hover:shadow-2xl transition-all ring-1 ring-slate-100 flex flex-col justify-between text-left group cursor-pointer hover:-translate-y-2 duration-500"
                   onClick={() => fileInputRef.current?.click()}
                >
                    <div className="space-y-6">
                        <div className="text-4xl bg-rose-50 w-20 h-20 rounded-[2rem] flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors duration-500">📥</div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold serif text-slate-800">Data Pipeline</h3>
                            <h3 className="text-lg font-bold serif text-slate-600">数据管道</h3>
                            <p className="text-[9px] text-slate-400 font-serif italic tracking-widest uppercase pt-2">Batch Import (数据批量导入)</p>
                            <div className="pt-4 space-y-1">
                              <p className="text-xs text-slate-600 leading-relaxed">一键上传 Excel 记录并自动提取实体。</p>
                              <p className="text-xs text-slate-400 leading-relaxed font-serif italic">Upload Excel datasets with automated entity extraction.</p>
                            </div>
                        </div>
                    </div>
                    <button className="mt-8 w-full py-4 bg-slate-50 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-widest group-hover:bg-rose-600 group-hover:text-white transition-all">
                      <span className="block">Upload Dataset</span>
                      <span className="block opacity-60">导入数据 →</span>
                    </button>
                </div>

                {/* METHODOLOGY LAB MODULE */}
                <div 
                   className="bg-white/70 backdrop-blur-xl p-10 rounded-[3rem] border border-white shadow-lg hover:shadow-2xl transition-all ring-1 ring-slate-100 flex flex-col justify-between text-left group cursor-pointer hover:-translate-y-2 duration-500"
                   onClick={() => setShowTheoryLab(true)}
                >
                    <div className="space-y-6">
                        <div className="text-4xl bg-emerald-50 w-20 h-20 rounded-[2rem] flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-500">🔬</div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold serif text-slate-800">Methodology Lab</h3>
                            <h3 className="text-lg font-bold serif text-slate-600">研究方法室</h3>
                            <p className="text-[9px] text-slate-400 font-serif italic tracking-widest uppercase pt-2">TAD Research Framework (TAD 研究框架)</p>
                            <div className="pt-4 space-y-1">
                              <p className="text-xs text-slate-600 leading-relaxed">基于“翻译即数据”五维模型，规划您的数字化研究路径。</p>
                              <p className="text-xs text-slate-400 leading-relaxed font-serif italic">Plan your digital research path based on the 5D TAD framework.</p>
                            </div>
                        </div>
                    </div>
                    <button className="mt-8 w-full py-4 bg-slate-50 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-widest group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      <span className="block">Plan Strategy</span>
                      <span className="block opacity-60">规划策略 →</span>
                    </button>
                </div>
            </div>

            <div className="w-full max-w-5xl flex flex-col md:flex-row gap-6 items-center justify-center">
                <div 
                    className="flex-1 bg-indigo-50/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-indigo-100/50 flex items-center justify-between group cursor-pointer hover:bg-indigo-600 transition-all shadow-sm" 
                    onClick={() => createNewProject("Portuguese-Chinese Sample Project", SAMPLE_ENTRIES, undefined, "sample-pcc")}
                >
                    <div className="flex items-center gap-6">
                        <span className="text-3xl">📖</span>
                        <div className="text-left space-y-1">
                            <h4 className="text-sm font-bold serif group-hover:text-white transition-colors">Explore Sample Project</h4>
                            <h4 className="text-xs font-bold serif group-hover:text-white/80 transition-colors opacity-70">葡汉翻译数据集样本</h4>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-100 transition-colors pt-1">History records circulation. / 历史流转样本。</p>
                        </div>
                    </div>
                    <button className="px-8 py-3 bg-white rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-50 shadow-sm group-hover:scale-105 transition-all text-indigo-600">
                      Enter Lab / 进入实验室 →
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={() => setShowProjectOverlay(true)} className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 hover:bg-indigo-500 transition-all">
                      <span>📓</span> 
                      <div className="text-left leading-none">
                        <span className="block">Archive ({projects.length})</span>
                        <span className="block text-[8px] opacity-60">项目存档</span>
                      </div>
                    </button>
                </div>
            </div>

            <footer className="mt-16 py-8 border-t border-slate-200/50 w-full max-w-xl text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-300 serif italic">
                @Lidia Zhou Mengyuan
              </p>
            </footer>
        </div>

        {showArchitectPrompt && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[900] flex items-center justify-center p-8 animate-fadeIn">
                <div className="bg-white rounded-[3.5rem] p-12 max-w-2xl w-full shadow-3xl space-y-8 border border-white ring-1 ring-slate-100 animate-slideUp">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h3 className="text-3xl font-bold serif text-slate-900">Lab Schema Architect</h3>
                            <h3 className="text-2xl font-bold serif text-slate-500">实验室架构师</h3>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic pt-2">Designing your research database / 正在设计您的研究数据库</p>
                        </div>
                        <button onClick={() => setShowArchitectPrompt(false)} className="text-5xl font-light text-slate-200 hover:text-rose-500 transition-colors leading-none">&times;</button>
                    </div>
                    <textarea 
                        value={projectInput} 
                        onChange={e => setProjectInput(e.target.value)} 
                        placeholder="Define your archive's scope... / 描述您的课题范围..." 
                        className="w-full h-40 bg-slate-50 border border-slate-100 rounded-[2rem] p-8 text-lg font-serif italic outline-none focus:ring-8 ring-indigo-50 transition-all resize-none shadow-inner"
                        autoFocus
                    />
                    <div className="flex gap-4">
                        <button onClick={() => setShowArchitectPrompt(false)} className="flex-1 py-6 bg-slate-100 rounded-[2rem] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Cancel / 取消</button>
                        <button 
                            onClick={handleArchitectBuild} 
                            disabled={isArchitecting || !projectInput.trim()}
                            className="flex-2 py-6 bg-indigo-600 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
                        >
                            {isArchitecting ? 'Architecting Schema...' : 'Deploy Schema / 部署架构 →'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
        {showProjectOverlay && <ProjectHubOverlay projects={projects} setProjects={setProjects} onEnter={id => {setActiveProjectId(id); setShowProjectOverlay(false);}} onClose={() => setShowProjectOverlay(false)} />}
        {showTheoryLab && <TheoryLab onClose={() => setShowTheoryLab(false)} onApplyBlueprint={handleApplyBlueprint} />}
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#fcfcfd] flex flex-col overflow-hidden text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-100 h-24 flex items-center shrink-0 px-12 z-[200]">
        <div className="max-w-[1920px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
             <button onClick={() => setActiveProjectId(null)} className="w-10 h-10 bg-slate-100 hover:bg-indigo-100 rounded-xl flex items-center justify-center text-slate-400 text-xl transition-all shadow-sm">🏠</button>
             <div className="space-y-0.5">
                <h1 className="text-lg font-bold text-slate-800 serif leading-none">Translation as Data</h1>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[300px]">{activeProject?.name}</p>
             </div>
          </div>
          <nav className="flex space-x-1 bg-slate-100 p-1.5 rounded-2xl shadow-inner">
            {['list', 'network', 'stats', 'map', 'blueprint']
              .filter(m => !(m === 'blueprint' && isSampleProjectActive))
              .map(m => (
                <button key={m} onClick={() => setViewMode(m as any)} className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                    {m === 'list' ? 'Archive' : m === 'network' ? 'Network' : m === 'stats' ? 'Stats' : m === 'map' ? 'GIS Lab' : 'Framework'}
                </button>
            ))}
          </nav>
          <div className="flex items-center gap-4">
             <button onClick={handleRepairGIS} disabled={isGeocoding} className="px-6 py-3 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all shadow-sm">{isGeocoding ? '📍 Resolving GIS...' : '📍 Repair GIS'}</button>
             <button onClick={() => fileInputRef.current?.click()} className="bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-md">Import</button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative pb-12">
        {viewMode === 'list' && (
           <div className="p-12 h-full overflow-auto animate-fadeIn custom-scrollbar bg-slate-50/20">
              {showBulkSourceHubModal && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[500] flex items-center justify-center p-8">
                      <div className="bg-white rounded-[3.5rem] p-16 max-w-2xl w-full shadow-3xl space-y-12 border border-slate-100 ring-1 ring-white/20">
                          <div className="space-y-4 text-center">
                              <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center text-4xl mx-auto shadow-inner text-rose-500">🌐</div>
                              <h3 className="text-4xl font-bold serif text-slate-900">Batch Set Global Source Hub</h3>
                              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 italic">This will update all {activeProject?.entries.length} entries to the same origin point.</p>
                          </div>
                          <div className="space-y-6">
                              <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 ml-4">Target Source Point (e.g. Portugal, Paris, Lisbon)</label>
                              <input 
                                value={bulkSourceCity} 
                                onChange={e => setBulkSourceCity(e.target.value)}
                                className="w-full p-8 bg-slate-50 rounded-[2rem] border border-slate-200 text-2xl font-bold serif outline-none focus:ring-8 ring-rose-50 transition-all shadow-inner" 
                                placeholder="Common: Portugal, Lisbon, Porto..."
                                autoFocus
                              />
                              <div className="flex flex-wrap gap-2 px-4">
                                  {['Portugal', 'Lisbon', 'Porto', 'Coimbra'].map(s => (
                                      <button key={s} onClick={() => setBulkSourceCity(s)} className="px-4 py-2 bg-slate-100 hover:bg-rose-100 rounded-full text-[10px] font-bold text-slate-500 hover:text-rose-600 transition-all border border-slate-200">
                                          {s}
                                      </button>
                                  ))}
                              </div>
                          </div>
                          <div className="flex gap-4 pt-4">
                              <button onClick={() => setShowBulkSourceHubModal(false)} className="flex-1 py-6 bg-slate-100 rounded-[2rem] text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Cancel</button>
                              <button onClick={handleBulkSourceHubApply} className="flex-1 py-6 bg-rose-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95">Set All Sources</button>
                          </div>
                      </div>
                  </div>
              )}

              <div className="max-w-[1920px] mx-auto space-y-10">
                <div className="flex justify-between items-end border-b border-slate-100 pb-10">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-5xl font-bold serif text-slate-900">Bibliographic Archive</h2>
                            <p className="text-xs text-slate-400 font-serif italic">Management of translation records and spatial mediators.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowBulkSourceHubModal(true)} className="px-8 py-4 bg-white border border-rose-200 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-50 transition-all shadow-xl shadow-rose-100 flex items-center gap-3">
                                <span className="text-xl">🌍</span> Global Source Hub / 一键原语
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mr-4">Records Count: {activeProject?.entries.length}</div>
                        <input className="w-96 p-5 bg-white rounded-[1.5rem] border border-slate-200 text-sm outline-none shadow-sm focus:ring-4 ring-indigo-50 transition-all" placeholder="Search archive..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden mb-20 ring-1 ring-slate-100">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-100">
                        <tr>
                            <th className="p-8">Work Title</th>
                            <th className="p-8 text-rose-500">Source Hub (Origin) / 原语地</th>
                            <th className="p-8 text-indigo-500">Target Hub (Publish) / 译语地</th>
                            <th className="p-8 text-slate-600">Translator</th>
                            <th className="p-8 text-center">GIS Link</th>
                            <th className="p-8 text-right">Year</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-serif text-lg text-slate-700">
                        {activeProject?.entries.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()) || e.translator.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.author.name.toLowerCase().includes(searchTerm.toLowerCase())).map((e, i) => (
                          <tr key={e.id} className="hover:bg-indigo-50/5 transition-all duration-300">
                            <td className="p-8 font-bold text-slate-900 truncate max-w-xs">{e.title}</td>
                            <td className="p-8 group relative">
                                <div className="flex items-center gap-2">
                                    <input 
                                        className="bg-transparent border-b border-transparent hover:border-rose-200 focus:border-rose-400 outline-none w-full text-rose-600 font-bold transition-all py-1"
                                        value={e.originalCity || ''}
                                        placeholder="Type city..."
                                        onBlur={(evt) => handleManualSourceHubChange(e.id, evt.target.value)}
                                        onChange={(evt) => updateEntry(e.id, { originalCity: evt.target.value })}
                                    />
                                    {e.customMetadata?.sourceCoord && (
                                        <span className="text-xs text-rose-300" title="Geocoded Source">📍</span>
                                    )}
                                </div>
                            </td>
                            <td className="p-8 group">
                                <div className="flex items-center gap-2">
                                    <input 
                                        className="bg-transparent border-b border-transparent hover:border-indigo-200 focus:border-indigo-400 outline-none w-full text-indigo-600 font-bold transition-all py-1"
                                        value={e.city || ''}
                                        placeholder="Type city..."
                                        onBlur={(evt) => {
                                            const cityName = evt.target.value;
                                            const coords = resolveOfflineCoords(cityName);
                                            updateEntry(e.id, { city: cityName, customMetadata: { ...e.customMetadata, targetCoord: coords || e.customMetadata?.targetCoord } });
                                        }}
                                        onChange={(evt) => updateEntry(e.id, { city: evt.target.value })}
                                    />
                                    {e.customMetadata?.targetCoord && (
                                        <span className="text-xs text-indigo-300" title="Geocoded Target">📍</span>
                                    )}
                                </div>
                            </td>
                            <td className="p-8 text-slate-500 font-bold text-base">{e.translator.name}</td>
                            <td className="p-8 text-center">
                                {e.customMetadata?.targetCoord && e.customMetadata?.sourceCoord ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)] animate-pulse"></div>
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Active Path</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2 text-slate-300">
                                        <span className="text-[9px] font-black uppercase tracking-tighter">Broken Flow</span>
                                    </div>
                                )}
                            </td>
                            <td className="p-8 text-slate-400 font-mono text-sm text-right font-bold">{e.publicationYear}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
              </div>
           </div>
        )}
        {viewMode === 'network' && <NetworkGraph data={activeProject?.entries || []} customColumns={activeProject?.customColumns || []} blueprint={activeProject?.blueprint || null} onDataUpdate={() => {}} />}
        {viewMode === 'stats' && <StatsDashboard data={activeProject?.entries || []} insights={statsInsights} onGenerateInsights={async () => { setIsAnalyzing(true); setStatsInsights(await generateInsights(activeProject?.entries || [])); setIsAnalyzing(false); }} isAnalyzing={isAnalyzing} customColumns={activeProject?.customColumns || []} />}
        {viewMode === 'map' && <WorldMap data={activeProject?.entries || []} />}
        {viewMode === 'blueprint' && (
            <div className="p-24 h-full overflow-auto animate-fadeIn bg-slate-950 text-white flex flex-col items-center custom-scrollbar">
                {activeProject?.blueprint ? (
                    <div className="max-w-5xl w-full space-y-20 pb-20">
                        <div className="space-y-6">
                            <div className="w-20 h-2 bg-indigo-500 rounded-full mb-8 shadow-[0_0_20px_rgba(99,102,241,0.5)]"></div>
                            <h2 className="text-7xl font-bold serif leading-tight tracking-tight">Project Architecture</h2>
                            <p className="text-3xl text-slate-400 font-serif italic leading-relaxed">{activeProject.blueprint.projectScope}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="bg-white/5 p-16 rounded-[4rem] border border-white/5 space-y-10 shadow-2xl">
                                <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-indigo-400">Archival Schema</h3>
                                <div className="flex flex-wrap gap-4">
                                    {activeProject.blueprint.suggestedSchema.map(s => <span key={s.fieldName} className="px-6 py-3 bg-white/10 rounded-2xl text-[12px] font-bold border border-white/5 hover:bg-white/20 transition-all">{s.fieldName}</span>)}
                                </div>
                            </div>
                            <div className="bg-white/5 p-16 rounded-[4rem] border border-white/5 space-y-10 shadow-2xl">
                                <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-indigo-400">Methodological Summary</h3>
                                <p className="text-2xl font-serif italic text-slate-300 leading-relaxed">
                                    {activeProject.blueprint.methodology}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-16 max-w-3xl text-center">
                         <div className="text-8xl mb-4 bg-white/5 w-32 h-32 rounded-[3rem] flex items-center justify-center border border-white/10 shadow-2xl animate-pulse">🏛️</div>
                         <h2 className="text-5xl font-bold serif">Framework Not Deployed</h2>
                         <button onClick={handleGenerateBlueprintInLab} disabled={isArchitecting} className={`px-20 py-8 bg-indigo-600 text-white rounded-[3rem] text-sm font-black uppercase tracking-[0.5em] transition-all shadow-2xl ${isArchitecting ? 'opacity-50 animate-pulse' : 'hover:bg-indigo-500 hover:scale-105 active:scale-95 ring-[12px] ring-indigo-500/10'}`}>
                            {isArchitecting ? 'Architecting Framework...' : 'Generate Lab Blueprint'}
                         </button>
                    </div>
                )}
            </div>
        )}
      </main>

      <footer className="absolute bottom-4 left-0 w-full text-center pointer-events-none z-[100]">
          <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-400/60 serif italic">
            @Lidia Zhou Mengyuan
          </p>
      </footer>

      {showTheoryLab && <TheoryLab onClose={() => setShowTheoryLab(false)} onApplyBlueprint={handleApplyBlueprint} />}
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
    </div>
  );
}

export default App;
