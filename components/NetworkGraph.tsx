
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { BibEntry, GraphNode, GraphLink, NodeSizeMetric, NetworkConfig, ResearchBlueprint, LayoutType, EdgeType } from '../types';

interface NetworkGraphProps {
  data: BibEntry[];
  customColumns: string[];
  blueprint: ResearchBlueprint | null;
  onDataUpdate: (newEntries: BibEntry[]) => void;
}

const CATEGORY_COLORS = d3.schemeTableau10;
const EDGE_COLORS: Record<EdgeType, string> = {
    TRANSLATION: '#6366f1',
    PUBLICATION: '#10b981',
    COLLABORATION: '#f59e0b',
    GEOGRAPHIC: '#94a3b8',
    LINGUISTIC: '#ec4899',
    CUSTOM: '#cbd5e1'
};

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, customColumns }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'topology' | 'viz' | 'sna'>('topology');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [layout, setLayout] = useState<LayoutType>('force');
  
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

  const handleExport = (format: 'svg' | 'png' | 'csv') => {
    if (!svgRef.current) return;

    if (format === 'csv') {
      const headers = ['ID', 'Name', 'Type', 'In-Degree', 'Out-Degree', 'Total-Degree', 'Betweenness', 'Closeness', 'PageRank'];
      const rows = graphData.nodes.map(n => [
        n.id, n.name, n.group, n.inDegree, n.outDegree, n.degree, n.betweenness.toFixed(6), n.closeness.toFixed(6), n.pageRank.toFixed(6)
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `network-metrics-${Date.now()}.csv`);
      link.click();
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement("canvas");
    const svgSize = svgRef.current.getBoundingClientRect();
    canvas.width = svgSize.width * 2;
    canvas.height = svgSize.height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (format === 'svg') {
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `network-analysis-${Date.now()}.svg`;
      link.click();
    } else {
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = pngUrl;
        link.download = `network-analysis-${Date.now()}.png`;
        link.click();
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  const availableAttributes = useMemo(() => [
    { id: 'authorName', label: 'Author / 著者' },
    { id: 'translatorName', label: 'Translator / 译者' },
    { id: 'publisher', label: 'Publisher / 出版社' },
    { id: 'city', label: 'City / 城市' },
    { id: 'sourceLanguage', label: 'Source Lang / 源语' },
    { id: 'targetLanguage', label: 'Target Lang / 目标语' },
    ...customColumns.map(c => ({ id: `custom:${c}`, label: c }))
  ], [customColumns]);

  const toggleEdgeType = (type: EdgeType) => {
    setConfig(prev => ({
        ...prev,
        enabledEdgeTypes: prev.enabledEdgeTypes.includes(type) 
            ? prev.enabledEdgeTypes.filter(t => t !== type)
            : [...prev.enabledEdgeTypes, type]
    }));
  };

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
              degree: 0, inDegree: 0, outDegree: 0, betweenness: 0, closeness: 0, eigenvector: 0, pageRank: 1.0, clustering: 0, modularity: 0, community: 0
            });
          }
        }
      });

      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const sId = entities[i].id;
          const tId = entities[j].id;
          const type = determineEdgeType(entities[i].type, entities[j].type);
          
          if (!config.enabledEdgeTypes.includes(type)) continue;
          if (sId === tId) continue;

          const key = config.isDirected ? `${sId}->${tId}` : (sId < tId ? `${sId}|${tId}` : `${tId}|${sId}`);
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

    const adjacency = new Map<string, string[]>();
    nodeList.forEach(n => adjacency.set(n.id, []));
    linkList.forEach(l => {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      adjacency.get(s)?.push(t);
      if (!config.isDirected) adjacency.get(t)?.push(s);
    });

    // SNA Logic
    linkList.forEach(l => {
      const sId = typeof l.source === 'string' ? l.source : l.source.id;
      const tId = typeof l.target === 'string' ? l.target : l.target.id;
      const s = nodesMap.get(sId);
      const t = nodesMap.get(tId);
      if (s && t) {
          s.outDegree++; t.inDegree++; s.degree++; t.degree++;
      }
    });

    // Closeness
    nodeList.forEach(v => {
      const dists = new Map<string, number>();
      const queue = [v.id];
      dists.set(v.id, 0);
      let totalDist = 0;
      let reachable = 0;
      while (queue.length > 0) {
          const curr = queue.shift()!;
          const d = dists.get(curr)!;
          if (d > 0) { totalDist += d; reachable++; }
          (adjacency.get(curr) || []).forEach(n => {
              if (!dists.has(n)) { dists.set(n, d + 1); queue.push(n); }
          });
      }
      v.closeness = reachable > 0 ? (reachable / totalDist) : 0;
    });

    // Betweenness (Brandes)
    nodeList.forEach(n => n.betweenness = 0);
    nodeList.forEach(s => {
      const S: string[] = [];
      const P = new Map<string, string[]>();
      nodeList.forEach(n => P.set(n.id, []));
      const sigma = new Map<string, number>();
      const d = new Map<string, number>();
      nodeList.forEach(n => { sigma.set(n.id, 0); d.set(n.id, -1); });
      sigma.set(s.id, 1); d.set(s.id, 0);
      const Q = [s.id];
      while (Q.length > 0) {
        const v = Q.shift()!;
        S.push(v);
        (adjacency.get(v) || []).forEach(w => {
          if (d.get(w) === -1) { d.set(w, d.get(v)! + 1); Q.push(w); }
          if (d.get(w) === d.get(v)! + 1) {
            sigma.set(w, sigma.get(w)! + sigma.get(v)!);
            P.get(w)!.push(v);
          }
        });
      }
      const delta = new Map<string, number>();
      nodeList.forEach(n => delta.set(n.id, 0));
      while (S.length > 0) {
        const w = S.pop()!;
        P.get(w)!.forEach(v => {
          delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
        });
        if (w !== s.id) {
          const node = nodesMap.get(w);
          if (node) node.betweenness += delta.get(w)!;
        }
      }
    });

    // PageRank
    const damping = 0.85;
    for (let i = 0; i < 15; i++) {
        const nextPR = new Map<string, number>();
        nodeList.forEach(n => nextPR.set(n.id, (1 - damping) / nodeList.length));
        nodeList.forEach(n => {
            const out = adjacency.get(n.id) || [];
            if (out.length > 0) {
                const share = (n.pageRank * damping) / out.length;
                out.forEach(neighbor => nextPR.set(neighbor, (nextPR.get(neighbor) || 0) + share));
            } else {
                const share = (n.pageRank * damping) / nodeList.length;
                nodeList.forEach(m => nextPR.set(m.id, (nextPR.get(m.id) || 0) + share));
            }
        });
        nodeList.forEach(n => n.pageRank = nextPR.get(n.id) || 0);
    }

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

    const sim = d3.forceSimulation(graphData.nodes as any);
    
    // Default forces
    sim.force("link", d3.forceLink(graphData.links).id((d: any) => d.id).distance(150))
       .force("charge", d3.forceManyBody().strength(-800))
       .force("center", d3.forceCenter(centerX, centerY))
       .force("collide", d3.forceCollide().radius(d => 25 + (d as any).degree * 2));

    if (layout === 'radial') {
        const maxRadius = Math.min(centerX, centerY) * 0.9;
        // Use PageRank or Degree to determine distance from center
        const extent = d3.extent(graphData.nodes, n => n.pageRank) as [number, number];
        const radiusScale = d3.scaleLinear().domain(extent).range([maxRadius, 50]);
        
        sim.force("radial", d3.forceRadial(d => radiusScale((d as any).pageRank), centerX, centerY).strength(0.8));
        sim.force("center", null); // Remove center force to allow radial to take over
    } else if (layout === 'clustered') {
        const groups = Array.from(new Set(graphData.nodes.map(n => n.group)));
        const groupCenters: Record<string, {x: number, y: number}> = {};
        groups.forEach((g, i) => {
            const angle = (i / groups.length) * 2 * Math.PI;
            groupCenters[g] = {
                x: centerX + Math.cos(angle) * (centerX * 0.5),
                y: centerY + Math.sin(angle) * (centerY * 0.5)
            };
        });
        
        sim.force("x", d3.forceX((d: any) => groupCenters[d.group].x).strength(0.5));
        sim.force("y", d3.forceY((d: any) => groupCenters[d.group].y).strength(0.5));
    }

    const link = g.append("g").selectAll("line").data(graphData.links).join("line")
      .attr("stroke", d => EDGE_COLORS[d.type])
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", d => Math.sqrt(d.weight) * 3);

    const node = g.append("g").selectAll("g").data(graphData.nodes).join("g")
      .call(d3.drag<any, any>()
        .on("start", (e, d) => { if(!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if(!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    // Fix for Error: Type 'unknown' cannot be used as an index type.
    // Explicitly casting metricKey to any ensures it's treated as a valid index for any-casted data objects.
    const getRadius = (d: any) => {
        if (sizeBy === 'uniform') return (minSize + maxSize) / 2;
        const metricKey: any = sizeBy;
        const extent = d3.extent(graphData.nodes, n => (n as any)[metricKey] as number) as [number, number];
        const scale = d3.scaleSqrt().domain(extent[0] === extent[1] ? [0, extent[1] || 1] : extent).range([minSize, maxSize]);
        return scale((d as any)[metricKey]);
    };

    node.append("circle")
      .attr("r", (d: any) => getRadius(d))
      // Fix: casting to any to avoid potential unknown inference in nested D3 calls
      .attr("fill", (d: any) => CATEGORY_COLORS[availableAttributes.findIndex(a => a.id === d.group) % 10])
      .attr("stroke", (d: any) => selectedNode?.id === d.id ? "#6366f1" : "#fff")
      .attr("stroke-width", (d: any) => selectedNode?.id === d.id ? 6 : 3)
      .attr("class", "cursor-pointer")
      .on("click", (e, d) => { e.stopPropagation(); setSelectedNode(d); });

    if (showLabels) {
      node.append("text")
        .attr("dy", (d: any) => getRadius(d) + 25).attr("text-anchor", "middle")
        .text((d: any) => d.name)
        .attr("class", "text-[11px] font-bold fill-slate-500 pointer-events-none serif");
    }

    sim.on("tick", () => {
      link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y).attr("x2", (d:any) => d.target.x).attr("y2", (d:any) => d.target.y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [graphData, dimensions, isPanelOpen, sizeBy, minSize, maxSize, showLabels, selectedNode, layout]);

  return (
    <div ref={containerRef} className="flex-1 w-full h-full bg-[#fdfdfe] relative flex overflow-hidden select-none">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"></svg>
      
      {/* LEGEND BOTTOM LEFT */}
      <div className="absolute bottom-12 left-12 flex flex-col gap-4 bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl z-40 ring-1 ring-slate-100">
        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Relationship Types / 关系界定</h5>
        {(Object.entries(EDGE_COLORS) as [EdgeType, string][]).map(([type, color]) => (
            <button key={type} onClick={() => toggleEdgeType(type)} className={`flex items-center gap-4 transition-all hover:scale-105 ${config.enabledEdgeTypes.includes(type) ? 'opacity-100' : 'opacity-20'}`}>
                <div className="w-8 h-1.5 rounded-full shadow-sm" style={{ backgroundColor: color }}></div>
                <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-600">{type}</span>
            </button>
        ))}
      </div>

      {!isPanelOpen && (
          <button onClick={() => setIsPanelOpen(true)} className="absolute top-12 right-12 z-[60] w-16 h-16 bg-white border border-slate-200 text-slate-900 rounded-[1.5rem] shadow-2xl flex items-center justify-center hover:scale-110 transition-all text-2xl ring-4 ring-white">⚙️</button>
      )}

      <div className={`absolute top-0 right-0 h-full w-[380px] bg-white/95 backdrop-blur-2xl border-l border-slate-100 shadow-2xl transition-transform duration-500 z-50 flex flex-col ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-6 bg-slate-50 border-b border-slate-100 shrink-0">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Network Lab Control</h3>
            <button onClick={() => setIsPanelOpen(false)} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all shadow-sm leading-none">&times;</button>
        </div>

        <div className="flex bg-white border-b border-slate-100 p-2 shrink-0">
            {[{id:'topology',label:'Topology'},{id:'viz',label:'Viz'},{id:'sna',label:'Export'}].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-xl ${activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                    {t.label}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
            {activeTab === 'topology' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Layout Engine</h4>
                        <select value={layout} onChange={e => setLayout(e.target.value as any)} className="w-full p-5 bg-slate-900 text-white rounded-[1.5rem] border-none text-[11px] font-bold uppercase outline-none shadow-xl">
                            <option value="force">Force Directed / 引力布局</option>
                            <option value="radial">Radial Hubs / 径向布局</option>
                            <option value="clustered">Clustered Roles / 聚类布局</option>
                        </select>
                    </section>
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Participating Entities</h4>
                        <div className="flex flex-wrap gap-2.5">
                            {availableAttributes.map(attr => (
                                <button key={attr.id} onClick={() => {
                                    const next = config.selectedNodeAttrs.includes(attr.id) ? config.selectedNodeAttrs.filter(x => x !== attr.id) : [...config.selectedNodeAttrs, attr.id];
                                    setConfig({...config, selectedNodeAttrs: next});
                                }} className={`px-5 py-2.5 rounded-full text-[11px] font-bold border transition-all ${config.selectedNodeAttrs.includes(attr.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                    {attr.label}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'viz' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Scale Nodes By</h4>
                        <select value={sizeBy} onChange={e => setSizeBy(e.target.value as any)} className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none text-[11px] font-bold uppercase outline-none shadow-inner text-indigo-600">
                           <option value="uniform">Uniform / 统一</option>
                           <option value="degree">Degree Centrality / 度</option>
                           <option value="betweenness">Betweenness / 介数</option>
                           <option value="pageRank">PageRank / 声望</option>
                        </select>
                    </section>
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Size Bounds</h4>
                        <div className="grid grid-cols-2 gap-6">
                           <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase text-slate-300">Min: {minSize}</label>
                              <input type="range" min="10" max="40" value={minSize} onChange={e => setMinSize(parseInt(e.target.value))} className="w-full accent-indigo-600" />
                           </div>
                           <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase text-slate-300">Max: {maxSize}</label>
                              <input type="range" min="40" max="150" value={maxSize} onChange={e => setMaxSize(parseInt(e.target.value))} className="w-full accent-indigo-600" />
                           </div>
                        </div>
                    </section>
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Labels</h4>
                        <div className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.5rem]">
                           <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tighter">Show Annotations</span>
                           <button onClick={() => setShowLabels(!showLabels)} className={`w-14 h-7 rounded-full transition-all relative ${showLabels ? 'bg-indigo-600 shadow-lg' : 'bg-slate-300'}`}>
                              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${showLabels ? 'left-8' : 'left-1'}`}></div>
                           </button>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'sna' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Export Laboratory Results</h4>
                        <div className="grid grid-cols-1 gap-3">
                          <button onClick={() => handleExport('svg')} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"><span>📥</span> Export SVG</button>
                          <button onClick={() => handleExport('png')} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"><span>🖼️</span> Export PNG</button>
                          <button onClick={() => handleExport('csv')} className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"><span>📊</span> Export Metrics (CSV)</button>
                        </div>
                    </section>
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Centrality Rank (PageRank)</h4>
                        <div className="space-y-2">
                           {graphData.nodes.sort((a,b) => b.pageRank - a.pageRank).slice(0, 8).map((n, i) => (
                              <div key={n.id} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-[1.2rem] shadow-sm">
                                 <span className="text-[10px] font-black text-slate-300">#{i+1}</span>
                                 <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-slate-800 truncate serif">{n.name}</p>
                                    <p className="text-[8px] uppercase text-indigo-400 font-black tracking-tighter">PR: {n.pageRank.toFixed(4)}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                    </section>
                </div>
            )}
        </div>

        {selectedNode && (
            <div className="m-8 p-10 bg-slate-900 text-white rounded-[3.5rem] shadow-3xl space-y-6 animate-slideUp relative flex-shrink-0 overflow-hidden ring-4 ring-indigo-500/20">
                <button onClick={() => setSelectedNode(null)} className="absolute top-8 right-10 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white text-3xl font-light hover:bg-rose-500 transition-all leading-none z-20">&times;</button>
                <div className="space-y-1 relative z-10">
                    <p className="text-[9px] uppercase text-indigo-400 tracking-[0.4em] font-black">{selectedNode.group}</p>
                    <h4 className="text-3xl font-bold serif leading-tight tracking-tight">{selectedNode.name}</h4>
                </div>
                <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                        <p className="text-[7px] uppercase text-slate-500 mb-1 tracking-widest font-black">In-Degree</p>
                        <p className="text-xl font-bold serif text-indigo-300">{selectedNode.inDegree}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                        <p className="text-[7px] uppercase text-slate-500 mb-1 tracking-widest font-black">Out-Degree</p>
                        <p className="text-xl font-bold serif text-emerald-300">{selectedNode.outDegree}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                        <p className="text-[7px] uppercase text-slate-500 mb-1 tracking-widest font-black">Betweenness</p>
                        <p className="text-xl font-bold serif">{selectedNode.betweenness.toFixed(2)}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                        <p className="text-[7px] uppercase text-slate-500 mb-1 tracking-widest font-black">Closeness</p>
                        <p className="text-xl font-bold serif">{selectedNode.closeness.toFixed(3)}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-3xl text-center col-span-2 border border-indigo-500/20 py-6 mt-2">
                        <p className="text-[8px] uppercase text-indigo-400 mb-1 tracking-[0.3em] font-black">PageRank Importance</p>
                        <p className="text-2xl font-bold serif text-white">{selectedNode.pageRank.toFixed(5)}</p>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default NetworkGraph;
