
import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BibEntry, ViewMode, Gender, ResearchBlueprint, Project } from './types';
import NetworkGraph from './components/NetworkGraph';
import StatsDashboard from './components/StatsDashboard';
import WorldMap from './components/WorldMap';
import GlobalFlowBackground from './components/GlobalFlowBackground';
import UserManual from './components/UserManual';
import { generateResearchBlueprint, generateInsights, geocodeLocation } from './services/geminiService';
import { SAMPLE_ENTRIES } from './constants';

const STORAGE_KEY_PROJECTS = 'transdata_core_v18';
const STORAGE_KEY_ACTIVE_ID = 'transdata_active_id_v18';

function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_ACTIVE_ID));
  const [showProjectOverlay, setShowProjectOverlay] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);

  const [hasStarted, setHasStarted] = useState(() => !!activeProjectId);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [projectInput, setProjectInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEntry, setEditingEntry] = useState<BibEntry | null>(null);
  const [statsInsights, setStatsInsights] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeProjectId);
      setHasStarted(true);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
      setHasStarted(false);
    }
  }, [activeProjectId]);

  const handleReturnToWelcome = () => {
    setActiveProjectId(null);
    setHasStarted(false);
    setShowProjectOverlay(false);
  };

  const createNewProject = (name: string = "New Research Project", initialEntries: BibEntry[] = []) => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name,
      lastModified: Date.now(),
      entries: initialEntries,
      blueprint: null,
      customColumns: []
    };
    setProjects(prev => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setShowProjectOverlay(false);
    setHasStarted(true);
    setViewMode(initialEntries.length > 0 ? 'list' : 'blueprint');
    return newProj;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];

        const parsedEntries: BibEntry[] = rawData.map((row, idx) => ({
          id: `imp-${Date.now()}-${idx}`,
          title: String(row.Title || row.title || row['书名'] || 'Untitled'),
          publicationYear: parseInt(row.Year || row.year || row['年份']) || 2024,
          author: { name: String(row.Author || row.author || row['著者'] || 'Unknown'), gender: Gender.UNKNOWN },
          translator: { name: String(row.Translator || row.translator || row['译者'] || 'Unknown'), gender: Gender.UNKNOWN },
          publisher: String(row.Publisher || row.publisher || row['出版社'] || 'N/A'),
          city: row.City || row.city || row['城市'],
          originalCity: row.OriginalCity || row.originalCity || row['原产地城市'],
          sourceLanguage: row.SourceLanguage || row.sourceLanguage || 'N/A',
          targetLanguage: row.TargetLanguage || row.targetLanguage || 'N/A',
          tags: row.Tags ? String(row.Tags).split(',') : [],
          customMetadata: {}
        }));

        const enrichedEntries = await Promise.all(parsedEntries.map(async (entry) => {
          const updates: any = { ...entry.customMetadata };
          if (entry.city) updates.targetCoord = await geocodeLocation(entry.city);
          if (entry.originalCity) updates.sourceCoord = await geocodeLocation(entry.originalCity);
          return { ...entry, customMetadata: updates };
        }));

        if (activeProject) {
          updateActiveProject({ entries: [...enrichedEntries, ...activeProject.entries] });
          setViewMode('list');
        } else {
          createNewProject(`Imported: ${file.name}`, enrichedEntries);
        }
      } catch (err) {
        alert("文件解析失败，请确保格式正确。");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const loadSampleProject = () => {
    const sampleProj: Project = {
      id: `sample-dglab-${Date.now()}`,
      name: "DGLAB 资助下的葡语文学全球传播研究",
      lastModified: Date.now(),
      entries: SAMPLE_ENTRIES,
      blueprint: {
        projectScope: "利用 DGLAB 官方资助名录，分析葡萄牙语文学在跨国流动中的制度化中介路径。",
        suggestedSchema: [
            { fieldName: "Genre", description: "书籍类别", analyticalUtility: "分析流派传播力", importance: "Critical" },
            { fieldName: "Apoios", description: "资助机构", analyticalUtility: "衡量机构支持度", importance: "Critical" }
        ],
        dataCleaningStrategy: "统一处理出版社名称；标注原产地坐标。",
        storageAdvice: "建议采用标准 JSON-LD。",
        methodology: "社会翻译学（Sociology of Translation）路径。",
        visualizationStrategy: "使用 Force-Atlas-2 展示中心-边缘动态。",
        collectionTips: "注意从 PDF 提取时的格式对齐。"
      },
      customColumns: ["Genre", "Apoios"]
    };
    setProjects(prev => [sampleProj, ...prev]);
    setActiveProjectId(sampleProj.id);
    setHasStarted(true);
    setViewMode('network');
  };

  const updateActiveProject = (updates: Partial<Project>) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, ...updates, lastModified: Date.now() } : p));
  };

  const handleConfirmDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
    }
    setDeletingProjectId(null);
  };

  const handleApplyBlueprint = () => {
    if (!activeProject?.blueprint) return;
    const fieldsToAdd = activeProject.blueprint.suggestedSchema.map(s => s.fieldName);
    updateActiveProject({ customColumns: Array.from(new Set([...activeProject.customColumns, ...fieldsToAdd])) });
    setViewMode('list');
  };

  const handleSaveEntry = async () => {
    if (!editingEntry || !activeProject) return;
    setIsSaving(true);
    let entryToSave = { ...editingEntry };
    try {
      if (editingEntry.originalCity) {
        const coord = await geocodeLocation(editingEntry.originalCity);
        entryToSave.customMetadata = { ...entryToSave.customMetadata, sourceCoord: coord };
      }
      if (editingEntry.city) {
        const coord = await geocodeLocation(editingEntry.city);
        entryToSave.customMetadata = { ...entryToSave.customMetadata, targetCoord: coord };
      }
    } catch (e) {}

    const entries = [...activeProject.entries];
    if (editingEntry.id === 'new') {
      entries.unshift({ ...entryToSave, id: `ent-${Date.now()}` });
    } else {
      const idx = entries.findIndex(x => x.id === editingEntry.id);
      if (idx !== -1) entries[idx] = entryToSave;
    }
    updateActiveProject({ entries });
    setEditingEntry(null);
    setIsSaving(false);
  };

  const ProjectHubOverlay = () => (
    <div className="fixed inset-0 bg-white/98 backdrop-blur-3xl z-[600] flex flex-col p-10 md:p-20 animate-fadeIn overflow-auto text-slate-900">
      <div className="max-w-7xl w-full mx-auto space-y-16">
        <div className="flex justify-between items-end border-b border-slate-100 pb-12 flex-shrink-0">
          <div className="space-y-2">
             <h2 className="text-5xl font-bold serif leading-none">Project Hub</h2>
             <h2 className="text-3xl font-bold serif text-slate-400 italic">实验室项目中心</h2>
          </div>
          <button onClick={() => setShowProjectOverlay(false)} className="text-7xl font-light hover:text-rose-500 transition-colors leading-none">&times;</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 py-4">
          {projects.map(p => (
            <div key={p.id} className="p-10 bg-white border border-slate-100 rounded-[3rem] shadow-sm hover:shadow-2xl transition-all relative h-[400px] flex flex-col justify-between overflow-hidden group border-b-8 border-b-transparent hover:border-b-indigo-500">
              {deletingProjectId === p.id ? (
                <div className="absolute inset-0 bg-rose-500/95 backdrop-blur-md p-10 text-white z-50 flex flex-col justify-center items-center text-center space-y-6 animate-fadeIn">
                   <p className="text-2xl font-bold serif leading-tight">确定要永久删除？<br/><span className="text-xs font-normal opacity-70">该研究课题下的所有数据将无法恢复。</span></p>
                   <div className="flex gap-4 w-full">
                      <button onClick={(e) => { e.stopPropagation(); setDeletingProjectId(null); }} className="flex-1 py-4 bg-white/20 rounded-2xl font-bold text-xs uppercase">取消</button>
                      <button onClick={(e) => handleConfirmDeleteProject(p.id, e)} className="flex-1 py-4 bg-white text-rose-600 rounded-2xl font-bold text-xs uppercase shadow-xl">确认删除</button>
                   </div>
                </div>
              ) : (
                <button 
                  onClick={(e) => { e.stopPropagation(); setDeletingProjectId(p.id); }} 
                  className="absolute top-8 right-8 text-slate-200 hover:text-rose-500 text-4xl font-light transition-colors z-20"
                >&times;</button>
              )}
              
              <div className="space-y-6">
                <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-3xl shadow-inner">📓</div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-300">Project Name / 课题名</label>
                   <input 
                      className="w-full text-xl font-bold serif bg-transparent border-none outline-none focus:bg-slate-50 p-2 rounded-xl transition-all" 
                      value={p.name} 
                      onChange={(e) => {
                          const val = e.target.value;
                          setProjects(prev => prev.map(x => x.id === p.id ? {...x, name: val} : x));
                      }}
                      onClick={e => e.stopPropagation()}
                   />
                </div>
              </div>
              <button onClick={() => { setActiveProjectId(p.id); setShowProjectOverlay(false); }} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg">进入实验室 / Access Lab</button>
            </div>
          ))}
          <button onClick={() => createNewProject()} className="p-10 border-4 border-dashed border-slate-100 rounded-[3.5rem] text-slate-300 hover:text-indigo-400 hover:border-indigo-100 transition-all flex flex-col items-center justify-center gap-6 h-[400px] group flex-shrink-0">
            <span className="text-6xl group-hover:scale-110 transition-transform">+</span>
            <div className="text-center space-y-2">
                <span className="text-xs font-black uppercase tracking-widest block">New Research Laboratory</span>
                <span className="text-xs font-black uppercase tracking-widest block opacity-50">新建数字实验室</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  if (!hasStarted) {
    return (
      <div className="h-screen bg-[#fcfcfd] flex flex-col items-center justify-center p-12 relative overflow-hidden">
        <GlobalFlowBackground />
        
        {isImporting && (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-2xl z-[1000] flex flex-col items-center justify-center space-y-6">
                <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-3xl font-bold serif text-slate-800">正在解析书目数据 / Importing Archives...</p>
            </div>
        )}

        <div className="relative z-10 max-w-6xl w-full text-center animate-fadeIn space-y-16">
          <div className="w-28 h-28 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white font-serif font-bold text-6xl shadow-2xl mx-auto mb-12 transform -rotate-3 hover:rotate-0 transition-transform cursor-pointer" onClick={() => setShowProjectOverlay(true)}>T</div>
          
          <div className="space-y-6">
            <h1 className="text-9xl font-bold serif text-slate-900 tracking-tighter drop-shadow-sm">TransData</h1>
            <div className="space-y-4">
                <p className="text-2xl text-slate-600 font-serif italic leading-relaxed font-medium">翻译研究数字实验室：数据采集・分析・流通・可视化</p>
                <p className="text-xs text-indigo-400 font-serif uppercase tracking-[0.4em] font-bold opacity-80">Specialized Digital Laboratory for Translation Studies</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 w-full mt-20 px-6">
            <button onClick={() => createNewProject("AI 研究课题")} className="group bg-white/60 backdrop-blur-md p-12 rounded-[4rem] border border-white/80 shadow-sm transition-all text-left flex flex-col h-full hover:border-indigo-400 hover:bg-indigo-50/30 hover:shadow-2xl hover:-translate-y-2">
              <div className="text-6xl mb-12 transform group-hover:scale-110 transition-transform">📐</div>
              <div className="space-y-2 mb-10">
                <h3 className="text-3xl font-bold serif text-slate-800 leading-none">AI Architect</h3>
                <h3 className="text-base font-bold serif text-slate-400 italic">AI 架构师</h3>
              </div>
              <div className="space-y-4 mt-auto">
                <p className="text-xs text-slate-500 leading-relaxed uppercase font-black tracking-widest opacity-80">Assist in defining research perspective and data schema.</p>
              </div>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="group bg-white/60 backdrop-blur-md p-12 rounded-[4rem] border border-white/80 shadow-sm transition-all text-left flex flex-col h-full hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-2xl hover:-translate-y-2">
              <div className="text-6xl mb-12 transform group-hover:scale-110 transition-transform">📊</div>
              <div className="space-y-2 mb-10">
                <h3 className="text-3xl font-bold serif text-slate-800 leading-none">Batch Import</h3>
                <h3 className="text-base font-bold serif text-slate-400 italic">批量导入</h3>
              </div>
              <div className="space-y-4 mt-auto">
                <p className="text-xs text-slate-500 leading-relaxed uppercase font-black tracking-widest opacity-80">Rapidly import existing bibliographic Excel datasets.</p>
              </div>
            </button>
            <button onClick={loadSampleProject} className="group bg-white/60 backdrop-blur-md p-12 rounded-[4rem] border border-white/80 shadow-sm transition-all text-left flex flex-col h-full ring-1 ring-amber-100 ring-offset-8 hover:border-amber-400 hover:bg-amber-50/30 hover:shadow-2xl hover:-translate-y-2">
              <div className="text-6xl mb-12 transform group-hover:scale-110 transition-transform">📖</div>
              <div className="space-y-2 mb-10">
                <h3 className="text-3xl font-bold serif text-slate-800 leading-none">Sample Lab</h3>
                <h3 className="text-base font-bold serif text-slate-400 italic">样本实验室</h3>
              </div>
              <div className="space-y-4 mt-auto">
                <p className="text-xs text-slate-500 leading-relaxed uppercase font-black tracking-widest opacity-80">Load DGLAB catalog to experience dynamic analysis.</p>
              </div>
            </button>
          </div>

          <div className="pt-20 flex flex-col items-center gap-12">
             <div className="flex gap-8">
                <button onClick={() => setShowProjectOverlay(true)} className="px-12 py-6 bg-slate-900 text-white rounded-[2.5rem] text-[12px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-5 hover:bg-slate-800 hover:scale-105 transition-all">
                  📁 项目中心 / Project Hub ({projects.length})
                </button>
                <button onClick={() => setShowManual(true)} className="px-12 py-6 bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-600 rounded-[2.5rem] text-[12px] font-black uppercase tracking-widest shadow-lg hover:border-indigo-400 hover:bg-indigo-50/50 transition-all">
                  📘 用户手册 / Manual
                </button>
             </div>
             <p className="text-xs font-black uppercase tracking-[0.5em] text-slate-300">@Lidia Zhou Mengyuan 2026</p>
          </div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
        {showProjectOverlay && <ProjectHubOverlay />}
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#fcfcfd] flex flex-col font-sans overflow-hidden">
      <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-100 h-24 flex items-center shrink-0 px-12 sticky top-0 z-[200]">
        <div className="max-w-[1920px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
             <button onClick={handleReturnToWelcome} className="w-12 h-12 bg-slate-100 hover:bg-indigo-100 rounded-[1rem] flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all text-2xl" title="回到欢迎页">🏠</button>
             <div className="flex items-center gap-4 cursor-pointer" onClick={() => setShowProjectOverlay(true)}>
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold serif text-2xl shadow-md">T</div>
                <div className="hidden lg:block">
                   <h1 className="text-lg font-bold text-slate-800 serif leading-none">TransData</h1>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate max-w-[200px]">{activeProject?.name}</p>
                </div>
             </div>
          </div>
          <nav className="flex space-x-2 bg-slate-100/50 p-1.5 rounded-[1.5rem]">
            {[
              { id: 'list', label: 'Archive' },
              { id: 'network', label: 'Network Lab' },
              { id: 'stats', label: 'Analytics' },
              { id: 'map', label: 'Global Map' },
              { id: 'blueprint', label: 'Blueprint' }
            ].map((m) => (
              <button key={m.id} onClick={() => setViewMode(m.id as any)} className={`px-8 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === m.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
                {m.label}
              </button>
            ))}
          </nav>
          <div className="flex gap-3">
            <button onClick={() => fileInputRef.current?.click()} className="bg-slate-100 text-slate-600 px-8 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-indigo-50 shadow-sm transition-all">Import</button>
            <button onClick={() => setEditingEntry({ id: 'new', title: '', author: {name: '', gender: Gender.UNKNOWN}, translator: {name: '', gender: Gender.UNKNOWN}, publicationYear: 2024, publisher: '', sourceLanguage: '', targetLanguage: '', tags: [], customMetadata: {} })} className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-indigo-600 shadow-lg transition-all">+ New Entry</button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col relative h-full">
        {viewMode === 'blueprint' ? (
           <div className="flex-1 overflow-y-auto p-16 bg-slate-50/30 flex flex-col items-center">
              {!activeProject?.blueprint ? (
                 <div className="max-w-4xl w-full bg-white p-16 rounded-[4rem] shadow-xl space-y-12 animate-slideUp">
                    <div className="text-center">
                       <h2 className="text-3xl font-bold serif mb-4">开启您的研究规划 / Research Architecture</h2>
                       <p className="text-slate-400 font-serif italic text-lg leading-relaxed px-16">Input your topic; AI will curate a methodology-driven schema.</p>
                    </div>
                    <textarea 
                       className="w-full h-48 p-8 bg-slate-50 rounded-[2rem] outline-none text-lg font-serif border border-transparent focus:border-indigo-100 shadow-inner" 
                       placeholder="例如：分析当代葡语文学在东亚的翻译路径..." 
                       value={projectInput} 
                       onChange={e => setProjectInput(e.target.value)} 
                    />
                    <button 
                       onClick={async () => {
                          if (!projectInput.trim()) return;
                          setIsArchitecting(true);
                          try {
                            const bp = await generateResearchBlueprint(projectInput);
                            updateActiveProject({ blueprint: bp, name: bp.projectScope });
                          } catch (e) { alert("AI 调用失败。"); }
                          setIsArchitecting(false);
                       }} 
                       className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-bold text-lg shadow-xl hover:bg-indigo-600 transition-all uppercase tracking-widest"
                    >{isArchitecting ? "正在构思..." : "生成研究蓝图 / Generate Blueprint"}</button>
                 </div>
              ) : (
                 <div className="max-w-6xl w-full bg-white p-16 rounded-[4rem] shadow-xl space-y-12 animate-fadeIn">
                    <div className="border-b border-slate-100 pb-8"><h2 className="text-4xl font-bold serif leading-tight text-slate-800">{activeProject.blueprint.projectScope}</h2></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                       <div className="space-y-10">
                          <section>
                             <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4">01 分析方法论 / Methodology</h4>
                             <p className="text-lg text-slate-700 font-serif italic leading-relaxed">{activeProject.blueprint.methodology}</p>
                          </section>
                          <section className="bg-slate-900 p-10 rounded-[2.5rem] text-white">
                             <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-4">02 可视化策略 / Visualization</h4>
                             <p className="text-xl font-serif italic leading-relaxed">{activeProject.blueprint.visualizationStrategy}</p>
                          </section>
                       </div>
                       <div className="space-y-10">
                          <section>
                             <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4">03 架构建议 / Schema</h4>
                             <div className="space-y-4">
                               {activeProject.blueprint.suggestedSchema.map((s, i) => (
                                 <div key={i} className="p-4 bg-slate-50 rounded-xl">
                                    <p className="font-bold text-slate-800">{s.fieldName}</p>
                                    <p className="text-sm text-slate-500">{s.description}</p>
                                 </div>
                               ))}
                             </div>
                          </section>
                       </div>
                    </div>
                    <div className="pt-10 flex gap-6">
                       <button onClick={() => updateActiveProject({ blueprint: null })} className="px-10 py-5 bg-slate-100 text-slate-400 rounded-full font-bold text-[11px] uppercase tracking-widest">重新策划 / Redesign</button>
                       <button onClick={handleApplyBlueprint} className="flex-1 py-5 bg-indigo-600 text-white rounded-full font-bold text-lg shadow-lg hover:bg-indigo-700 transition-all uppercase tracking-widest">同步架构 / Apply Schema</button>
                    </div>
                 </div>
              )}
           </div>
        ) : viewMode === 'network' ? (
           <NetworkGraph data={activeProject?.entries || []} customColumns={activeProject?.customColumns || []} blueprint={activeProject?.blueprint || null} onDataUpdate={(newEntries) => updateActiveProject({ entries: newEntries })} />
        ) : viewMode === 'stats' ? (
           <div className="flex-1 overflow-y-auto bg-slate-50/50">
              <StatsDashboard data={activeProject?.entries || []} insights={statsInsights} onGenerateInsights={async () => { setIsAnalyzing(true); setStatsInsights(await generateInsights(activeProject?.entries || [])); setIsAnalyzing(false); }} isAnalyzing={isAnalyzing} customColumns={activeProject?.customColumns || []} />
           </div>
        ) : viewMode === 'map' ? (
           <WorldMap data={activeProject?.entries || []} />
        ) : (
           <div className="p-12 flex-1 overflow-auto animate-fadeIn bg-slate-50/20">
              <div className="max-w-[1920px] mx-auto w-full space-y-8">
                <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                        <tr>
                          <th className="p-8">书目信息 (Work Data)</th>
                          <th className="p-8">著者 (Author)</th>
                          <th className="p-8">译者 (Translator)</th>
                          <th className="p-8">年份</th>
                          {activeProject?.customColumns.map(c => <th key={c} className="p-8 text-indigo-400">{c}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-serif text-lg">
                        {activeProject?.entries.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())).map(e => (
                          <tr key={e.id} className="hover:bg-indigo-50/30 transition-colors group">
                            <td className="p-8 font-bold text-slate-800 cursor-pointer" onClick={() => setEditingEntry(e)}>{e.title}</td>
                            <td className="p-8">{e.author.name}</td>
                            <td className="p-8 text-indigo-600">{e.translator.name}</td>
                            <td className="p-8 text-slate-400">{e.publicationYear}</td>
                            {activeProject?.customColumns.map(c => <td key={c} className="p-8 text-slate-500 italic">{e.customMetadata?.[c] || '-'}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {activeProject?.entries.length === 0 && (
                      <div className="p-20 text-center space-y-4">
                         <div className="text-6xl">📭</div>
                         <p className="text-xl font-serif text-slate-400">尚无著录数据。请通过导入或新建开始研究。</p>
                      </div>
                    )}
                </div>
              </div>
           </div>
        )}
      </main>

      {showProjectOverlay && <ProjectHubOverlay />}
      {showManual && <UserManual onClose={() => setShowManual(false)} />}
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />

      {editingEntry && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[500] flex items-center justify-center p-8 animate-fadeIn">
              <div className="bg-white rounded-[4rem] shadow-2xl max-w-5xl w-full p-16 flex flex-col gap-10 overflow-hidden relative">
                  <div className="flex justify-between items-center">
                    <h3 className="text-3xl font-bold serif">{editingEntry.id === 'new' ? '新建著录记录 / New Record' : '编辑元数据 / Edit Metadata'}</h3>
                    <button onClick={() => setEditingEntry(null)} className="text-5xl font-light hover:text-rose-500 transition-all">&times;</button>
                  </div>
                  <div className="grid grid-cols-2 gap-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                      <div className="col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">作品书名 (Work Title)</label>
                          <input className="w-full p-6 bg-slate-50 rounded-[1.5rem] outline-none text-2xl serif border border-transparent focus:border-indigo-100 shadow-inner" value={editingEntry.title} onChange={e => setEditingEntry({...editingEntry, title: e.target.value})} />
                      </div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">著者 (Author)</label><input className="w-full p-5 bg-slate-50 rounded-[1.5rem] outline-none" value={editingEntry.author.name} onChange={e => setEditingEntry({...editingEntry, author: {...editingEntry.author, name: e.target.value}})} /></div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">译者 (Translator)</label><input className="w-full p-5 bg-slate-50 rounded-[1.5rem] outline-none text-indigo-600 font-bold" value={editingEntry.translator.name} onChange={e => setEditingEntry({...editingEntry, translator: {...editingEntry.translator, name: e.target.value}})} /></div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">年份</label><input type="number" className="w-full p-5 bg-slate-50 rounded-[1.5rem] outline-none" value={editingEntry.publicationYear} onChange={e => setEditingEntry({...editingEntry, publicationYear: parseInt(e.target.value)})} /></div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">出版社</label><input className="w-full p-5 bg-slate-50 rounded-[1.5rem] outline-none" value={editingEntry.publisher} onChange={e => setEditingEntry({...editingEntry, publisher: e.target.value})} /></div>
                  </div>
                  <div className="flex gap-6 pt-10 border-t border-slate-100">
                      <button onClick={() => setEditingEntry(null)} className="px-12 py-5 bg-slate-100 rounded-[1.5rem] text-[12px] font-bold text-slate-400 hover:bg-slate-200 transition-colors uppercase tracking-widest">取消 / Cancel</button>
                      <button onClick={handleSaveEntry} disabled={isSaving} className="flex-1 py-5 bg-slate-900 text-white rounded-[1.5rem] font-bold text-xl shadow-xl hover:bg-indigo-600 transition-all uppercase tracking-widest">确认存档 / Archive Record</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;
