
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

const STORAGE_KEY_PROJECTS = 'transdata_core_v17';
const STORAGE_KEY_ACTIVE_ID = 'transdata_active_id_v17';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (activeProjectId) localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeProjectId);
    else localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  }, [activeProjectId]);

  const handleReturnToWelcome = () => {
    setActiveProjectId(null);
    setHasStarted(false);
    setShowProjectOverlay(false);
  };

  const createNewProject = (name: string = "New Research Project") => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name,
      lastModified: Date.now(),
      entries: [],
      blueprint: null,
      customColumns: []
    };
    setProjects(prev => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setShowProjectOverlay(false);
    setHasStarted(true);
    setViewMode('blueprint');
    return newProj;
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
      setHasStarted(false);
      setShowProjectOverlay(false);
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

  const ProjectHub = () => (
    <div className="fixed inset-0 bg-white/98 backdrop-blur-3xl z-[600] flex flex-col p-8 md:p-16 animate-fadeIn overflow-auto text-slate-900">
      <div className="max-w-7xl w-full mx-auto space-y-12 h-full flex flex-col">
        <div className="flex justify-between items-end border-b border-slate-100 pb-10 flex-shrink-0">
          <div className="space-y-1">
             <h2 className="text-4xl font-bold serif leading-none">Project Hub</h2>
             <h2 className="text-2xl font-bold serif text-slate-400 italic">项目中心</h2>
             <p className="text-slate-400 font-serif text-sm mt-4">Manage your Translation Studies digital laboratories. / 管理您的翻译研究数字实验室。</p>
          </div>
          <button onClick={() => setShowProjectOverlay(false)} className="text-6xl font-light hover:text-rose-500 transition-colors leading-none">&times;</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 py-10 overflow-auto">
          {projects.map(p => (
            <div key={p.id} className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all relative h-[340px] flex flex-col justify-between overflow-hidden group">
              {deletingProjectId === p.id ? (
                <div className="absolute inset-0 bg-rose-500/95 backdrop-blur-md p-8 text-white z-50 flex flex-col justify-center items-center text-center space-y-5 animate-fadeIn">
                   <p className="text-lg font-bold serif leading-tight">确定永久删除？<br/><span className="text-[10px] font-normal opacity-70">记录将无法恢复。</span></p>
                   <div className="flex gap-3 w-full">
                      <button onClick={(e) => { e.stopPropagation(); setDeletingProjectId(null); }} className="flex-1 py-3 bg-white/20 rounded-xl font-bold text-[10px] uppercase">取消</button>
                      <button onClick={(e) => handleConfirmDeleteProject(p.id, e)} className="flex-1 py-3 bg-white text-rose-600 rounded-xl font-bold text-[10px] uppercase shadow-xl">确认删除</button>
                   </div>
                </div>
              ) : (
                <button 
                  onClick={(e) => { e.stopPropagation(); setDeletingProjectId(p.id); }} 
                  className="absolute top-6 right-6 text-slate-200 hover:text-rose-500 text-3xl font-light transition-colors z-20"
                >&times;</button>
              )}
              
              <div className="space-y-4">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl shadow-inner">📓</div>
                <div className="space-y-1">
                   <label className="text-[8px] font-black uppercase tracking-widest text-slate-300">Laboratory Name</label>
                   <input 
                      className="w-full text-lg font-bold serif bg-transparent border-none outline-none focus:bg-slate-50 p-1.5 rounded-lg transition-all" 
                      value={p.name} 
                      onChange={(e) => setProjects(prev => prev.map(x => x.id === p.id ? {...x, name: e.target.value} : x))}
                      onClick={e => e.stopPropagation()}
                   />
                </div>
              </div>
              <button onClick={() => { setActiveProjectId(p.id); setHasStarted(true); setShowProjectOverlay(false); setViewMode('list'); }} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg">进入实验室 / Enter Lab</button>
            </div>
          ))}
          <button onClick={() => createNewProject()} className="p-8 border-4 border-dashed border-slate-50 rounded-[2.5rem] text-slate-200 hover:text-indigo-400 hover:border-indigo-100 transition-all flex flex-col items-center justify-center gap-4 h-[340px] group flex-shrink-0">
            <span className="text-5xl group-hover:scale-110 transition-transform">+</span>
            <div className="text-center space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest block">New Research</span>
                <span className="text-[10px] font-black uppercase tracking-widest block opacity-50">新建研究课题</span>
            </div>
          </button>
        </div>
        <div className="flex-shrink-0 pt-10 border-t border-slate-50 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">@Lidia Zhou Mengyuan 2026</p>
        </div>
      </div>
    </div>
  );

  if (!hasStarted) {
    return (
      <div className="h-screen bg-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
        <GlobalFlowBackground />
        <div className="relative z-10 max-w-5xl w-full text-center animate-fadeIn space-y-12">
          <div className="w-20 h-20 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white font-serif font-bold text-4xl shadow-2xl mx-auto mb-8 transform -rotate-3">T</div>
          <div className="space-y-4">
            <h1 className="text-7xl md:text-8xl font-bold serif text-slate-900 tracking-tighter">TransData</h1>
            <div className="space-y-1">
                <p className="text-lg text-slate-600 font-serif italic leading-relaxed">翻译研究数字实验室：数据采集・分析・流通・可视化</p>
                <p className="text-xs text-slate-400 font-serif uppercase tracking-[0.2em] font-medium">Specialized Digital Laboratory for Translation Studies</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mt-16">
            <button onClick={() => createNewProject("AI 研究课题")} className="group bg-white p-8 rounded-[3rem] border border-slate-100 hover:border-indigo-400 hover:shadow-2xl transition-all text-left flex flex-col">
              <div className="text-4xl mb-8">📐</div>
              <div className="space-y-1 mb-6">
                <h3 className="text-2xl font-bold serif text-slate-800 leading-none">AI Architect</h3>
                <h3 className="text-sm font-bold serif text-slate-400 italic">AI 架构师</h3>
              </div>
              <div className="space-y-3 mt-auto">
                <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold tracking-widest opacity-80">Assist in defining research perspective and data schema.</p>
                <p className="text-[10px] text-slate-400 leading-relaxed font-bold tracking-widest opacity-60">辅助定义研究视角与数据架构。</p>
              </div>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="group bg-white p-8 rounded-[3rem] border border-slate-100 hover:border-emerald-400 hover:shadow-2xl transition-all text-left flex flex-col">
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={(e) => {}} />
              <div className="text-4xl mb-8">📊</div>
              <div className="space-y-1 mb-6">
                <h3 className="text-2xl font-bold serif text-slate-800 leading-none">Batch Import</h3>
                <h3 className="text-sm font-bold serif text-slate-400 italic">批量导入</h3>
              </div>
              <div className="space-y-3 mt-auto">
                <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold tracking-widest opacity-80">Rapidly import existing bibliographic Excel datasets.</p>
                <p className="text-[10px] text-slate-400 leading-relaxed font-bold tracking-widest opacity-60">快速导入已有书目 Excel 数据集。</p>
              </div>
            </button>
            <button onClick={loadSampleProject} className="group bg-white p-8 rounded-[3rem] border border-slate-100 hover:border-amber-400 hover:shadow-2xl transition-all text-left ring-1 ring-amber-100 ring-offset-4 flex flex-col">
              <div className="text-4xl mb-8">📖</div>
              <div className="space-y-1 mb-6">
                <h3 className="text-2xl font-bold serif text-slate-800 leading-none">Sample Lab</h3>
                <h3 className="text-sm font-bold serif text-slate-400 italic">样本实验室</h3>
              </div>
              <div className="space-y-3 mt-auto">
                <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold tracking-widest opacity-80">Load DGLAB catalog to experience dynamic analysis.</p>
                <p className="text-[10px] text-slate-400 leading-relaxed font-bold tracking-widest opacity-60">加载 DGLAB 资助名录体验动态分析。</p>
              </div>
            </button>
          </div>
          <div className="pt-12 flex flex-col items-center gap-10">
             <div className="flex gap-4">
                <button onClick={() => setShowProjectOverlay(true)} className="px-8 py-4 bg-slate-900 text-white rounded-[2rem] text-[10px] font-bold uppercase tracking-widest shadow-2xl flex items-center gap-3 hover:bg-slate-800 transition-all">📁 项目中心 / Project Hub ({projects.length})</button>
                <button onClick={() => setShowManual(true)} className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-[2rem] text-[10px] font-bold uppercase tracking-widest shadow-sm hover:border-indigo-400 transition-all">📘 用户手册 / Manual</button>
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">@Lidia Zhou Mengyuan 2026</p>
          </div>
        </div>
        {showProjectOverlay && <ProjectHub />}
        {showManual && <UserManual onClose={() => setShowManual(false)} />}
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#fcfcfd] flex flex-col font-sans overflow-hidden">
      <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-100 h-20 flex items-center shrink-0 px-10 sticky top-0 z-[200]">
        <div className="max-w-[1920px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
             <button onClick={handleReturnToWelcome} className="w-10 h-10 bg-slate-100 hover:bg-indigo-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all text-lg" title="回到欢迎页">🏠</button>
             <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProjectOverlay(true)}>
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold serif text-xl shadow-md">T</div>
                <div className="hidden lg:block">
                   <h1 className="text-base font-bold text-slate-800 serif leading-none">TransData</h1>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate max-w-[150px]">{activeProject?.name}</p>
                </div>
             </div>
          </div>
          <nav className="flex space-x-1.5 bg-slate-100/50 p-1 rounded-2xl">
            {[
              { id: 'list', label: 'Archive' },
              { id: 'network', label: 'Network Lab' },
              { id: 'stats', label: 'Analytics' },
              { id: 'map', label: 'Global Map' },
              { id: 'blueprint', label: 'Blueprint' }
            ].map((m) => (
              <button key={m.id} onClick={() => setViewMode(m.id as any)} className={`px-6 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === m.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
                {m.label}
              </button>
            ))}
            <button onClick={() => setShowManual(true)} className="px-6 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all text-indigo-600 hover:bg-indigo-50">
              Manual
            </button>
          </nav>
          <button onClick={() => setEditingEntry({ id: 'new', title: '', author: {name: '', gender: Gender.UNKNOWN}, translator: {name: '', gender: Gender.UNKNOWN}, publicationYear: 2024, publisher: '', sourceLanguage: '', targetLanguage: '', tags: [], customMetadata: {} })} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-600 shadow-lg transition-all">+ New Entry</button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col relative h-full">
        {viewMode === 'blueprint' ? (
           <div className="flex-1 overflow-y-auto p-12 bg-slate-50/30 flex flex-col items-center">
              {!activeProject?.blueprint ? (
                 <div className="max-w-3xl w-full bg-white p-12 rounded-[3rem] shadow-xl space-y-10 animate-slideUp">
                    <div className="text-center">
                       <h2 className="text-2xl font-bold serif mb-3">开启您的研究规划 / Research Architecture</h2>
                       <p className="text-slate-400 font-serif italic text-base leading-relaxed px-12">Input your topic; AI will curate a methodology-driven schema for your laboratory.</p>
                    </div>
                    <textarea 
                       className="w-full h-40 p-6 bg-slate-50 rounded-[1.5rem] outline-none text-base font-serif border border-transparent focus:border-indigo-100 shadow-inner" 
                       placeholder="例如：分析当代葡语文学在东亚的翻译路径与权力动态..." 
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
                          } catch (e) { alert("AI 功能调用失败。"); }
                          setIsArchitecting(false);
                       }} 
                       className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-bold text-base shadow-xl hover:bg-indigo-600 transition-all uppercase tracking-widest"
                    >生成研究蓝图 / Generate Blueprint</button>
                 </div>
              ) : (
                 <div className="max-w-5xl w-full bg-white p-12 rounded-[4rem] shadow-xl space-y-10 animate-fadeIn">
                    <div className="border-b border-slate-100 pb-6">
                       <h2 className="text-3xl font-bold serif leading-tight text-slate-800">{activeProject.blueprint.projectScope}</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div className="space-y-8">
                          <section>
                             <h4 className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-3">01 分析方法论 / Methodology</h4>
                             <p className="text-base text-slate-700 font-serif italic leading-relaxed">{activeProject.blueprint.methodology}</p>
                          </section>
                          <section className="bg-slate-900 p-8 rounded-[2rem] text-white">
                             <h4 className="text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-3">02 可视化策略 / Visualization</h4>
                             <p className="text-lg font-serif italic leading-relaxed">{activeProject.blueprint.visualizationStrategy}</p>
                          </section>
                       </div>
                    </div>
                    <div className="pt-8 flex gap-4">
                       <button onClick={() => updateActiveProject({ blueprint: null })} className="px-8 py-4 bg-slate-100 text-slate-400 rounded-full font-bold text-[9px] uppercase tracking-widest">重新策划 / Redesign</button>
                       <button onClick={handleApplyBlueprint} className="flex-1 py-4 bg-indigo-600 text-white rounded-full font-bold text-base shadow-lg hover:bg-indigo-700 transition-all uppercase tracking-widest">同步架构 / Apply Schema</button>
                    </div>
                 </div>
              )}
           </div>
        ) : viewMode === 'network' ? (
           <NetworkGraph data={activeProject?.entries || []} customColumns={activeProject?.customColumns || []} blueprint={activeProject?.blueprint || null} onDataUpdate={(newEntries) => updateActiveProject({ entries: newEntries })} />
        ) : viewMode === 'stats' ? (
           <div className="flex-1 overflow-y-auto">
              <StatsDashboard data={activeProject?.entries || []} insights={statsInsights} onGenerateInsights={async () => { setIsAnalyzing(true); setStatsInsights(await generateInsights(activeProject?.entries || [])); setIsAnalyzing(false); }} isAnalyzing={isAnalyzing} customColumns={activeProject?.customColumns || []} />
           </div>
        ) : viewMode === 'map' ? (
           <WorldMap data={activeProject?.entries || []} />
        ) : (
           <div className="p-10 flex-1 overflow-auto animate-fadeIn">
              <div className="max-w-[1920px] mx-auto w-full space-y-6">
                <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-[8px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                        <tr>
                          <th className="p-6">书目信息 (Work Data)</th>
                          <th className="p-6">著者 (Author)</th>
                          <th className="p-6">译者 (Translator)</th>
                          <th className="p-6">年份</th>
                          {activeProject?.customColumns.map(c => <th key={c} className="p-6 text-indigo-500">{c}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-serif text-base">
                        {activeProject?.entries.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())).map(e => (
                          <tr key={e.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="p-6 font-bold text-slate-800 cursor-pointer" onClick={() => setEditingEntry(e)}>{e.title}</td>
                            <td className="p-6">{e.author.name}</td>
                            <td className="p-6 text-indigo-600">{e.translator.name}</td>
                            <td className="p-6 text-slate-400">{e.publicationYear}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
              </div>
           </div>
        )}
      </main>

      {showProjectOverlay && <ProjectHub />}
      {showManual && <UserManual onClose={() => setShowManual(false)} />}

      {editingEntry && (
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xl z-[500] flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white rounded-[3rem] shadow-2xl max-w-4xl w-full p-12 flex flex-col gap-8 overflow-hidden">
                  <h3 className="text-2xl font-bold serif">{editingEntry.id === 'new' ? '新建著录记录 / New Record' : '编辑元数据 / Edit Metadata'}</h3>
                  <div className="grid grid-cols-2 gap-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                      <div className="col-span-2">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">作品书名 (Work Title)</label>
                          <input className="w-full p-5 bg-slate-50 rounded-xl outline-none text-xl serif border border-transparent focus:border-indigo-100 shadow-inner" value={editingEntry.title} onChange={e => setEditingEntry({...editingEntry, title: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">著者 (Author)</label>
                          <input className="w-full p-4 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-indigo-50" value={editingEntry.author.name} onChange={e => setEditingEntry({...editingEntry, author: {...editingEntry.author, name: e.target.value}})} />
                      </div>
                      <div>
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">译者 (Translator)</label>
                          <input className="w-full p-4 bg-slate-50 rounded-xl outline-none text-indigo-600 font-bold border border-transparent focus:border-indigo-50" value={editingEntry.translator.name} onChange={e => setEditingEntry({...editingEntry, translator: {...editingEntry.translator, name: e.target.value}})} />
                      </div>
                  </div>
                  <div className="flex gap-4 pt-6 border-t border-slate-100">
                      <button onClick={() => setEditingEntry(null)} className="px-10 py-4 bg-slate-100 rounded-2xl text-[10px] font-bold text-slate-400 hover:bg-slate-200 transition-colors uppercase tracking-widest">取消 / Cancel</button>
                      <button onClick={handleSaveEntry} disabled={isSaving} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold text-base shadow-xl hover:bg-indigo-600 transition-all uppercase tracking-widest">确认存档 / Archive</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;
