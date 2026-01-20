
import React, { useState } from 'react';
import { ResearchBlueprint, ResearchDimension } from '../types';
import { generateResearchBlueprint } from '../services/geminiService';

interface TheoryLabProps {
  onClose: () => void;
  onApplyBlueprint: (blueprint: ResearchBlueprint) => void;
}

/** 
 * OFFLINE CONTEXT-AWARE ENGINE
 * Maps user intent to research dimensions without an API.
 */
const OFFLINE_ENGINE = {
  getTheme: (query: string) => {
    const q = query.toLowerCase();
    if (q.includes('gender') || q.includes('women') || q.includes('feminism')) return 'Sociology of Gender';
    if (q.includes('poetry') || q.includes('verse') || q.includes('lyric')) return 'Poetics & Style';
    if (q.includes('macao') || q.includes('colony') || q.includes('portugal')) return 'Colonial Circulation';
    if (q.includes('history') || q.includes('qing') || q.includes('republic')) return 'Institutional History';
    return 'General Translation Flow';
  },

  getHeuristicBlueprint: (query: string): ResearchBlueprint => {
    const theme = OFFLINE_ENGINE.getTheme(query);
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const keyword = words[0] || "Target Corpus";

    const dimensions: ResearchDimension[] = [
      {
        dimension: 'Agentive (Who)',
        coreQuestion: theme === 'Sociology of Gender' 
            ? `How do gendered mediator profiles (e.g. female patrons) shape the translation of ${keyword}?`
            : `Who are the primary mediators facilitating the institutional movement of ${keyword}?`,
        dataSources: ["Mediator Biographies", "Publisher Catalogues", "Entity Registries"],
        dhMethods: ["SNA (Degree Centrality)", "Prosopography"],
        relevance: 95
      },
      {
        dimension: 'Textual (What)',
        coreQuestion: theme === 'Poetics & Style'
            ? `What prosodic transformations occur when ${keyword} enters the target linguistic standard?`
            : `What stylistic signatures or lexical shifts define ${keyword} in this archival period?`,
        dataSources: ["Parallel Corpora", "Annotated Manuscripts", "Digital Editions"],
        dhMethods: ["Stylometry", "Topic Modeling"],
        relevance: 88
      },
      {
        dimension: 'Distributional (Where/When/How)',
        coreQuestion: theme === 'Colonial Circulation'
            ? `How did ${keyword} flow between colonial hubs (e.g. Macao) and metropolitan centers?`
            : `Where are the publication hotspots and entry points for ${keyword} in this dataset?`,
        dataSources: ["GIS Location Data", "Publication Years", "Library Accession Logs"],
        dhMethods: ["GIS Spatial Analysis", "Spatiotemporal Heatmaps"],
        relevance: 92
      },
      {
        dimension: 'Discursive (Why)',
        coreQuestion: `What modernisation narratives or ideological frames justified the translation of ${keyword}?`,
        dataSources: ["Prefaces/Paratexts", "Critical Reviews", "Censorship Records"],
        dhMethods: ["Discourse Mapping", "Manual Coding"],
        relevance: 85
      },
      {
        dimension: 'Reception (So what)',
        coreQuestion: `What long-term canonization status did ${keyword} achieve in target academic contexts?`,
        dataSources: ["Citation Indexes", "University Syllabi", "Digital Reception Metrics"],
        dhMethods: ["Impact Factor Mapping", "Reception Networks"],
        relevance: 80
      }
    ];

    return {
      projectScope: `Expert Mapping (${theme}): ${query}`,
      dimensions,
      methodology: `Deploy a multi-dimensional ${theme} framework to identify bottlenecks in the circulation of ${keyword}.`,
      suggestedSchema: [], dataCleaningStrategy: "", storageAdvice: "", visualizationStrategy: "", collectionTips: ""
    };
  }
};

const TheoryLab: React.FC<TheoryLabProps> = ({ onClose, onApplyBlueprint }) => {
  const [query, setQuery] = useState('Gender and Poetry in Late Qing Translation');
  const [isGenerating, setIsGenerating] = useState(false);
  const [blueprint, setBlueprint] = useState<ResearchBlueprint | null>(null);

  const handleGenerate = async () => {
    if (!query.trim()) return;
    setIsGenerating(true);
    
    if (!process.env.API_KEY) {
      await new Promise(r => setTimeout(r, 1500)); 
      setBlueprint(OFFLINE_ENGINE.getHeuristicBlueprint(query));
      setIsGenerating(false);
      return;
    }

    try {
      const bp = await generateResearchBlueprint(query);
      setBlueprint(bp);
    } catch (e) {
      setBlueprint(OFFLINE_ENGINE.getHeuristicBlueprint(query));
    } finally {
      setIsGenerating(false);
    }
  };

  const getIcon = (dim: string) => {
    if (dim.includes('Who')) return '👤';
    if (dim.includes('What')) return '📜';
    if (dim.includes('Where')) return '📍';
    if (dim.includes('Why')) return '💬';
    return '🗣️';
  };

  return (
    <div className="fixed inset-0 bg-white z-[900] flex flex-col animate-fadeIn select-none overflow-hidden font-sans">
      <header className="px-12 py-8 flex items-center justify-between border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-slate-200">T</div>
          <div className="space-y-0.5">
            <h1 className="text-3xl font-bold text-slate-900 serif leading-none">Theory Lab</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Translation as Data: Five-Dimensional Framework Mapping</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className={`px-5 py-2 rounded-full flex items-center gap-2 border ${process.env.API_KEY ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${process.env.API_KEY ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${process.env.API_KEY ? 'text-indigo-700' : 'text-amber-700'}`}>
                {process.env.API_KEY ? 'AI Matrix Active' : 'Thematic Expert Logic'}
            </span>
          </div>
          <button onClick={onClose} className="text-5xl text-slate-200 hover:text-slate-900 transition-colors leading-none">&times;</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-slate-50/20 px-12 py-10 space-y-12 custom-scrollbar">
        <div className="max-w-[1400px] mx-auto bg-white rounded-[2.5rem] p-12 shadow-sm border border-slate-200 flex flex-col gap-10">
          <div className="space-y-4">
            <label className="text-[11px] font-black uppercase text-slate-900 tracking-widest">Research Inquiry</label>
            <textarea 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-32 bg-slate-50 border border-slate-100 rounded-[2rem] p-8 text-2xl font-serif italic text-slate-800 outline-none focus:ring-8 ring-indigo-50 transition-all resize-none shadow-inner"
              placeholder="e.g., gender in late qing translation..."
            />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-[11px] text-slate-400 font-serif italic max-w-2xl leading-relaxed">
                Enter your research topic to generate a multidimensional mapping protocol. The system uses expert translation studies heuristics to suggest data sources and analytical methods.
            </p>
            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !query.trim()}
              className="px-12 py-6 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-300 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all shadow-2xl active:scale-95 flex items-center gap-4"
            >
              {isGenerating ? 'ANALYZING INTENT...' : 'GET MATRIX ANALYSIS →'}
            </button>
          </div>
        </div>

        {(blueprint || isGenerating) && (
          <div className="max-w-[1400px] mx-auto space-y-10 animate-slideUp pb-32">
            <div className="flex items-center gap-6">
               <div className="h-px bg-slate-200 flex-1"></div>
               <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.6em] whitespace-nowrap">The Framework Matrix</h3>
               <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            {isGenerating ? (
               <div className="bg-white rounded-[4rem] p-32 border border-slate-200 flex flex-col items-center justify-center gap-8 shadow-sm">
                  <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-500 rounded-full animate-spin"></div>
                  <p className="text-2xl font-serif italic text-slate-400">Synthesizing Computational Dimensions...</p>
               </div>
            ) : (
              <div className="space-y-6">
                {blueprint?.dimensions.map((dim, idx) => (
                  <div key={idx} className="bg-white rounded-3xl border border-slate-200 flex items-stretch overflow-hidden hover:shadow-2xl transition-all border-l-8 border-l-transparent hover:border-l-indigo-500 group">
                    <div className="w-64 bg-slate-50/50 flex flex-col items-center justify-center p-10 shrink-0 border-r border-slate-100 group-hover:bg-slate-50 transition-colors">
                        <div className="text-4xl mb-4 bg-white w-20 h-20 rounded-3xl flex items-center justify-center shadow-inner border border-slate-50">{getIcon(dim.dimension)}</div>
                        <h4 className="text-xl font-bold text-slate-800 serif text-center leading-tight">{dim.dimension}</h4>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-3">Dimension 0{idx+1}</span>
                    </div>

                    <div className="flex-1 p-12 grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
                        <div className="lg:col-span-5 space-y-5">
                            <h5 className="text-[11px] font-black uppercase text-indigo-500 tracking-widest">Ontological Inquiry</h5>
                            <p className="text-2xl font-serif font-semibold text-slate-900 leading-snug tracking-tight">{dim.coreQuestion}</p>
                        </div>
                        
                        <div className="lg:col-span-4 space-y-5">
                            <h5 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Target Data Sources</h5>
                            <div className="flex flex-wrap gap-3">
                                {dim.dataSources.map(s => <span key={s} className="px-5 py-2.5 bg-slate-100 text-[11px] font-bold text-slate-500 rounded-xl border border-slate-200/40">{s}</span>)}
                            </div>
                        </div>

                        <div className="lg:col-span-3 space-y-5">
                            <h5 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Analytical Methods</h5>
                            <div className="flex flex-wrap gap-3">
                                {dim.dhMethods.map(m => <span key={m} className="px-5 py-2.5 bg-slate-900 text-[10px] font-black uppercase text-white rounded-xl tracking-tighter shadow-lg shadow-slate-200">{m}</span>)}
                            </div>
                        </div>
                    </div>
                  </div>
                ))}

                <div className="mt-24 p-20 bg-white rounded-[4.5rem] border border-slate-200 shadow-sm space-y-16">
                   <div className="text-center space-y-10">
                      <h5 className="text-[12px] font-black uppercase text-indigo-500 tracking-[0.5em]">Methodological Synthesis</h5>
                      <h2 className="text-6xl font-bold text-slate-900 serif leading-tight max-w-5xl mx-auto italic tracking-tight">
                        "{blueprint?.methodology}"
                      </h2>
                   </div>

                   <div className="grid grid-cols-2 gap-24 border-t border-slate-100 pt-20">
                      <div className="space-y-8">
                        <h6 className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-4">
                          <div className="w-3 h-3 rounded-full bg-indigo-500"></div> Visualization Strategy
                        </h6>
                        <p className="text-2xl font-serif text-slate-600 leading-relaxed italic border-l-4 border-slate-100 pl-10">
                          Prioritize Spatiotemporal heatmaps to track geographic shifts, combined with Network analysis for mediator collaboration.
                        </p>
                      </div>
                      <div className="space-y-8">
                        <h6 className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-4">
                          <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Local GIS Resolution
                        </h6>
                        <p className="text-2xl font-serif text-slate-600 leading-relaxed italic border-l-4 border-slate-100 pl-10">
                          Utilize the system's local coordinate cache for offline mapping. Standardize historical place names across heterogenous records.
                        </p>
                      </div>
                   </div>
                </div>

                <div className="flex justify-center pt-24 pb-20">
                    <button 
                      onClick={() => blueprint && onApplyBlueprint(blueprint)}
                      className="px-24 py-10 bg-slate-900 text-white rounded-[3.5rem] font-bold text-sm uppercase tracking-[0.5em] hover:bg-indigo-600 transition-all shadow-2xl hover:scale-105 active:scale-95 ring-[12px] ring-indigo-50"
                    >
                        Deploy Research Architecture →
                    </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default TheoryLab;
