
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { BibEntry, GraphNode, GraphLink, AdvancedGraphMetrics, NodeSizeMetric, NetworkConfig, ResearchBlueprint, LayoutType, ColorMode, EdgeType } from '../types';

interface NetworkGraphProps {
  data: BibEntry[];
  customColumns: string[];
  blueprint: ResearchBlueprint | null;
  onDataUpdate: (newEntries: BibEntry[]) => void;
}

const CATEGORY_COLORS = d3.schemeTableau10;
const COMMUNITY_COLORS = d3.schemeObservable10;
const EDGE_COLORS: Record<EdgeType, string> = {
    TRANSLATION: '#6366f1', // Indigo
    PUBLICATION: '#10b981', // Emerald
    COLLABORATION: '#f59e0b', // Amber
    GEOGRAPHIC: '#94a3b8', // Slate
    LINGUISTIC: '#ec4899', // Pink
    CUSTOM: '#cbd5e1'
};

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, customColumns }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'topology' | 'viz' | 'sna'>('topology');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  const [config, setConfig] = useState<NetworkConfig>({
    selectedNodeAttrs: ['authorName', 'translatorName', 'publisher'], 
    isDirected: true,
    edgeWeightBy: 'frequency',
    colorMode: 'category',
    enabledEdgeTypes: ['TRANSLATION', 'PUBLICATION', 'COLLABORATION', 'GEOGRAPHIC', 'LINGUISTIC', 'CUSTOM']
  });

  const [sizeBy, setSizeBy] = useState<NodeSizeMetric>('degree');
  const [minSize, setMinSize] = useState(15);
  const [maxSize, setMaxSize] = useState(70);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const availableAttributes = useMemo(() => [
    { id: 'authorName', label: 'Author / 著者' },
    { id: 'translatorName', label: 'Translator / 译者' },
    { id: 'publisher', label: 'Publisher / 出版社' },
    { id: 'city', label: 'City / 城市' },
    { id: 'sourceLanguage', label: 'Source Lang / 源语' },
    { id: 'targetLanguage', label: 'Target Lang / 目标语' },
    ...customColumns.map(c => ({ id: `custom:${c}`, label: c }))
  ], [customColumns]);

  const graphData = useMemo(() => {
    const nodesMap = new Map<string, GraphNode>();
    const linkMap = new Map<string, { weight: number, type: EdgeType }>();

    const getAttrValue = (entry: BibEntry, attr: string): string => {
      if (attr === 'authorName') return entry.author.name;
      if (attr === 'translatorName') return entry.translator.name;
      if (attr === 'publisher') return entry.publisher;
      if (attr === 'city') return entry.city || '';
      if (attr === 'sourceLanguage') return entry.sourceLanguage;
      if (attr === 'targetLanguage') return entry.targetLanguage;
      if (attr.startsWith('custom:')) return entry.customMetadata?.[attr.split(':')[1]] || '';
      return '';
    };

    const determineEdgeType = (attr1: string, attr2: string): EdgeType => {
        if ((attr1 === 'authorName' && attr2 === 'translatorName') || (attr1 === 'translatorName' && attr2 === 'authorName')) return 'TRANSLATION';
        if (attr1 === 'publisher' || attr2 === 'publisher') return 'PUBLICATION';
        if (attr1 === attr2 && attr1 === 'translatorName') return 'COLLABORATION';
        if (attr1 === 'city' || attr2 === 'city') return 'GEOGRAPHIC';
        if (attr1 === 'sourceLanguage' || attr2 === 'sourceLanguage' || attr1 === 'targetLanguage' || attr2 === 'targetLanguage') return 'LINGUISTIC';
        return 'CUSTOM';
    };

    data.forEach(entry => {
      const entities: {id: string, name: string, type: string}[] = [];
      config.selectedNodeAttrs.forEach(attr => {
        const val = getAttrValue(entry, attr);
        if (val && val !== 'Unknown' && val !== 'N/A' && val.trim() !== '') {
          const id = `${attr}:${val}`;
          entities.push({ id, name: val, type: attr });
          if (!nodesMap.has(id)) {
            nodesMap.set(id, { 
              id, name: val, group: attr, val: 10,
              degree: 0, inDegree: 0, outDegree: 0, betweenness: 0, closeness: 0, eigenvector: 0, pageRank: 0, clustering: 0, modularity: 0, community: 0
            });
          }
        }
      });

      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const s = entities[i].id;
          const t = entities[j].id;
          const type = determineEdgeType(entities[i].type, entities[j].type);
          
          if (!config.enabledEdgeTypes.includes(type)) continue;
          if (s === t) continue;

          const key = config.isDirected ? `${s}->${t}` : (s < t ? `${s}|${t}` : `${t}|${s}`);
          if (!linkMap.has(key)) linkMap.set(key, { weight: 0, type });
          linkMap.get(key)!.weight++;
        }
      }
    });

    const nodeList = Array.from(nodesMap.values());
    const linkList: GraphLink[] = Array.from(linkMap.entries()).map(([key, obj]) => {
      const parts = config.isDirected ? key.split('->') : key.split('|');
      return { source: parts[0], target: parts[1], weight: obj.weight, type: obj.type };
    });

    const nodeToIndex = new Map(nodeList.map((n, i) => [n.id, i]));
    linkList.forEach(l => {
      const sId = typeof l.source === 'string' ? l.source : l.source.id;
      const tId = typeof l.target === 'string' ? l.target : l.target.id;
      const sIdx = nodeToIndex.get(sId);
      const tIdx = nodeToIndex.get(tId);
      if (sIdx !== undefined && tIdx !== undefined) {
          nodeList[sIdx].outDegree++;
          nodeList[tIdx].inDegree++;
          nodeList[sIdx].degree++;
          nodeList[tIdx].degree++;
      }
    });

    return { nodes: nodeList, links: linkList };
  }, [data, config]);

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0 || dimensions.width === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", dimensions.width).attr("height", dimensions.height);

    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, any>().scaleExtent([0.05, 12]).on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    const centerX = (dimensions.width - (isPanelOpen ? 380 : 0)) / 2;
    const centerY = dimensions.height / 2;

    const sim = d3.forceSimulation(graphData.nodes as any)
        .force("link", d3.forceLink(graphData.links).id((d: any) => d.id).distance(200))
        .force("charge", d3.forceManyBody().strength(-1500))
        .force("center", d3.forceCenter(centerX, centerY))
        .force("collide", d3.forceCollide().radius(d => 15 + (d as any).degree * 2.5 + 15));

    const link = g.append("g").selectAll("line").data(graphData.links).join("line")
      .attr("stroke", d => EDGE_COLORS[d.type])
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", d => Math.sqrt(d.weight) * 3);

    const node = g.append("g").selectAll("g").data(graphData.nodes).join("g")
      .call(d3.drag<any, any>()
        .on("start", (e, d) => { if(!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if(!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    const getRadius = (d: any) => {
        if (sizeBy === 'uniform') return (minSize + maxSize) / 2;
        const extent = d3.extent(graphData.nodes, n => (n as any)[sizeBy] as number) as [number, number];
        const scale = d3.scaleSqrt().domain(extent[0] === extent[1] ? [0, extent[1] || 1] : extent).range([minSize, maxSize]);
        return scale(d[sizeBy]);
    };

    node.append("circle")
      .attr("r", d => getRadius(d))
      .attr("fill", d => CATEGORY_COLORS[availableAttributes.findIndex(a => a.id === d.group) % 10])
      .attr("stroke", "#fff").attr("stroke-width", 3)
      .attr("class", "cursor-pointer hover:stroke-indigo-500 transition-all shadow-xl")
      .on("click", (e, d) => { e.stopPropagation(); setSelectedNode(d); });

    if (showLabels) {
      node.append("text")
        .attr("dy", d => getRadius(d) + 25).attr("text-anchor", "middle")
        .text(d => d.name)
        .attr("class", "text-[11px] font-bold fill-slate-500 pointer-events-none serif");
    }

    sim.on("tick", () => {
      link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y).attr("x2", (d:any) => d.target.x).attr("y2", (d:any) => d.target.y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [graphData, dimensions, isPanelOpen, sizeBy, minSize, maxSize, showLabels]);

  const toggleEdgeType = (type: EdgeType) => {
    setConfig(prev => ({
        ...prev,
        enabledEdgeTypes: prev.enabledEdgeTypes.includes(type) 
            ? prev.enabledEdgeTypes.filter(t => t !== type)
            : [...prev.enabledEdgeTypes, type]
    }));
  };

  return (
    <div ref={containerRef} className="flex-1 w-full h-full bg-[#fdfdfe] relative flex overflow-hidden">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"></svg>
      
      {/* Edge Legend */}
      <div className="absolute bottom-12 left-12 flex flex-col gap-4 bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl z-40">
        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Relationship Types / 关系界定</h5>
        {(Object.entries(EDGE_COLORS) as [EdgeType, string][]).map(([type, color]) => (
            <button key={type} onClick={() => toggleEdgeType(type)} className={`flex items-center gap-4 transition-all hover:scale-105 ${config.enabledEdgeTypes.includes(type) ? 'opacity-100' : 'opacity-20'}`}>
                <div className="w-8 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>
                <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-600">{type}</span>
            </button>
        ))}
      </div>

      {/* Control Panel */}
      <div className={`absolute top-0 right-0 h-full w-[380px] bg-white/95 backdrop-blur-2xl border-l border-slate-100 shadow-2xl transition-transform duration-500 z-50 flex flex-col ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex bg-slate-50/50 border-b border-slate-100 p-2 shrink-0">
            {[{id:'topology',label:'Topology'},{id:'viz',label:'Viz'},{id:'sna',label:'Analysis'}].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-xl ${activeTab === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    {t.label}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
            {activeTab === 'topology' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Node Entities / 节点属性</h4>
                        <div className="flex flex-wrap gap-2.5">
                            {availableAttributes.map(attr => (
                                <button key={attr.id} onClick={() => {
                                    const next = config.selectedNodeAttrs.includes(attr.id) ? config.selectedNodeAttrs.filter(x => x !== attr.id) : [...config.selectedNodeAttrs, attr.id];
                                    setConfig({...config, selectedNodeAttrs: next});
                                }} className={`px-5 py-2.5 rounded-full text-[11px] font-bold border transition-all ${config.selectedNodeAttrs.includes(attr.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                    {attr.label}
                                </button>
                            ))}
                        </div>
                    </section>
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Graph Properties / 图谱属性</h4>
                        <div className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.5rem]">
                           <span className="text-[11px] font-bold text-slate-600 uppercase">Directed Graph / 有向图</span>
                           <button onClick={() => setConfig({...config, isDirected: !config.isDirected})} className={`w-14 h-7 rounded-full transition-colors relative ${config.isDirected ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${config.isDirected ? 'left-8' : 'left-1'}`}></div>
                           </button>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'viz' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Node Scaling / 节点规模</h4>
                        <select value={sizeBy} onChange={e => setSizeBy(e.target.value as any)} className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none text-[11px] font-bold uppercase outline-none shadow-inner text-indigo-600">
                           <option value="uniform">Uniform / 统一大小</option>
                           <option value="degree">Total Degree / 度中心性</option>
                           <option value="inDegree">In-Degree / 入度</option>
                           <option value="outDegree">Out-Degree / 出度</option>
                        </select>
                        <div className="grid grid-cols-2 gap-6">
                           <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase text-slate-300">Min Size</label>
                              <input type="range" min="10" max="40" value={minSize} onChange={e => setMinSize(parseInt(e.target.value))} className="w-full accent-indigo-600" />
                           </div>
                           <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase text-slate-300">Max Size</label>
                              <input type="range" min="40" max="120" value={maxSize} onChange={e => setMaxSize(parseInt(e.target.value))} className="w-full accent-indigo-600" />
                           </div>
                        </div>
                    </section>
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Visual Helpers / 视觉辅助</h4>
                        <div className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.5rem]">
                           <span className="text-[11px] font-bold text-slate-600 uppercase">Show Labels / 显示标签</span>
                           <button onClick={() => setShowLabels(!showLabels)} className={`w-14 h-7 rounded-full transition-colors relative ${showLabels ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${showLabels ? 'left-8' : 'left-1'}`}></div>
                           </button>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'sna' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Degree Centrality / 活跃度排名</h4>
                        <div className="space-y-4">
                           {graphData.nodes.sort((a,b) => b.degree - a.degree).slice(0, 15).map((n, i) => (
                              <div key={n.id} className="flex items-center gap-5 p-5 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-shadow">
                                 <span className="text-sm font-black text-slate-300">#{i+1}</span>
                                 <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-bold text-slate-800 truncate">{n.name}</p>
                                    <p className="text-[10px] uppercase text-indigo-400 font-black tracking-tighter">{n.group}</p>
                                 </div>
                                 <span className="text-sm font-bold text-slate-400">{n.degree}</span>
                              </div>
                           ))}
                        </div>
                    </section>
                </div>
            )}
        </div>

        {selectedNode && (
            <div className="m-8 p-10 bg-slate-900 text-white rounded-[3.5rem] shadow-2xl space-y-6 animate-slideUp relative flex-shrink-0 overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 blur-3xl -mr-20 -mt-20"></div>
                <button onClick={() => setSelectedNode(null)} className="absolute top-8 right-10 text-4xl font-light hover:text-rose-400 transition-colors leading-none z-10">&times;</button>
                <div className="space-y-2 relative z-10">
                    <p className="text-[10px] uppercase text-indigo-400 tracking-widest font-black">{selectedNode.group}</p>
                    <h4 className="text-3xl font-bold serif leading-tight pr-12">{selectedNode.name}</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="bg-white/5 p-5 rounded-[1.5rem] text-center">
                        <p className="text-[9px] uppercase text-slate-500 mb-2 tracking-widest">Tot. Degree</p>
                        <p className="text-2xl font-bold serif text-slate-300">{selectedNode.degree}</p>
                    </div>
                    <div className="bg-white/5 p-5 rounded-[1.5rem] text-center">
                        <p className="text-[9px] uppercase text-slate-500 mb-2 tracking-widest">Flow (In/Out)</p>
                        <p className="text-2xl font-bold serif text-emerald-400">{selectedNode.inDegree}/{selectedNode.outDegree}</p>
                    </div>
                </div>
            </div>
        )}
      </div>

      <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="absolute top-12 right-12 z-[60] w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] shadow-2xl flex items-center justify-center hover:scale-110 transition-all text-2xl ring-4 ring-white shadow-indigo-500/10">{isPanelOpen ? '×' : '⚙️'}</button>
    </div>
  );
};

export default NetworkGraph;
