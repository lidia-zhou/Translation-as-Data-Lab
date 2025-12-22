
import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BibEntry, ViewMode, Gender, ResearchBlueprint, AnalysisReport } from './types';
import NetworkGraph from './components/NetworkGraph';
import StatsDashboard from './components/StatsDashboard';
import WorldMap from './components/WorldMap';
import GlobalFlowBackground from './components/GlobalFlowBackground';
import { parseBibliographicData, generateResearchBlueprint, generateInsights } from './services/geminiService';

const STORAGE_KEY_CORPUS = 'translatio_corpus_data';
const STORAGE_KEY_BLUEPRINT = 'translatio_blueprint';

const STANDARD_BLUEPRINT: ResearchBlueprint = {
  projectScope: "Standard Bibliographic Study",
  suggestedSchema: [
    { fieldName: "Source Language", description: "The original language", analyticalUtility: "Trends in language dominance.", importance: 'Critical' },
    { fieldName: "Publisher City", description: "City of publication", analyticalUtility: "Mapping literary hubs.", importance: 'Critical' }
  ],
  dataCleaningStrategy: "Ensure city names are consistent (e.g., 'London' not 'London, UK')."
};

const SYSTEM_FIELDS = [
    { key: 'title', label: 'Book Title', required: true, variants: ['title', 'book', 'name', '书名', '名称', '题名'] },
    { key: 'authorName', label: 'Author Name', required: true, variants: ['author', 'writer', 'creator', '作者', '著者', '姓名'] },
    { key: 'translatorName', label: 'Translator Name', required: true, variants: ['translator', 'trans', '译者', '翻译'] },
    { key: 'publicationYear', label: 'Pub. Year', required: false, variants: ['year', 'date', 'pub year', '出版年', '年份', '时间'] },
    { key: 'publisher', label: 'Publisher', required: false, variants: ['publisher', 'press', 'house', '出版社', '出版机构'] },
];

function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [entries, setEntries] = useState<BibEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CORPUS);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [blueprint, setBlueprint] = useState<ResearchBlueprint | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_BLUEPRINT);
    return saved ? JSON.parse(saved) : null;
  });

  const [statsInsights, setStatsInsights] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => localStorage.setItem(STORAGE_KEY_CORPUS, JSON.stringify(entries)), [entries]);
  useEffect(() => localStorage.setItem(STORAGE_KEY_BLUEPRINT, JSON.stringify(blueprint)), [blueprint]);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isBlueprinting, setIsBlueprinting] = useState(false);
  const [projectInput, setProjectInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // AI Parsing State for Add Modal
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  // --- IMPORT STATE ---
  const [importData, setImportData] = useState<any[] | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showImportMapper, setShowImportMapper] = useState(false);

  const [manualForm, setManualForm] = useState<any>({
    title: '', authorName: '', translatorName: '', publicationYear: new Date().getFullYear(), publisher: '', originalCity: '', city: ''
  });

  const resetProject = () => {
    if (confirm("Reset current project state? Data in corpus will be kept but current session will return to entrance.")) {
      setBlueprint(null);
      setHasStarted(false);
      setShowImportMapper(false);
    }
  };

  const clearCorpus = () => {
    if (confirm("DANGER: This will permanently delete ALL entries in your corpus. Continue?")) {
      setEntries([]);
      localStorage.removeItem(STORAGE_KEY_CORPUS);
    }
  };

  const handleCreateBlueprint = async () => {
    if (!projectInput.trim()) return;
    setIsBlueprinting(true);
    try {
      const bp = await generateResearchBlueprint(projectInput);
      setBlueprint(bp);
      setHasStarted(true);
      setViewMode('blueprint');
    } catch (err) {
      alert("AI Architect encountered an error. Please try a different description.");
    } finally {
      setIsBlueprinting(false);
    }
  };

  const handleRedesignBlueprint = () => {
    setBlueprint(null);
    setHasStarted(true); // Triggers the consultation view
  };

  const handleSkipBlueprint = () => {
    setBlueprint(STANDARD_BLUEPRINT);
    setHasStarted(true);
    setViewMode('list');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        const jsonData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        if (jsonData.length > 0) {
          const headers = Object.keys(jsonData[0]);
          setImportHeaders(headers);
          setImportData(jsonData);
          const mapping: Record<string, string> = {};
          SYSTEM_FIELDS.forEach(field => {
             const match = headers.find(h => field.variants.some(v => h.toLowerCase().includes(v.toLowerCase())));
             if (match) mapping[field.key] = match;
          });
          setColumnMapping(mapping);
          setShowImportMapper(true);
        }
      } catch (err) { alert("File error."); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const finalizeImport = () => {
    if (!importData) return;
    const newEntries: BibEntry[] = importData.map((row, idx) => ({
      id: `import-${Date.now()}-${idx}`,
      title: String(row[columnMapping['title']] || 'Untitled'),
      author: { name: String(row[columnMapping['authorName']] || 'Unknown'), gender: Gender.UNKNOWN },
      translator: { name: String(row[columnMapping['translatorName']] || 'Unknown'), gender: Gender.UNKNOWN },
      publicationYear: parseInt(row[columnMapping['publicationYear']]) || 0,
      publisher: String(row[columnMapping['publisher']] || ''),
      city: String(row[columnMapping['city']] || ''),
      originalCity: String(row[columnMapping['originalCity']] || ''),
      sourceLanguage: 'Unknown', targetLanguage: 'Unknown', tags: [], customMetadata: {}
    }));
    setEntries([...newEntries, ...entries]);
    if (!blueprint) setBlueprint(STANDARD_BLUEPRINT);
    setShowImportMapper(false);
    setHasStarted(true);
    setViewMode('list');
  };

  const handleAIParse = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    try {
      const result = await parseBibliographicData(rawText, blueprint || undefined);
      setManualForm({
        ...manualForm,
        title: result.title || manualForm.title,
        authorName: result.author?.name || manualForm.authorName,
        translatorName: result.translator?.name || manualForm.translatorName,
        publicationYear: result.publicationYear || manualForm.publicationYear,
        city: result.city || manualForm.city
      });
      setRawText('');
    } catch (err) {
      alert("AI extraction failed. Please enter manually.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleGetInsights = async () => {
    if (entries.length === 0) return;
    setIsAnalyzing(true);
    try {
      const insights = await generateInsights(entries);
      setStatsInsights(insights);
    } catch (err) { setStatsInsights("Analysis error."); }
    finally { setIsAnalyzing(false); }
  };

  const updateEntry = (id: string, field: string, value: any) => {
      setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const filteredEntries = useMemo(() => {
    const l = searchTerm.toLowerCase().trim();
    return l ? entries.filter(e => e.title.toLowerCase().includes(l) || e.author.name.toLowerCase().includes(l)) : entries;
  }, [entries, searchTerm]);

  // --- RENDERING VIEWS ---

  if (showImportMapper && importData) {
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xl z-[100] flex items-center justify-center p-8 animate-fadeIn">
            <div className="max-w-6xl w-full bg-white rounded-[4rem] shadow-2xl p-16 border border-slate-100 flex flex-col gap-10 max-h-full">
                <h2 className="text-4xl font-bold serif text-slate-900">Map Dataset Columns</h2>
                <div className="flex-1 overflow-y-auto border border-slate-100 rounded-3xl bg-slate-50 p-4">
                    <table className="w-full text-[11px] text-slate-500">
                        <thead className="bg-slate-100 sticky top-0">
                            <tr>{Object.keys(columnMapping).map(k => <th key={k} className="p-4 text-left font-bold">{SYSTEM_FIELDS.find(f => f.key === k)?.label}</th>)}</tr>
                        </thead>
                        <tbody>
                            {importData.slice(0, 50).map((row, i) => (
                                <tr key={i} className="border-t border-slate-100">{Object.keys(columnMapping).map(k => <td key={k} className="p-4">{String(row[columnMapping[k]] || '--')}</td>)}</tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex gap-4 pt-6 shrink-0">
                    <button onClick={() => setShowImportMapper(false)} className="px-10 py-5 bg-slate-100 text-slate-500 rounded-2xl font-bold uppercase text-xs">Back</button>
                    <button onClick={finalizeImport} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-bold uppercase text-xs shadow-xl hover:bg-indigo-700 transition-all">Import to Corpus</button>
                </div>
            </div>
        </div>
    );
  }

  if (!hasStarted && !blueprint) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
        <GlobalFlowBackground />
        <div className="relative z-10 max-w-5xl w-full text-center animate-fadeIn">
          <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white font-serif font-bold text-5xl shadow-2xl mx-auto mb-10 transform rotate-6 text-indigo-400">T</div>
          <h1 className="text-8xl font-bold serif text-slate-900 mb-6 tracking-tight">Translatio</h1>
          <p className="text-2xl text-slate-500 font-serif italic mb-16 leading-relaxed max-w-2xl mx-auto">Digital workspace for translation history scholars.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            <button onClick={() => setHasStarted(true)} className="group bg-white p-10 rounded-[3rem] border border-slate-100 hover:border-indigo-200 hover:shadow-2xl transition-all text-left">
              <div className="text-4xl mb-6">📐</div>
              <h3 className="text-xl font-bold mb-2 serif">AI Architect</h3>
              <p className="text-xs text-slate-400">Input your research question to generate a specialized methodology schema.</p>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="group bg-white p-10 rounded-[3rem] border border-slate-100 hover:border-emerald-200 hover:shadow-2xl transition-all text-left">
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
              <div className="text-4xl mb-6">📊</div>
              <h3 className="text-xl font-bold mb-2 serif">Import Corpus</h3>
              <p className="text-xs text-slate-400">Load your existing Excel/CSV database with AI mapping support.</p>
            </button>
            <button onClick={handleSkipBlueprint} className="group bg-slate-900 p-10 rounded-[3rem] text-left hover:shadow-2xl transition-all shadow-xl shadow-slate-200">
              <div className="text-4xl mb-6">✍️</div>
              <h3 className="text-xl font-bold mb-2 serif text-white">Manual Record</h3>
              <p className="text-xs text-slate-400">Jump straight into cataloging using a standard bibliographic framework.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // AI Architect Consultation Page
  if (hasStarted && !blueprint) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 relative overflow-hidden">
            <GlobalFlowBackground />
            <div className="relative z-10 max-w-2xl w-full bg-white rounded-[4rem] shadow-2xl p-16 border border-slate-100 flex flex-col gap-10 animate-slideUp">
                <div className="text-center space-y-4">
                    <h2 className="text-4xl font-bold serif text-slate-900">Research Consultation</h2>
                    <p className="text-slate-400 font-serif italic">Describe your project goals to let AI design your custom schema.</p>
                </div>
                <textarea 
                    className="w-full h-48 p-8 bg-slate-50 border-none rounded-[2.5rem] focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-lg font-serif"
                    placeholder="e.g., 'A study of translated children's literature in Shanghai (1900-1949) focusing on gender roles...'"
                    value={projectInput}
                    onChange={e => setProjectInput(e.target.value)}
                />
                <div className="flex flex-col gap-4">
                    <button 
                        onClick={handleCreateBlueprint} 
                        disabled={isBlueprinting || !projectInput.trim()}
                        className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-bold text-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3"
                    >
                        {isBlueprinting ? "Architecting..." : "Generate Methodology Compass"}
                    </button>
                    <button onClick={() => setHasStarted(false)} className="text-xs font-bold text-slate-300 uppercase tracking-widest hover:text-red-500 transition-colors">Cancel</button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <header className="bg-white/95 backdrop-blur-2xl border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={resetProject}>
             <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold serif text-2xl shadow-lg">T</div>
             <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-slate-800 serif leading-none">Translatio</h1>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{blueprint.projectScope.slice(0, 30)}...</span>
             </div>
          </div>
          <nav className="flex space-x-1 bg-slate-100 p-1.5 rounded-xl shadow-inner">
            {(['list', 'network', 'map', 'stats', 'blueprint'] as ViewMode[]).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${viewMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
                {mode === 'list' ? 'Corpus' : mode === 'blueprint' ? 'Compass' : mode}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-4">
             <button onClick={resetProject} className="text-[10px] font-bold text-slate-300 hover:text-indigo-600 uppercase tracking-widest transition-all">Reset Project</button>
             <button onClick={() => setShowAddModal(true)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-600 transition-all shadow-lg">+ New Entry</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-8 py-10 overflow-hidden flex flex-col">
        {viewMode === 'blueprint' && (
            <div className="animate-fadeIn space-y-12 overflow-y-auto pr-4 custom-scrollbar">
                <div className="flex justify-between items-end">
                    <h2 className="text-5xl font-bold serif text-slate-900">Project Compass</h2>
                    <button onClick={handleRedesignBlueprint} className="px-6 py-3 bg-white border border-slate-200 text-indigo-600 rounded-xl text-xs font-bold uppercase tracking-widest hover:shadow-md transition-all">Redesign with AI Architect</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {blueprint.suggestedSchema.map((f, i) => (
                        <div key={i} className="p-8 bg-white border border-slate-100 rounded-[3rem] shadow-sm">
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4 block">Recommended Field</span>
                            <h3 className="text-2xl font-bold serif mb-2 text-slate-800">{f.fieldName}</h3>
                            <p className="text-sm text-slate-500 italic">"{f.analyticalUtility}"</p>
                        </div>
                    ))}
                    <div className="p-8 bg-slate-900 text-white rounded-[3rem] shadow-xl md:col-span-2 lg:col-span-1">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 block">AI Strategy</span>
                        <p className="text-lg font-serif italic text-slate-300 leading-relaxed">"{blueprint.dataCleaningStrategy}"</p>
                    </div>
                </div>
            </div>
        )}

        {viewMode === 'list' && (
           <div className="space-y-8 animate-fadeIn flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-4">
                 <input type="text" placeholder="Filter by title or agent..." className="flex-1 pl-8 pr-8 py-5 bg-slate-50 border-none rounded-[2.5rem] outline-none text-lg shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                 <button onClick={clearCorpus} className="px-8 py-5 bg-red-50 text-red-500 rounded-[2.5rem] text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Clear All</button>
              </div>

              <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden flex-1 overflow-y-auto shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] uppercase text-slate-400 font-bold tracking-widest text-center">
                        <th className="p-8 text-left">Book / Record</th>
                        <th className="p-8">Agents / Role</th>
                        <th className="p-8">Geography</th>
                        <th className="p-8 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredEntries.map(e => (
                        <tr key={e.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="p-8">
                             <input className="font-bold text-slate-800 serif text-xl block bg-transparent w-full outline-none focus:text-indigo-600" value={e.title} onChange={ev => updateEntry(e.id, 'title', ev.target.value)} />
                             <input className="text-[10px] text-slate-400 font-mono block bg-transparent w-full outline-none" value={e.originalTitle || ''} onChange={ev => updateEntry(e.id, 'originalTitle', ev.target.value)} placeholder="Subtitle / Original" />
                          </td>
                          <td className="p-8">
                             <input className="text-sm font-semibold text-slate-700 block bg-transparent w-full outline-none text-center" value={e.author.name} onChange={ev => updateEntry(e.id, 'author', { ...e.author, name: ev.target.value })} />
                             <input className="text-[10px] text-indigo-500 font-bold uppercase block bg-transparent w-full outline-none text-center" value={e.translator.name} onChange={ev => updateEntry(e.id, 'translator', { ...e.translator, name: ev.target.value })} />
                          </td>
                          <td className="p-8">
                             <input className="text-[11px] font-medium text-slate-500 bg-transparent outline-none block mb-1 text-center" value={e.originalCity || ''} onChange={ev => updateEntry(e.id, 'originalCity', ev.target.value)} placeholder="Origin City" />
                             <input className="text-[11px] font-medium text-slate-500 bg-transparent outline-none block text-center" value={e.city || ''} onChange={ev => updateEntry(e.id, 'city', ev.target.value)} placeholder="Target City" />
                          </td>
                          <td className="p-8 text-right">
                             <button onClick={() => setEntries(entries.filter(x => x.id !== e.id))} className="text-slate-200 hover:text-red-500 text-3xl transition-all">&times;</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
           </div>
        )}
        {viewMode === 'map' && <WorldMap data={entries} />}
        {viewMode === 'network' && <NetworkGraph data={entries} />}
        {viewMode === 'stats' && <StatsDashboard data={entries} insights={statsInsights} onGenerateInsights={handleGetInsights} isAnalyzing={isAnalyzing} />}
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[100] flex items-center justify-center p-8 animate-fadeIn">
            <div className="bg-white rounded-[4rem] shadow-2xl max-w-4xl w-full p-12 relative border border-slate-100 flex flex-col md:flex-row gap-12">
                <div className="flex-1 space-y-6">
                    <h3 className="text-4xl font-bold serif text-slate-900">New Catalog Entry</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Book Title</label>
                            <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-xl font-serif" placeholder="The Second Sex..." value={manualForm.title} onChange={e => setManualForm({...manualForm, title: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Author</label>
                                <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl outline-none" placeholder="Name" value={manualForm.authorName} onChange={e => setManualForm({...manualForm, authorName: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Translator</label>
                                <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl outline-none" placeholder="Name" value={manualForm.translatorName} onChange={e => setManualForm({...manualForm, translatorName: e.target.value})} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Year</label>
                                <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl outline-none" value={manualForm.publicationYear} onChange={e => setManualForm({...manualForm, publicationYear: parseInt(e.target.value)})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Target City</label>
                                <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl outline-none" placeholder="e.g. London" value={manualForm.city} onChange={e => setManualForm({...manualForm, city: e.target.value})} />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4 pt-6">
                        <button onClick={() => setShowAddModal(false)} className="px-6 py-5 bg-slate-100 text-slate-500 rounded-2xl font-bold uppercase text-xs tracking-widest">Discard</button>
                        <button onClick={() => {
                            const ne: BibEntry = {
                                id: Date.now().toString(),
                                title: manualForm.title || 'Untitled',
                                author: { name: manualForm.authorName || 'Unknown', gender: Gender.UNKNOWN },
                                translator: { name: manualForm.translatorName || 'Unknown', gender: Gender.UNKNOWN },
                                publicationYear: manualForm.publicationYear,
                                publisher: '', sourceLanguage: 'Unknown', targetLanguage: 'Unknown', tags: [], customMetadata: {},
                                city: manualForm.city
                            };
                            setEntries([ne, ...entries]);
                            setShowAddModal(false);
                            setManualForm({ title: '', authorName: '', translatorName: '', publicationYear: new Date().getFullYear(), publisher: '', originalCity: '', city: '' });
                        }} className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-xl shadow-slate-200 hover:bg-indigo-600 transition-all">Save to Repository</button>
                    </div>
                </div>

                <div className="w-full md:w-80 p-8 bg-indigo-50 rounded-[3rem] border border-indigo-100 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="text-xl">✨</div>
                        <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-widest">AI Fast-Entry</h4>
                    </div>
                    <p className="text-[10px] text-indigo-700 leading-relaxed italic">
                        Paste a citation, archival snippet, or raw bibliographic text here to let the AI architect extract fields for you.
                    </p>
                    <textarea 
                        className="flex-1 p-4 bg-white/50 border-none rounded-2xl outline-none text-xs text-indigo-900 focus:bg-white transition-all min-h-[120px]"
                        placeholder="e.g. Woolf, V. (1925). Mrs Dalloway. Trans. by..."
                        value={rawText}
                        onChange={e => setRawText(e.target.value)}
                    />
                    <button 
                        onClick={handleAIParse}
                        disabled={isParsing || !rawText.trim()}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                        {isParsing ? "Extracting..." : "Auto-Fill Form"}
                    </button>
                </div>

                <button onClick={() => setShowAddModal(false)} className="absolute top-8 right-8 text-slate-200 text-4xl hover:text-red-500 transition-all">&times;</button>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;
