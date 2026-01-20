
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

/** 
 * ROBUST OFFLINE GIS RESOLVER 
 * Searches for matches in the LOCAL_COORDS dictionary using fuzzy text matching.
 */
const resolveOfflineCoords = (name: string): [number, number] | null => {
    if (!name) return null;
    const clean = name.trim().toLowerCase();
    
    // Check direct match
    if (LOCAL_COORDS[clean]) return LOCAL_COORDS[clean];
    
    // Check partial match (e.g. "Gansu Province" -> "Gansu")
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
           <h2 className="text-7xl font-bold serif leading-none tracking-tight text-slate-900">Project Hub</h2>
           <h2 className="text-3xl font-bold serif text-slate-400 italic">Research Archive Management</h2>
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
               <button onClick={() => onEnter(p.id)} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-bold text-sm uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl">Enter Lab</button>
               <button onClick={() => setProjects(prev => prev.filter(x => x.id !== p.id))} className="text-xs font-bold text-rose-400 uppercase tracking-widest hover:text-rose-600 py-2">Delete</button>
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
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [processingIdx, setProcessingIdx] = useState<number | null>(null);
  const [statsInsights, setStatsInsights] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);

  useEffect(() => localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects)), [projects]);
  useEffect(() => {
    if (activeProjectId) localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeProjectId);
    else localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  }, [activeProjectId]);

  const createNewProject = (name: string, entries: BibEntry[] = [], blueprint?: ResearchBlueprint) => {
    // Attempt instant offline geocoding for all entries in the new project
    const entriesWithGIS = entries.map(e => {
        if (e.customMetadata?.targetCoord) return e;
        const coords = resolveOfflineCoords(e.city || '') || resolveOfflineCoords(e.provinceState || '');
        if (coords) {
            return { ...e, customMetadata: { ...e.customMetadata, targetCoord: coords } };
        }
        return e;
    });

    const newProj: Project = { 
        id: `proj-${Date.now()}`, 
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

  const handleArchitectBuild = async (overridePrompt?: string) => {
    const finalPrompt = overridePrompt || projectInput;
    if (!finalPrompt.trim()) return;
    setIsArchitecting(true);
    try {
        const bp = await generateResearchBlueprint(finalPrompt);
        createNewProject(bp.projectScope, [], bp);
        setViewMode('blueprint');
        setShowTheoryLab(false);
    } catch (e) { alert("AI Architect failed."); }
    finally { setIsArchitecting(false); }
  };

  const handleApplyBlueprint = (bp: ResearchBlueprint) => {
    createNewProject(bp.projectScope, [], bp);
    setViewMode('blueprint');
    setShowTheoryLab(false);
  };

  const handleGenerateBlueprintInLab = () => {
    if (activeProject) {
      handleArchitectBuild(activeProject.name);
    }
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
            
            // Try offline resolver first (Checking city then province)
            let coords = resolveOfflineCoords(entry.city || '') || resolveOfflineCoords(entry.provinceState || '');
            
            // Fallback to Gemini API if online
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
          
          // Multi-step offline GIS resolution on import
          const offlineCoords = resolveOfflineCoords(city) || resolveOfflineCoords(province);

          return {
            id: `imp-${Date.now()}-${idx}`,
            title: String(row.Title || row.title || row['书名'] || 'Untitled'),
            publicationYear: parseInt(row.Year || row.year || row['年份']) || 2024,
            author: { name: String(row.Author || row.author || row['著者'] || 'Unknown'), gender: Gender.UNKNOWN },
            translator: { name: String(row.Translator || row.translator || row['译者'] || 'Unknown'), gender: Gender.UNKNOWN },
            publisher: String(row.Publisher || row.publisher || row['出版社'] || 'N/A'),
            city: city,
            provinceState: province,
            sourceLanguage: row.SourceLanguage || row.sourceLanguage || 'N/A',
            targetLanguage: row.TargetLanguage || row.targetLanguage || 'N/A',
            customMetadata: offlineCoords ? { targetCoord: offlineCoords } : {}
          };
        });
        
        createNewProject(`Import: ${file.name}`, parsed);
      } catch (err) { alert("Import Failed."); }
    };
    reader.readAsBinaryString(file);
  };

  if (!activeProjectId) {
    return (
      <div className="h-screen bg-white flex flex-col items-center justify-center p-8 relative overflow-hidden select-none text-slate-900">
        <GlobalFlowBackground />
        <div className="absolute top-10 right-10 z-[100]"><ServiceStatus /></div>
        <div className="relative z-10 flex flex-col items-center text-center max-w-6xl animate-fadeIn w-full">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-bold serif text-4xl shadow-2xl mb-8">T</div>
            <h1 className="text-[64px] md:text-[80px] font-bold serif text-slate-900 tracking-tighter leading-none mb-4">Translation as Data</h1>
            <p className="text-[11px] font-bold tracking-[0.4em] uppercase text-indigo-500 mb-2">Computational Research Lab: Data · Analysis · Circulation</p>
            <p className="text-[9px] text-slate-400 font-serif tracking-[0.3em] mb-16 uppercase italic">Specialized Digital Laboratory for Translation Studies</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mb-12 px-10">
                <div className="bg-white/70 backdrop-blur-xl p-12 rounded-[3rem] border border-white shadow-xl flex flex-col items-center space-y-6 hover:shadow-2xl transition-all ring-1 ring-slate-100">
                    <div className="text-4xl">🤖</div>
                    <h3 className="text-xl font-bold serif">AI Architect</h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-serif italic h-10">Assistance in defining project schemas and theoretical perspectives.</p>
                    <textarea value={projectInput} onChange={e => setProjectInput(e.target.value)} placeholder="Input research topic..." className="w-full h-32 bg-white border border-slate-100 rounded-[2rem] p-6 text-xs outline-none focus:ring-2 ring-indigo-50 resize-none shadow-inner" />
                    <button onClick={() => handleArchitectBuild()} disabled={isArchitecting || !projectInput.trim()} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg active:scale-95">{isArchitecting ? 'Generating...' : 'Generate →'}</button>
                </div>
                <div className="bg-white/70 backdrop-blur-xl p-12 rounded-[3rem] border border-white shadow-xl flex flex-col items-center space-y-6 hover:shadow-2xl transition-all ring-1 ring-slate-100">
                    <div className="text-4xl">📁</div>
                    <h3 className="text-xl font-bold serif">Batch Import</h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-serif italic h-10">Import bibliographic Excel datasets with instant GIS geocoding.</p>
                    <div className="flex-1"></div>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 border border-slate-200 text-slate-600 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Select File →</button>
                </div>
                <div className="bg-white/70 backdrop-blur-xl p-12 rounded-[3rem] border border-white shadow-xl flex flex-col items-center space-y-6 hover:shadow-2xl transition-all ring-1 ring-slate-100">
                    <div className="text-4xl">🔭</div>
                    <h3 className="text-xl font-bold serif">Theory Lab</h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-serif italic h-10">Translation as Data Framework: 5D Multi-perspective Matrix.</p>
                    <div className="flex-1"></div>
                    <button onClick={() => setShowTheoryLab(true)} className="w-full py-4 border border-slate-200 text-slate-600 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Explore Theory →</button>
                </div>
            </div>

            <div className="w-full max-w-4xl bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between group cursor-pointer hover:bg-indigo-50 transition-all mb-12 px-10" onClick={() => createNewProject("Sample Lab Project", SAMPLE_ENTRIES)}>
                <div className="flex items-center gap-6">
                    <span className="text-3xl">📖</span>
                    <div className="text-left"><h4 className="text-sm font-bold serif">Explore Sample Lab</h4><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Experience the dynamic lab with pre-loaded library data</p></div>
                </div>
                <button className="px-8 py-3 bg-white rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-100 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">Enter Lab →</button>
            </div>

            <div className="flex items-center gap-4">
                <button onClick={() => setShowProjectOverlay(true)} className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95"><span>📓</span> Project Hub ({projects.length})</button>
                <button onClick={() => setShowTheoryLab(true)} className="flex items-center gap-3 px-8 py-4 bg-white text-slate-500 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50"><span>🔭</span> Research Matrix</button>
            </div>
        </div>
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
            {['list', 'network', 'stats', 'map', 'blueprint'].map(m => (
              <button key={m} onClick={() => setViewMode(m as any)} className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                {m === 'list' ? 'Archive' : m === 'network' ? 'Network' : m === 'stats' ? 'Stats' : m === 'map' ? 'GIS Lab' : 'Blueprint'}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-4">
             <button onClick={handleRepairGIS} disabled={isGeocoding} className="px-6 py-3 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all shadow-sm">{isGeocoding ? '📍 Resolving GIS...' : '📍 Repair GIS'}</button>
             <button onClick={() => fileInputRef.current?.click()} className="bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-md">Import</button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {viewMode === 'list' && (
           <div className="p-12 h-full overflow-auto animate-fadeIn custom-scrollbar bg-slate-50/20">
              <div className="max-w-[1920px] mx-auto space-y-10">
                <div className="flex justify-between items-end border-b border-slate-100 pb-10">
                    <div className="space-y-2">
                        <h2 className="text-5xl font-bold serif text-slate-900">Bibliographic Archive</h2>
                        <p className="text-xs text-slate-400 font-serif italic">Management of translation records and mediator attributes.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mr-4">Results: {activeProject?.entries.length}</div>
                        <input className="w-96 p-5 bg-white rounded-[1.5rem] border border-slate-200 text-sm outline-none shadow-sm focus:ring-4 ring-indigo-50 transition-all" placeholder="Search entries, authors, translators..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden mb-20 ring-1 ring-slate-100">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-100">
                        <tr>
                            <th className="p-8">Work Title</th>
                            <th className="p-8">Author</th>
                            <th className="p-8 text-indigo-500">Translator</th>
                            <th className="p-8">Location</th>
                            <th className="p-8 text-center">GIS Active</th>
                            <th className="p-8 text-right">Year</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-serif text-lg text-slate-700">
                        {activeProject?.entries.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()) || e.translator.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.author.name.toLowerCase().includes(searchTerm.toLowerCase())).map((e, i) => (
                          <tr key={e.id} className="hover:bg-indigo-50/10 transition-all duration-300">
                            <td className="p-8 font-bold text-slate-900">{e.title}</td>
                            <td className="p-8 text-slate-500">{e.author.name}</td>
                            <td className="p-8 text-indigo-600 font-bold">{e.translator.name}</td>
                            <td className="p-8 text-slate-400 italic text-sm">{[e.city, e.provinceState].filter(Boolean).join(', ') || 'Unknown'}</td>
                            <td className="p-8 text-center relative">
                                {e.customMetadata?.targetCoord ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6)] animate-pulse"></span>
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Mapped</span>
                                    </div>
                                ) : (
                                    processingIdx === i ? (
                                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-200"></span>
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">Null</span>
                                        </div>
                                    )
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
                        <div className="p-16 bg-indigo-900/10 rounded-[4rem] border border-indigo-500/20 space-y-10">
                             <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-indigo-400">Data Strategy</h3>
                             <p className="text-xl font-serif text-slate-400 leading-relaxed italic border-l-4 border-indigo-500/30 pl-10">
                                {activeProject.blueprint.dataCleaningStrategy}
                             </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-16 max-w-3xl text-center">
                         <div className="text-8xl mb-4 bg-white/5 w-32 h-32 rounded-[3rem] flex items-center justify-center border border-white/10 shadow-2xl animate-pulse">🏛️</div>
                         <div className="space-y-6">
                            <h2 className="text-5xl font-bold serif">Framework Not Deployed</h2>
                            <p className="text-slate-400 font-serif italic text-2xl leading-relaxed">The current archive lacks a formal theoretical mapping. Generate a blueprint to formalize the research dimensions?</p>
                         </div>
                         <button onClick={handleGenerateBlueprintInLab} disabled={isArchitecting} className={`px-20 py-8 bg-indigo-600 text-white rounded-[3rem] text-sm font-black uppercase tracking-[0.5em] transition-all shadow-2xl ${isArchitecting ? 'opacity-50 animate-pulse' : 'hover:bg-indigo-500 hover:scale-105 active:scale-95 ring-[12px] ring-indigo-500/10'}`}>
                            {isArchitecting ? 'Architecting Framework...' : 'Generate Lab Blueprint'}
                         </button>
                    </div>
                )}
            </div>
        )}
      </main>

      {showTheoryLab && <TheoryLab onClose={() => setShowTheoryLab(false)} onApplyBlueprint={handleApplyBlueprint} />}
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
    </div>
  );
}

export default App;
