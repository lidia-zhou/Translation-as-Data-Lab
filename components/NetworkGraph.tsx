
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as XLSX from 'xlsx';
import { BibEntry, GraphNode, GraphLink, AdvancedGraphMetrics, NodeSizeMetric, NetworkConfig, ResearchBlueprint, LayoutType, ColorMode } from '../types';

interface NetworkGraphProps {
  data: BibEntry[];
  customColumns: string[];
  blueprint: ResearchBlueprint | null;
  onDataUpdate: (newEntries: BibEntry[]) => void;
}

const CATEGORY_COLORS = d3.schemeTableau10;
const COMMUNITY_COLORS = d3.schemeObservable10;

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, customColumns, blueprint }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'topology' | 'viz' | 'sna'>('topology');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [layoutType, setLayoutType] = useState<LayoutType>('forceAtlas2');

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

  const [config, setConfig] = useState<NetworkConfig>({
    selectedNodeAttrs: ['authorName', 'translatorName'], 
    isDirected: true,
    edgeWeightBy: 'frequency',
    colorMode: 'category'
  });

  const [sizeBy, setSizeBy] = useState<NodeSizeMetric>('degree');
  const [minSize, setMinSize] = useState(12);
  const [maxSize, setMaxSize] = useState(60);
  const [showLabels, setShowLabels] = useState(true);

  const availableAttributes = useMemo(() => [
    { id: 'authorName', label: 'Author / 著者' },
    { id: 'translatorName', label: 'Translator / 译者' },
    { id: 'publisher', label: 'Publisher / 出版社' },
    { id: 'city', label: 'City / 城市' },
    { id: 'sourceLanguage', label: 'Source Lang / 源语' },
    { id: 'targetLanguage', label: 'Target Lang / 目标语' },
    ...customColumns.map(c => ({ id: `custom:${c}`, label: c }))
  ], [customColumns]);

  const graph = useMemo(() => {
    const nodesMap = new Map<string, GraphNode>();
    const linkMap = new Map<string, { weight: number, entries: BibEntry[] }>();

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

    data.forEach(entry => {
      const orderedEntities: {id: string, name: string, type: string}[] = [];
      config.selectedNodeAttrs.forEach(attr => {
        const val = getAttrValue(entry, attr);
        if (val && val !== 'Unknown' && val !== 'N/A' && val.trim() !== '') {
          const id = `${attr}:${val}`;
          orderedEntities.push({ id, name: val, type: attr });
          if (!nodesMap.has(id)) {
            nodesMap.set(id, { 
              id, name: val, group: attr, val: 10,
              degree:0, inDegree:0, outDegree:0, betweenness:0, closeness:0, eigenvector:0, pageRank:0, clustering:0, modularity:0, community: 0
            });
          }
        }
      });

      for (let i = 0; i < orderedEntities.length; i++) {
        for (let j = i + 1; j < orderedEntities.length; j++) {
          const s = orderedEntities[i].id;
          const t = orderedEntities[j].id;
          if (s === t) continue;
          const key = config.isDirected ? `${s}->${t}` : (s < t ? `${s}|${t}` : `${t}|${s}`);
          if (!linkMap.has(key)) linkMap.set(key, { weight: 0, entries: [] });
          const l = linkMap.get(key)!;
          l.weight++;
          l.entries.push(entry);
        }
      }
    });

    const nodeList = Array.from(nodesMap.values());
    const linkList: GraphLink[] = Array.from(linkMap.entries()).map(([key, obj]) => {
      const parts = config.isDirected ? key.split('->') : key.split('|');
      return { source: parts[0], target: parts[1], weight: obj.weight };
    });

    if (nodeList.length === 0) return { nodes: [], links: [], metrics: null };

    const n = nodeList.length;
    const nodeToIndex = new Map(nodeList.map((node, i) => [node.id, i]));
    const adj = Array.from({ length: n }, () => [] as number[]);
    const inAdj = Array.from({ length: n }, () => [] as number[]);
    
    linkList.forEach(l => {
      const s = nodeToIndex.get(typeof l.source === 'string' ? l.source : l.source.id)!;
      const t = nodeToIndex.get(typeof l.target === 'string' ? l.target : l.target.id)!;
      adj[s].push(t);
      inAdj[t].push(s);
      if (!config.isDirected) {
        adj[t].push(s);
        inAdj[s].push(t);
      }
    });

    // SNA Metrics
    nodeList.forEach((node, i) => {
      node.outDegree = adj[i].length;
      node.inDegree = inAdj[i].length;
      node.degree = config.isDirected ? node.outDegree + node.inDegree : node.outDegree;
    });

    // Community Detection: Label Propagation Algorithm
    let labels = nodeList.map((_, i) => i);
    const maxIters = 30;
    for (let iter = 0; iter < maxIters; iter++) {
      let changed = false;
      const order = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
      for (const i of order) {
        const neighbors = Array.from(new Set([...adj[i], ...inAdj[i]]));
        if (neighbors.length === 0) continue;
        const counts: Record<number, number> = {};
        neighbors.forEach(neighIdx => {
          const l = labels[neighIdx];
          counts[l] = (counts[l] || 0) + 1;
        });
        let maxFreq = -1;
        let bestLabels: number[] = [];
        for (const l in counts) {
          if (counts[l] > maxFreq) { maxFreq = counts[l]; bestLabels = [parseInt(l)]; }
          else if (counts[l] === maxFreq) { bestLabels.push(parseInt(l)); }
        }
        const newLabel = bestLabels[Math.floor(Math.random() * bestLabels.length)];
        if (newLabel !== labels[i]) {
          labels[i] = newLabel;
          changed = true;
        }
      }
      if (!changed) break;
    }
    const labelMapping = new Map<number, number>();
    let labelCount = 0;
    labels.forEach(l => {
      if (!labelMapping.has(l)) labelMapping.set(l, labelCount++);
    });
    nodeList.forEach((node, i) => node.community = labelMapping.get(labels[i])!);

    // Other metrics (Betweenness etc) omitted for brevity as they are already in state...
    // Re-calculating essential SNA metrics
    const betweenness = new Array(n).fill(0);
    for (let s = 0; s < n; s++) {
      const stack: number[] = [];
      const P = Array.from({ length: n }, () => [] as number[]);
      const sigma = new Array(n).fill(0); sigma[s] = 1;
      const d = new Array(n).fill(-1); d[s] = 0;
      const queue: number[] = [s];
      while (queue.length > 0) {
        const v = queue.shift()!;
        stack.push(v);
        for (const w of adj[v]) {
          if (d[w] < 0) { queue.push(w); d[w] = d[v] + 1; }
          if (d[w] === d[v] + 1) { sigma[w] += sigma[v]; P[w].push(v); }
        }
      }
      const delta = new Array(n).fill(0);
      while (stack.length > 0) {
        const w = stack.pop()!;
        for (const v of P[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        if (w !== s) betweenness[w] += delta[w];
      }
    }
    nodeList.forEach((node, i) => node.betweenness = config.isDirected ? betweenness[i] : betweenness[i] / 2);

    let ev = new Array(n).fill(1);
    for (let iter = 0; iter < 20; iter++) {
      const nextEv = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (const j of adj[i]) nextEv[j] += ev[i];
        if (!config.isDirected) for (const j of inAdj[i]) nextEv[j] += ev[i];
      }
      const norm = Math.sqrt(nextEv.reduce((sum, v) => sum + v * v, 0)) || 1;
      ev = nextEv.map(v => v / norm);
    }
    nodeList.forEach((node, i) => node.eigenvector = ev[i]);

    const communityCounts: Record<number, string[]> = {};
    nodeList.forEach(node => {
        if (!communityCounts[node.community]) communityCounts[node.community] = [];
        communityCounts[node.community].push(node.name);
    });

    const metrics: AdvancedGraphMetrics = {
      nodeCount: nodeList.length,
      edgeCount: linkList.length,
      density: nodeList.length > 1 ? linkList.length / (nodeList.length * (nodeList.length - 1)) : 0,
      avgDegree: nodeList.length > 0 ? (linkList.length * 2) / nodeList.length : 0,
      avgPathLength: 0, diameter: 0, 
      avgClustering: 0, modularityScore: 0,
      topNodes: {
        'Betweenness (Mediators)': [...nodeList].sort((a,b) => b.betweenness - a.betweenness).slice(0, 5).map(n => ({name: n.name, score: n.betweenness, type: n.group})),
        'Eigenvector (Prestige)': [...nodeList].sort((a,b) => b.eigenvector - a.eigenvector).slice(0, 5).map(n => ({name: n.name, score: n.eigenvector, type: n.group})),
        'Degree (Activity)': [...nodeList].sort((a,b) => b.degree - a.degree).slice(0, 5).map(n => ({name: n.name, score: n.degree, type: n.group}))
      },
      communities: Object.entries(communityCounts)
        .map(([id, members]) => ({ id: parseInt(id), count: members.length, members: members.slice(0, 5) }))
        .sort((a,b) => b.count - a.count)
    };

    return { nodes: nodeList, links: linkList, metrics };
  }, [data, config]);

  useEffect(() => {
    if (!svgRef.current || graph.nodes.length === 0 || dimensions.width === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", dimensions.width).attr("height", dimensions.height);

    svg.append("defs").append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "-0 -5 10 10")
        .attr("refX", 30).attr("refY", 0)
        .attr("orient", "auto")
        .attr("markerWidth", 5).attr("markerHeight", 5)
        .append("svg:path").attr("d", "M 0,-5 L 10 ,0 L 0,5").attr("fill", "#cbd5e1");

    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, any>().scaleExtent([0.05, 15]).on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    const getRadius = (n: GraphNode) => {
      if (sizeBy === 'uniform') return (minSize + maxSize) / 2;
      const val = (n as any)[sizeBy] || 0;
      const domain = d3.extent(graph.nodes, d => (d as any)[sizeBy] as number) as [number, number];
      const scale = d3.scaleSqrt().domain(domain[0] === domain[1] ? [0, domain[1] || 1] : domain).range([minSize, maxSize]);
      return scale(val);
    };

    const visualCenterX = (dimensions.width - (isPanelOpen ? 420 : 0)) / 2;
    const visualCenterY = dimensions.height / 2;

    const sim = d3.forceSimulation(graph.nodes);
    if (layoutType === 'circular') {
      const radius = Math.min(visualCenterX, visualCenterY) * 0.7;
      graph.nodes.forEach((node, i) => {
        const angle = (i / graph.nodes.length) * 2 * Math.PI;
        node.x = visualCenterX + radius * Math.cos(angle);
        node.y = visualCenterY + radius * Math.sin(angle);
      });
      sim.stop();
    } else {
      sim.force("link", d3.forceLink<GraphNode, GraphLink>(graph.links).id(d => d.id).distance(layoutType === 'forceAtlas2' ? 300 : 180))
         .force("charge", d3.forceManyBody().strength(layoutType === 'forceAtlas2' ? -2500 : -800))
         .force("center", d3.forceCenter(visualCenterX, visualCenterY))
         .force("collide", d3.forceCollide().radius(d => getRadius(d as GraphNode) + 25));
    }

    const link = g.append("g")
      .selectAll("path")
      .data(graph.links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", d => Math.sqrt(d.weight) * 2.5)
      .attr("marker-end", config.isDirected ? "url(#arrowhead)" : null);

    const node = g.append("g")
      .selectAll("g")
      .data(graph.nodes)
      .join("g")
      .call(layoutType !== 'circular' ? d3.drag<any, any>()
        .on("start", (e, d) => { if(!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if(!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }) : () => {});

    node.append("circle")
      .attr("r", d => getRadius(d))
      .attr("fill", d => config.colorMode === 'category' 
        ? CATEGORY_COLORS[availableAttributes.findIndex(a => a.id === d.group) % 10]
        : COMMUNITY_COLORS[d.community % 10])
      .attr("stroke", "#fff").attr("stroke-width", 3)
      .attr("class", "shadow-xl cursor-pointer hover:stroke-indigo-500 transition-all")
      .on("click", (e, d) => { e.stopPropagation(); setSelectedNode(d); });

    if (showLabels) {
      node.append("text")
        .attr("dy", d => getRadius(d) + 24).attr("text-anchor", "middle")
        .text(d => d.name)
        .attr("class", "text-[11px] font-bold fill-slate-500 pointer-events-none serif");
    }

    const updatePositions = () => {
      link.attr("d", (d: any) => {
          const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y, dr = Math.sqrt(dx * dx + dy * dy);
          return config.isDirected ? `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}` : `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
      });
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    };

    if (layoutType === 'circular') updatePositions(); else sim.on("tick", updatePositions);

    return () => sim.stop();
  }, [graph, config, sizeBy, minSize, maxSize, showLabels, dimensions, isPanelOpen, layoutType]);

  const exportAsPNG = () => {
    if (!svgRef.current) return;
    setIsExporting(true);
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    const style = document.createElement('style');
    style.textContent = `.serif { font-family: 'Crimson Pro', serif; } text { font-family: 'Inter', sans-serif; fill: #64748b; font-weight: 700; }`;
    svgClone.prepend(style);
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = dimensions.width * scale; canvas.height = dimensions.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `translatio-network-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setIsExporting(false);
    };
    img.src = url;
  };

  const exportMetricsAsExcel = () => {
    if (!graph.nodes.length) return;
    const exportData = graph.nodes.map(n => ({
      ID: n.id, Name: n.name, Type: n.group, Community: n.community,
      'Degree': n.degree, 'In-Degree': n.inDegree, 'Out-Degree': n.outDegree,
      'Betweenness': n.betweenness.toFixed(4), 'Eigenvector': n.eigenvector.toFixed(6)
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SNA Metrics");
    XLSX.writeFile(wb, `translatio-sna-metrics-${Date.now()}.xlsx`);
  };

  return (
    <div ref={containerRef} className="flex-1 w-full h-full bg-[#fdfdfe] relative flex overflow-hidden">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"></svg>

      <div className={`absolute top-0 right-0 h-full w-[420px] bg-white/95 backdrop-blur-2xl border-l border-slate-100 shadow-2xl transition-transform duration-500 z-50 flex flex-col ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex bg-slate-50/50 border-b border-slate-100 p-2">
            {[{id:'topology',label:'Structure'},{id:'viz',label:'Appearance'},{id:'sna',label:'SNA Metrics'}].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 py-4 text-[8px] font-black uppercase tracking-[0.2em] transition-all rounded-xl ${activeTab === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    {t.label}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
            {activeTab === 'topology' && (
                <div className="space-y-8 animate-fadeIn">
                    <section className="space-y-5">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Network Type</h4>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button onClick={() => setConfig({...config, isDirected: false})} className={`px-3 py-1 text-[8px] font-bold rounded-md transition-all ${!config.isDirected ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Undirected</button>
                                <button onClick={() => setConfig({...config, isDirected: true})} className={`px-3 py-1 text-[8px] font-bold rounded-md transition-all ${config.isDirected ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Directed</button>
                            </div>
                        </div>
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Layout Algorithm</h4>
                        <div className="grid grid-cols-3 gap-2">
                            {([['forceAtlas2', 'ForceAtlas2'], ['fruchterman', 'Fruchterman'], ['circular', 'Circular']] as [LayoutType, string][]).map(([type, label]) => (
                              <button key={type} onClick={() => setLayoutType(type)} className={`py-3 rounded-xl text-[8px] font-black uppercase border transition-all ${layoutType === type ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>
                                {label}
                              </button>
                            ))}
                        </div>
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Flow Chain</h4>
                        <div className="grid grid-cols-1 gap-2.5">
                            {availableAttributes.map(attr => (
                                <button key={attr.id} onClick={() => {
                                    const next = config.selectedNodeAttrs.includes(attr.id) ? config.selectedNodeAttrs.filter(x => x !== attr.id) : [...config.selectedNodeAttrs, attr.id];
                                    setConfig({...config, selectedNodeAttrs: next});
                                }} className={`p-5 rounded-2xl border-2 text-left transition-all flex justify-between items-center ${config.selectedNodeAttrs.includes(attr.id) ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-50 bg-white shadow-sm'}`}>
                                    <div className="flex items-center gap-3">
                                        {config.selectedNodeAttrs.includes(attr.id) && <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[9px] font-black">{config.selectedNodeAttrs.indexOf(attr.id) + 1}</span>}
                                        <span className={`text-[10px] font-bold ${config.selectedNodeAttrs.includes(attr.id) ? 'text-indigo-700' : 'text-slate-500'}`}>{attr.label}</span>
                                    </div>
                                    {config.selectedNodeAttrs.includes(attr.id) && <span className="text-indigo-600 text-xs">✓</span>}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'viz' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Color Palette Mode</label>
                        <div className="flex bg-slate-100 p-1 rounded-2xl">
                            <button onClick={() => setConfig({...config, colorMode: 'category'})} className={`flex-1 py-4 text-[9px] font-black uppercase rounded-xl transition-all ${config.colorMode === 'category' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>By Category</button>
                            <button onClick={() => setConfig({...config, colorMode: 'community'})} className={`flex-1 py-4 text-[9px] font-black uppercase rounded-xl transition-all ${config.colorMode === 'community' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>By Community</button>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">"By Community" uses the Label Propagation Algorithm to detect clusters of intensive cultural exchange.</p>
                    </section>
                    <section className="space-y-5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Radius Scaling Metric</label>
                        <select value={sizeBy} onChange={e => setSizeBy(e.target.value as any)} className="w-full p-5 bg-slate-50/50 rounded-2xl border border-slate-100 text-[10px] font-bold text-indigo-600 outline-none shadow-inner">
                            <option value="uniform">Uniform</option>
                            <option value="degree">Degree (Activity)</option>
                            <option value="betweenness">Betweenness (Mediator Power)</option>
                            <option value="eigenvector">Eigenvector (Prestige)</option>
                        </select>
                    </section>
                </div>
            )}

            {activeTab === 'sna' && graph.metrics && (
                <div className="space-y-10 animate-fadeIn pb-10">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-lg text-center">
                            <p className="text-[7px] font-black uppercase text-indigo-400 mb-1 tracking-widest">Network Density</p>
                            <p className="text-lg font-bold serif">{(graph.metrics.density * 100).toFixed(2)}%</p>
                        </div>
                        <div className="p-6 bg-indigo-600 text-white rounded-[2rem] shadow-lg text-center">
                            <p className="text-[7px] font-black uppercase text-indigo-200 mb-1 tracking-widest">Communities</p>
                            <p className="text-lg font-bold serif">{graph.metrics.communities.length}</p>
                        </div>
                    </div>

                    <section className="space-y-3">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 pb-2">Cultural Clusters (Detected)</h4>
                        <div className="space-y-2">
                           {graph.metrics.communities.slice(0, 5).map(c => (
                               <div key={c.id} className="p-4 bg-white border border-slate-50 rounded-2xl shadow-sm space-y-2">
                                   <div className="flex justify-between items-center">
                                       <span className="text-[10px] font-black uppercase text-slate-400">Cluster #{c.id + 1}</span>
                                       <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black rounded-lg">{c.count} Nodes</span>
                                   </div>
                                   <p className="text-[10px] text-slate-500 font-serif italic truncate">{c.members.join(', ')}...</p>
                               </div>
                           ))}
                        </div>
                    </section>

                    {Object.entries(graph.metrics.topNodes).map(([m, nodes]) => (
                        <section key={m} className="space-y-3">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 pb-2">{m}</h4>
                            <div className="space-y-2">
                                {(nodes as any[]).map((n, i) => (
                                    <div key={i} className="flex justify-between items-center p-4 bg-white border border-slate-50 rounded-xl text-[10px] shadow-sm hover:border-indigo-100 transition-all cursor-pointer" onClick={() => setSelectedNode(graph.nodes.find(node => node.name === n.name) || null)}>
                                        <div className="flex flex-col"><span className="font-bold text-slate-700 truncate max-w-[200px]">{n.name}</span><span className="text-[8px] text-slate-300 uppercase">{n.type}</span></div>
                                        <span className="font-mono text-indigo-600 font-bold px-3 py-1 bg-indigo-50 rounded-lg">{n.score.toFixed(3)}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                    <div className="pt-6 space-y-3">
                        <button onClick={exportMetricsAsExcel} className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-bold text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-600 transition-all">Export Detailed Report</button>
                        <button onClick={exportAsPNG} className="w-full py-4 bg-white border border-slate-100 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Save Visual Snapshot</button>
                    </div>
                </div>
            )}
        </div>

        {selectedNode && (
            <div className="m-8 p-8 bg-slate-900 text-white rounded-[3rem] shadow-2xl space-y-5 animate-slideUp relative flex-shrink-0">
                <button onClick={() => setSelectedNode(null)} className="absolute top-6 right-8 text-3xl font-light hover:text-rose-400 transition-colors leading-none">&times;</button>
                <div className="space-y-1"><p className="text-[8px] uppercase text-indigo-400 tracking-widest font-black">{selectedNode.group} • Cluster #{selectedNode.community + 1}</p><h4 className="text-xl font-bold serif leading-tight pr-10">{selectedNode.name}</h4></div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 p-4 rounded-2xl text-center"><p className="text-[7px] uppercase text-slate-500 mb-1 tracking-widest">Mediator</p><p className="text-base font-bold serif text-indigo-400">{selectedNode.betweenness.toFixed(2)}</p></div>
                    <div className="bg-white/5 p-4 rounded-2xl text-center"><p className="text-[7px] uppercase text-slate-500 mb-1 tracking-widest">Prestige</p><p className="text-base font-bold serif text-emerald-400">{selectedNode.eigenvector.toFixed(4)}</p></div>
                    <div className="bg-white/5 p-4 rounded-2xl text-center"><p className="text-[7px] uppercase text-slate-500 mb-1 tracking-widest">Tot. Degree</p><p className="text-base font-bold serif text-slate-300">{selectedNode.degree}</p></div>
                    <div className="bg-white/5 p-4 rounded-2xl text-center"><p className="text-[7px] uppercase text-slate-500 mb-1 tracking-widest">Clustering</p><p className="text-base font-bold serif text-amber-400">{selectedNode.clustering.toFixed(3)}</p></div>
                </div>
            </div>
        )}
      </div>

      <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="absolute top-10 right-10 z-[60] w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-xl ring-4 ring-white">{isPanelOpen ? '×' : '⚙️'}</button>
    </div>
  );
};

export default NetworkGraph;
