
import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BibEntry, ViewMode, Gender, Project, ResearchBlueprint } from './types';
import NetworkGraph from './components/NetworkGraph';
import StatsDashboard from './components/StatsDashboard';
import WorldMap from './components/WorldMap';
import GlobalFlowBackground from './components/GlobalFlowBackground';
import UserManual from './components/UserManual';
import { generateResearchBlueprint, generateInsights } from './services/geminiService';
import { SAMPLE_ENTRIES } from './constants';

const STORAGE_KEY_PROJECTS = 'transdata_core_v21';
const STORAGE_KEY_ACTIVE_ID = 'transdata_active_id_v21';

// Enhanced Service Status with API Key Selection logic
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
                    {hasAPI ? 'AI Engine Active' : 'Expert Mode'}
                </span>
            </div>
            <button 
                onClick={handleSelectKey}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl transition-all flex items-center gap-1.5 border border-indigo-400/30"
            >
                <span>🔑</span>
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
           <h2 className="text-7xl font-bold serif leading-none tracking-tight">Project Hub</h2>
           <h2 className="text-3xl font-bold serif text-slate-400 italic">项目中心 / Research Management</h2>
        </div>
        <button onClick={onClose} className="text-7xl font-light hover:text-indigo-600 transition-transform hover:scale-110 leading-none">&times;</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        {projects.map(p => (
          <div key={p.id} className="p-12 bg-white border border-slate-100 rounded-[3.5rem] shadow-sm hover:shadow-2xl transition-all relative flex flex-col justify-between h-[450px] group ring-1 ring-slate-100 hover:ring-indigo-100">
            <div className="space-y-8">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-4xl shadow-sm">📓</div>
              <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Project Title</p>
                  <input 
                    className="w-full text-2xl font-bold serif bg-transparent border-none outline-none focus:ring-4 ring-indigo-50 p-3 rounded-2xl" 
                    value={p.name} 
                    onChange={(e) => setProjects(prev => prev.map(x => x.id === p.id ? {...x, name: e.target.value} : x))}
                  />
              </div>
              <p className="text-sm text-slate-400 font-mono pl-3">Modified: {new Date(p.lastModified).toLocaleDateString()}</p>
            </div>
            <div className="flex flex-col gap-4">
               <button onClick={() => onEnter(p.id)} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-bold text-sm uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl">Enter Lab</button>
               <button onClick={() => setProjects(prev => prev.filter(x => x.id !== p.id))} className="text-xs font-bold text-rose-400 uppercase tracking-widest hover:text-rose-600 py-2">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const TheoryLabInterface = ({ 
  input, 
  setInput, 
  onAnalyze, 
  result, 
  isAnalyzing, 
  onClose 
}: { 
  input: string, 
  setInput: (v: string) => void, 
  onAnalyze: () => void, 
  result: ResearchBlueprint | null, 
  isAnalyzing: boolean, 
  onClose: () => void 
}) => (
  <div className="fixed inset-0 bg-white z-[750] flex flex-col p-12 md:p-24 overflow-auto animate-fadeIn select-text">
      <div className="max-w-[1600px] w-full mx-auto space-y-16">
          <div className="flex justify-between items-start border-b border-slate-100 pb-12">
              <div className="space-y-4">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg">🔭</div>
                      <h1 className="text-6xl font-bold serif text-slate-900 tracking-tight">Theory Lab</h1>
                  </div>
                  <p className="text-xl text-slate-500 font-serif italic">Translation as Data: The Five-Dimensional Framework Mapping</p>
              </div>
              <div className="flex items-center gap-8">
                  <div className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border ${!!process.env.API_KEY ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                      {!!process.env.API_KEY ? '● AI Dynamic Analysis' : '● Expert Template Mode'}
                  </div>
                  <button onClick={onClose} className="text-7xl font-light hover:text-indigo-600 transition-transform hover:scale-110 leading-none">&times;</button>
              </div>
          </div>
          
          <div className="bg-slate-50 p-12 rounded-[3.5rem] border border-slate-100 space-y-8 shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100/30 blur-3xl -mr-32 -mt-32"></div>
              <h3 className="text-2xl font-bold serif text-slate-800 relative z-10">Research Inquiry / 研究课题咨询</h3>
              <textarea 
                className="w-full h-32 p-8 bg-white rounded-3xl border border-slate-200 outline-none text-xl font-serif shadow-sm focus:ring-4 ring-indigo-50 transition-all relative z-10" 
                placeholder="Describe your research topic, e.g., 'Modernist poetry translation in 1930s Shanghai'..."
                value={input}
                onChange={e => setInput(e.target.value)}
              />
              <div className="flex items-center justify-between relative z-10">
                  <p className="text-xs text-slate-400 font-serif italic max-w-xl">
                      Based on "Translation as Data" framework, the platform will map your query to specific data requirements and analytical methodologies across 5 dimensions. {!process.env.API_KEY && "(Expert Template Mode Active)"}
                  </p>
                  <button 
                    onClick={onAnalyze}
                    disabled={isAnalyzing || !input.trim()}
                    className="px-12 py-6 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all disabled:opacity-50 shadow-2xl"
                  >
                      {isAnalyzing ? "Processing Framework..." : "Get Matrix Analysis →"}
                  </button>
              </div>
          </div>

          {result && (
              <div className="space-y-10 animate-fadeIn pb-32">
                  <div className="flex items-center gap-6">
                      <h2 className="text-3xl font-bold serif text-slate-900">The Framework Matrix</h2>
                      <div className="h-px flex-1 bg-slate-200"></div>
                  </div>

                  <div className="space-y-6">
                      {result.dimensions.map((dim, idx) => (
                          <div key={idx} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row group hover:shadow-xl transition-all hover:border-indigo-100 ring-1 ring-slate-100">
                              <div className="md:w-72 bg-slate-50 p-10 flex flex-col justify-center items-center text-center border-r border-slate-100 shrink-0 group-hover:bg-indigo-50/30 transition-colors">
                                  <div className="text-5xl mb-6">{idx === 0 ? '👤' : idx === 1 ? '📜' : idx === 2 ? '📍' : idx === 3 ? '💬' : '🗣️'}</div>
                                  <h4 className="text-xl font-bold serif text-slate-900 leading-tight mb-2">{dim.dimension}</h4>
                                  <div className="px-4 py-1.5 bg-white rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400 shadow-sm border border-slate-100">Dimension 0{idx+1}</div>
                              </div>
                              <div className="flex-1 p-10 grid grid-cols-1 lg:grid-cols-3 gap-12 text-slate-900">
                                  <div className="space-y-4">
                                      <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">Ontological Inquiry</h5>
                                      <p className="text-lg font-serif italic text-slate-700 leading-relaxed border-l-2 border-indigo-100 pl-6">{dim.coreQuestion}</p>
                                  </div>
                                  <div className="space-y-4">
                                      <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Target Data Sources</h5>
                                      <div className="flex flex-wrap gap-2">
                                          {dim.dataSources.map(ds => (
                                              <span key={ds} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 border border-slate-200/50">{ds}</span>
                                          ))}
                                      </div>
                                  </div>
                                  <div className="space-y-4">
                                      <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Analytical Methods</h5>
                                      <div className="flex flex-wrap gap-2">
                                          {dim.dhMethods.map(m => (
                                              <span key={m} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-md">{m}</span>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                              <div className="w-2 flex-shrink-0 bg-slate-100 relative">
                                  <div 
                                      className="absolute bottom-0 w-full bg-indigo-500 transition-all duration-1000"
                                      style={{ height: `${dim.relevance}%` }}
                                  ></div>
                              </div>
                          </div>
                      ))}
                  </div>

                  {/* Summary Area */}
                  <div className="bg-white p-16 rounded-[4rem] text-slate-900 border border-slate-200 space-y-8 shadow-2xl relative overflow-hidden ring-1 ring-slate-100">
                      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-100/20 blur-[120px] -mr-32 -mt-32"></div>
                      <div className="flex items-center gap-6 relative z-10">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-500">Methodological Synthesis</h4>
                          <div className="h-px flex-1 bg-slate-100"></div>
                      </div>
                      <p className="text-3xl font-serif italic leading-relaxed text-slate-800 relative z-10">
                          "{result.methodology}"
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10 relative z-10">
                          <div className="space-y-4 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 group hover:border-indigo-200 transition-all">
                              <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visualization Strategy</h6>
                              <p className="text-sm text-slate-600 leading-relaxed font-serif">{result.visualizationStrategy}</p>
                          </div>
                          <div className="space-y-4 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 group hover:border-indigo-200 transition-all">
                              <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Collection Protocol</h6>
                              <p className="text-sm text-slate-600 leading-relaxed font-serif">{result.collectionTips}</p>
                          </div>
                      </div>
                  </div>
              </div>
          )}
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
  const [showManual, setShowManual] = useState(false);
  const [showTheoryLab, setShowTheoryLab] = useState(false);
  
  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);

  const [hasStarted, setHasStarted] = useState(() => !!activeProjectId);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [isTheoryAnalyzing, setIsTheoryAnalyzing] = useState(false);
  const [projectInput, setProjectInput] = useState('');
  const [theoryInput, setTheoryInput] = useState('');
  const [theoryResult, setTheoryResult] = useState<ResearchBlueprint | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statsInsights, setStatsInsights] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
    setShowTheoryLab(false);
  };

  const handleArchitecting = async () => {
    if (!projectInput.trim()) return;
    setIsArchitecting(true);
    try {
      const bp = await generateResearchBlueprint(projectInput);
      const newId = `proj-${Date.now()}`;
      const newProj: Project = {
          id: newId,
          name: bp.projectScope,
          lastModified: Date.now(),
          entries: [],
          blueprint: bp,
          customColumns: bp.suggestedSchema.map(s => s.fieldName)
      };
      setProjects(prev => [newProj, ...prev]);
      setActiveProjectId(newId);
      setHasStarted(true);
      setViewMode('blueprint');
    } catch (e: any) {
      alert("AI Architect Failed. Using fallback template.");
    } finally {
      setIsArchitecting(false);
    }
  };

  const handleTheoryAnalyze = async () => {
      if (!theoryInput.trim()) return;
      setIsTheoryAnalyzing(true);
      try {
          const bp = await generateResearchBlueprint(theoryInput);
          setTheoryResult(bp);
      } catch (e) {
          alert("Theory analysis failed. Using expert template.");
      } finally {
          setIsTheoryAnalyzing(false);
      }
  };

  const createNewProject = (name: string = "New Research", initialEntries: BibEntry[] = []) => {
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
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];
        const parsedEntries: BibEntry[] = rawData.map((row, idx) => ({
          id: `imp-${Date.now()}-${idx}`,
          title: String(row.Title || row.title || row['书名'] || 'Untitled'),
          publicationYear: parseInt(row.Year || row.year || row['年份']) || 2024,
          author: { name: String(row.Author || row.author || row['著者'] || 'Unknown'), gender: Gender.UNKNOWN },
          translator: { name: String(row.Translator || row.translator || row['译者'] || 'Unknown'), gender: Gender.UNKNOWN },
          publisher: String(row.Publisher || row.publisher || row['出版社'] || 'N/A'),
          city: row.City || row.city || row['城市'],
          provinceState: row.Province || row.province || row['省份/州'],
          sourceLanguage: row.SourceLanguage || row.sourceLanguage || 'N/A',
          targetLanguage: row.TargetLanguage || row.targetLanguage || 'N/A',
          tags: row.Tags ? String(row.Tags).split(',') : [],
          customMetadata: {}
        }));
        createNewProject(`Import: ${file.name}`, parsedEntries);
      } catch (err) { alert("Import Failed."); } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  if (!hasStarted) {
    return (
      <div className="h-screen bg-white flex flex-col items-center justify-center p-8 relative overflow-hidden select-none text-slate-900">
        <GlobalFlowBackground />
        
        {/* Top Status Bar with API selection */}
        <div className="absolute top-10 right-10 z-50">
            <ServiceStatus />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center mb-16 animate-fadeIn">
            <div className="w-20 h-20 bg-slate-900 rounded-[2.2rem] flex items-center justify-center text-white font-bold serif text-5xl shadow-2xl mb-10">T</div>
            <h1 className="text-[80px] md:text-[100px] font-bold serif text-slate-900 tracking-tighter leading-none mb-6">Translation as Data</h1>
            <p className="text-xl text-slate-600 font-serif italic mb-2">翻译研究数字实验室：数据采集 · 分析 · 流通 · 可视化</p>
            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.5em]">Specialized Digital Laboratory for Translation Studies</p>
        </div>

        {/* Primary Functional Grid (3 columns) */}
        <div className="relative z-10 w-full max-w-[1200px] grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col items-center text-center">
                <div className="text-4xl mb-8 opacity-60 group-hover:opacity-100 transition-opacity">📐</div>
                <h3 className="text-2xl font-bold serif text-slate-800 mb-2">AI Architect</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-6">AI 架构师</p>
                <p className="text-[11px] text-slate-400 leading-relaxed font-serif italic mb-8 h-10">Assist in defining research perspective and data schema.</p>
                <textarea 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none text-xs font-serif mb-4 h-24 resize-none focus:ring-2 ring-indigo-50"
                    placeholder="Input research topic..."
                    value={projectInput}
                    onChange={e => setProjectInput(e.target.value)}
                />
                <button 
                    onClick={handleArchitecting}
                    disabled={isArchitecting || !projectInput.trim()}
                    className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 hover:text-slate-900 transition-colors"
                >
                    {isArchitecting ? "Wait..." : "Generate →"}
                </button>
            </div>

            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col items-center text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="text-4xl mb-8 opacity-60 group-hover:opacity-100 transition-opacity">📊</div>
                <h3 className="text-2xl font-bold serif text-slate-800 mb-2">Batch Import</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-6">批量导入</p>
                <p className="text-[11px] text-slate-400 leading-relaxed font-serif italic mb-8 h-10">Rapidly import existing bibliographic Excel datasets.</p>
                <div className="mt-auto text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">Select File →</div>
            </div>

            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col items-center text-center cursor-pointer" onClick={() => setShowTheoryLab(true)}>
                <div className="text-4xl mb-8 opacity-60 group-hover:opacity-100 transition-opacity">🔭</div>
                <h3 className="text-2xl font-bold serif text-slate-800 mb-2">Theory Lab</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-6">理论实验室</p>
                <p className="text-[11px] text-slate-400 leading-relaxed font-serif italic mb-8 h-10">Translation as Data Framework: Mapping collection to methods.</p>
                <div className="mt-auto text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">Open Lab →</div>
            </div>
        </div>

        {/* Distinct Sample Lab Call-to-Action below the main grid */}
        <div className="relative z-10 w-full max-w-[1200px] mb-12">
            <button 
                onClick={() => createNewProject("Sample Lab: World Lit", SAMPLE_ENTRIES)}
                className="w-full py-8 bg-slate-50/50 border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all flex items-center justify-center gap-6 group hover:bg-indigo-50/30"
            >
                <span className="text-3xl group-hover:rotate-12 transition-transform">📖</span>
                <div className="text-left">
                    <h3 className="text-lg font-bold serif text-slate-800">Sample Lab / 样本实验室</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Experience the dynamic lab with DGLAB pre-loaded catalog</p>
                </div>
                <div className="ml-8 px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                    Explore Now →
                </div>
            </button>
        </div>

        {/* Global Navigation Section */}
        <div className="relative z-10 flex gap-8 mb-16">
            <button onClick={() => setShowProjectOverlay(true)} className="flex items-center gap-4 px-12 py-6 bg-slate-900 text-white rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-2xl group">
                <span className="text-lg group-hover:scale-125 transition-transform">📓</span> 项目中心 / Project Hub ({projects.length})
            </button>
            <button onClick={() => setShowManual(true)} className="flex items-center gap-4 px-12 py-6 bg-white border border-slate-200 text-slate-500 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm group">
                <span className="text-lg group-hover:scale-125 transition-transform">📘</span> 用户手册 / Manual
            </button>
        </div>

        {/* Creator's Signature */}
        <div className="relative z-10 flex flex-col items-center">
            <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-300 opacity-60">@Lidia Zhou Mengyuan 2026</p>
        </div>

        {showProjectOverlay && (
          <ProjectHubOverlay 
            projects={projects} 
            setProjects={setProjects} 
            onEnter={(id) => { setActiveProjectId(id); setShowProjectOverlay(false); }} 
            onClose={() => setShowProjectOverlay(false)} 
          />
        )}
        {showManual && <UserManual onClose={() => setShowManual(false)} />}
        {showTheoryLab && (
          <TheoryLabInterface 
            input={theoryInput} 
            setInput={setTheoryInput} 
            onAnalyze={handleTheoryAnalyze} 
            result={theoryResult} 
            isAnalyzing={isTheoryAnalyzing} 
            onClose={() => setShowTheoryLab(false)} 
          />
        )}
        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#fcfcfd] flex flex-col overflow-hidden text-slate-900">
      <header className="bg-white border-b border-slate-100 h-28 flex items-center shrink-0 px-12 z-[200]">
        <div className="max-w-[1920px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
             <button onClick={handleReturnToWelcome} className="w-12 h-12 bg-slate-100 hover:bg-indigo-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all text-xl" title="Go Home">🏠</button>
             <button onClick={() => setShowProjectOverlay(true)} className="w-12 h-12 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all text-xl" title="Project Switcher">📓</button>
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold serif text-2xl shadow-lg">T</div>
                <div className="space-y-0.5">
                   <h1 className="text-lg font-bold text-slate-800 serif leading-none">Translation as Data</h1>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[200px]">{activeProject?.name}</p>
                </div>
             </div>
          </div>
          <nav className="flex space-x-1 bg-slate-100/80 p-1.5 rounded-2xl">
            {[
              { id: 'list', label: 'Archive / 著录' },
              { id: 'network', label: 'Network / 网络' },
              { id: 'stats', label: 'Stats / 统计' },
              { id: 'map', label: 'GIS Lab / 空间实验室' },
              { id: 'blueprint', label: 'Blueprint / 蓝图' }
            ].map((m) => (
              <button key={m.id} onClick={() => setViewMode(m.id as any)} className={`px-8 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === m.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                {m.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-6">
             <div className="hidden md:block">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${!!process.env.API_KEY ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                   <div className="w-1 h-1 rounded-full bg-current"></div>
                   <span className="text-[8px] font-black uppercase tracking-[0.2em]">{!!process.env.API_KEY ? 'AI Active' : 'Expert Mode'}</span>
                </div>
             </div>
             <div className="flex gap-3">
                <button onClick={() => fileInputRef.current?.click()} className="bg-slate-50 text-slate-500 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">Import</button>
                <button onClick={() => createNewProject()} className="bg-slate-900 text-white px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg">+ New Lab</button>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {viewMode === 'list' && (
           <div className="p-12 h-full overflow-auto animate-fadeIn bg-slate-50/20">
              <div className="max-w-[1920px] mx-auto w-full space-y-10">
                <div className="flex justify-between items-center">
                    <h2 className="text-4xl font-bold serif text-slate-900">Bibliographic Archive</h2>
                    <input className="w-80 p-4 bg-white rounded-xl border border-slate-200 text-sm focus:ring-4 ring-indigo-50 outline-none shadow-sm" placeholder="Search archive..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden ring-1 ring-slate-100">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                        <tr>
                          <th className="p-10">Work Title</th>
                          <th className="p-10">Author</th>
                          <th className="p-10">Translator</th>
                          <th className="p-10">Location (City/Province)</th>
                          <th className="p-10">GIS</th>
                          <th className="p-10">Year</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-serif text-lg">
                        {activeProject?.entries.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())).map(e => (
                          <tr key={e.id} className="hover:bg-indigo-50/30 transition-colors cursor-pointer">
                            <td className="p-10 font-bold text-slate-800">{e.title}</td>
                            <td className="p-10 text-slate-600">{e.author.name}</td>
                            <td className="p-10 text-indigo-600 font-semibold">{e.translator.name}</td>
                            <td className="p-10 text-slate-500 italic">
                                {e.city}{e.provinceState ? `, ${e.provinceState}` : ''}
                            </td>
                            <td className="p-10">
                                {e.customMetadata?.targetCoord ? (
                                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase">Mapped</span>
                                ) : (
                                    <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black uppercase">Pending</span>
                                )}
                            </td>
                            <td className="p-10 text-slate-400 font-mono">{e.publicationYear}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
              </div>
           </div>
        )}
        {viewMode === 'network' && (
           <NetworkGraph data={activeProject?.entries || []} customColumns={activeProject?.customColumns || []} blueprint={activeProject?.blueprint || null} onDataUpdate={() => {}} />
        )}
        {viewMode === 'stats' && (
           <StatsDashboard data={activeProject?.entries || []} insights={statsInsights} onGenerateInsights={async () => { setIsAnalyzing(true); setStatsInsights(await generateInsights(activeProject?.entries || [])); setIsAnalyzing(false); }} isAnalyzing={isAnalyzing} customColumns={activeProject?.customColumns || []} />
        )}
        {viewMode === 'map' && (
           <WorldMap data={activeProject?.entries || []} />
        )}
        {viewMode === 'blueprint' && (
           <div className="h-full overflow-y-auto bg-slate-50/30 p-20 flex flex-col items-center">
              {activeProject?.blueprint && (
                 <div className="max-w-[1920px] w-full bg-white p-24 rounded-[4rem] shadow-2xl space-y-20 animate-fadeIn ring-1 ring-slate-100">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-16">
                       <div className="space-y-5 text-slate-900">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500">Research Framework Blueprint</h4>
                          <h2 className="text-6xl font-bold serif leading-tight tracking-tight">{activeProject.blueprint.projectScope}</h2>
                       </div>
                    </div>

                    <div className="space-y-12">
                        <div className="flex items-center gap-4">
                            <h3 className="text-2xl font-bold serif text-slate-900 uppercase tracking-widest">Translation as Data Matrix</h3>
                            <div className="h-px flex-1 bg-slate-100"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                            {activeProject.blueprint.dimensions.map((dim, idx) => (
                                <div key={idx} className={`p-10 rounded-[2.5rem] border transition-all flex flex-col justify-between ${dim.relevance > 70 ? 'bg-indigo-50/20 border-indigo-100 shadow-lg' : 'bg-slate-50/50 border-slate-100'}`}>
                                    <div className="space-y-6">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-slate-100">
                                            {idx === 0 ? '👤' : idx === 1 ? '📜' : idx === 2 ? '📍' : idx === 3 ? '💬' : '🗣️'}
                                        </div>
                                        <div className="space-y-3">
                                            <h4 className="text-lg font-bold serif text-slate-900 leading-none">{dim.dimension}</h4>
                                            <p className="text-xs text-slate-500 font-serif italic leading-relaxed">{dim.coreQuestion}</p>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Data Sources</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {dim.dataSources.map(ds => <span key={ds} className="text-[10px] bg-white px-2 py-1 rounded-lg border border-slate-100 text-slate-600">{ds}</span>)}
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">DH Methods</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {dim.dhMethods.map(m => <span key={m} className="text-[10px] bg-slate-900 text-white px-2 py-1 rounded-lg font-bold">{m}</span>)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-16 border-t border-slate-50">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-8">Methodology Synthesis</h4>
                       <p className="text-2xl text-slate-600 font-serif italic leading-relaxed pl-12 border-l-4 border-indigo-500">{activeProject.blueprint.methodology}</p>
                    </div>
                 </div>
              )}
           </div>
        )}
      </main>

      {showProjectOverlay && (
        <ProjectHubOverlay 
          projects={projects} 
          setProjects={setProjects} 
          onEnter={(id) => { setActiveProjectId(id); setShowProjectOverlay(false); }} 
          onClose={() => setShowProjectOverlay(false)} 
        />
      )}
      {showManual && <UserManual onClose={() => setShowManual(false)} />}
      {showTheoryLab && (
        <TheoryLabInterface 
          input={theoryInput} 
          setInput={setTheoryInput} 
          onAnalyze={handleTheoryAnalyze} 
          result={theoryResult} 
          isAnalyzing={isTheoryAnalyzing} 
          onClose={() => setShowTheoryLab(false)} 
        />
      )}
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
    </div>
  );
}

export default App;
