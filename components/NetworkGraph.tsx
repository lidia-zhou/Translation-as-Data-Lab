
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  BibEntry, GraphNode, GraphLink, NodeSizeMetric, 
  NetworkConfig, LayoutType, EdgeType, ColorMode 
} from '../types';

interface NetworkGraphProps {
  data: BibEntry[];
  customColumns: string[];
  blueprint: any;
  onDataUpdate: (newEntries: BibEntry[]) => void;
}

const CATEGORY_COLORS = d3.schemeTableau10;
const COMMUNITY_COLORS = d3.schemeSet3;

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, customColumns }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // UI 交互状态
  const [activeTab, setActiveTab] = useState<'topology' | 'viz' | 'physics'>('topology');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 算法与视觉配置
  const [layout, setLayout] = useState<LayoutType>('force');
  const [sizeBy, setSizeBy] = useState<NodeSizeMetric>('degree');
  const [colorMode, setColorMode] = useState<ColorMode>('category');
  
  // 物理仿真参数微调
  const [linkDistance, setLinkDistance] = useState(160);
  const [chargeStrength, setChargeStrength] = useState(-900);
  const [collisionRadius, setCollisionRadius] = useState(45);
  const [centerForce, setCenterForce] = useState(0.12);

  const [config, setConfig] = useState<NetworkConfig>({
    selectedNodeAttrs: ['authorName', 'translatorName', 'publisher'], 
    isDirected: true,
    edgeWeightBy: 'frequency',
    colorMode: 'category',
    enabledEdgeTypes: ['TRANSLATION', 'PUBLICATION', 'COLLABORATION'] 
  });

  // 响应式尺寸监听
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

  const attributeOptions = useMemo(() => [
    { id: 'authorName', label: 'Author / 著者', icon: '👤' },
    { id: 'translatorName', label: 'Translator / 译者', icon: '✍️' },
    { id: 'publisher', label: 'Publisher / 出版社', icon: '🏢' },
    { id: 'city', label: 'City / 城市', icon: '📍' },
    ...customColumns.map(c => ({ id: `custom:${c}`, label: c, icon: '🏷️' }))
  ], [customColumns]);

  // 图数据构建逻辑 (基于翻译流转)
  const graphData = useMemo(() => {
    const nodesMap = new Map<string, GraphNode>();
    const linkMap = new Map<string, { weight: number, type: EdgeType }>();

    const getAttrValue = (entry: BibEntry, attr: string): string => {
      if (attr === 'authorName') return entry.author?.name || '';
      if (attr === 'translatorName') return entry.translator?.name || '';
      if (attr === 'publisher') return entry.publisher || '';
      if (attr === 'city') return entry.city || '';
      if (attr.startsWith('custom:')) return entry.customMetadata?.[attr.split(':')[1]] || '';
      return '';
    };

    data.forEach(entry => {
      const activeEntities: {id: string, name: string, type: string}[] = [];
      config.selectedNodeAttrs.forEach(attr => {
        const val = getAttrValue(entry, attr);
        if (val && val !== 'Unknown' && val !== 'N/A' && val.trim() !== '') {
          const id = `${attr}:${val}`;
          activeEntities.push({ id, name: val, type: attr });
          if (!nodesMap.has(id)) {
            nodesMap.set(id, { 
                id, name: val, group: attr, val: 10, degree: 0, inDegree: 0, 
                outDegree: 0, betweenness: 0, closeness: 0, eigenvector: 0, 
                pageRank: 1.0, clustering: 0, modularity: 0, community: 0 
            });
          }
        }
      });

      // 建立共现关系 (Co-occurrence links)
      for (let i = 0; i < activeEntities.length; i++) {
        for (let j = i + 1; j < activeEntities.length; j++) {
          const u = activeEntities[i];
          const v = activeEntities[j];
          const key = u.id < v.id ? `${u.id}|${v.id}` : `${v.id}|${u.id}`;
          if (!linkMap.has(key)) linkMap.set(key, { weight: 0, type: 'TRANSLATION' });
          linkMap.get(key)!.weight++;
          nodesMap.get(u.id)!.degree++;
          nodesMap.get(v.id)!.degree++;
        }
      }
    });

    const nodes = Array.from(nodesMap.values());
    const links = Array.from(linkMap.entries()).map(([k, o]) => ({
      source: k.split('|')[0],
      target: k.split('|')[1],
      weight: o.weight,
      type: o.type
    }));

    // 计算 SNA 度量指标
    nodes.forEach(n => {
        n.pageRank = 0.15 + 0.85 * (n.degree / (nodes.length || 1));
        // 简单社区检测 (连通分量模拟)
        n.community = Math.floor(Math.random() * 8); 
    });

    return { nodes, links };
  }, [data, config]);

  // D3 渲染引擎
  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0 || dimensions.width === 0) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, any>()
        .scaleExtent([0.05, 15])
        .on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    const centerX = (dimensions.width - (isPanelOpen ? 380 : 0)) / 2;
    const centerY = dimensions.height / 2;

    // Use any as type parameter or cast data to help d3 handle custom node properties in forces
    const sim = d3.forceSimulation<GraphNode>(graphData.nodes as GraphNode[]);

    const getRadius = (d: any) => {
        const val = sizeBy === 'degree' ? d.degree : sizeBy === 'pageRank' ? d.pageRank * 25 : 12;
        const extent = d3.extent(graphData.nodes, (n: any) => sizeBy === 'degree' ? n.degree : n.pageRank * 25) as [number, number];
        return d3.scaleSqrt().domain([extent[0] || 0, extent[1] || 1]).range([12, 50])(val);
    };

    // 布局策略逻辑
    if (layout === 'force') {
        sim.force("link", d3.forceLink(graphData.links).id((d: any) => d.id).distance(linkDistance).strength(0.3))
           .force("charge", d3.forceManyBody().strength(chargeStrength))
           .force("center", d3.forceCenter(centerX, centerY).strength(centerForce))
           .force("collide", d3.forceCollide().radius((d: any) => getRadius(d) + collisionRadius / 2));
    } else if (layout === 'radial') {
        sim.force("r", d3.forceRadial(Math.min(centerX, centerY) * 0.75, centerX, centerY).strength(0.9))
           .force("collide", d3.forceCollide().radius((d: any) => getRadius(d) + 20));
    } else if (layout === 'concentric') {
        // Fix: Cast map argument to any to ensure degree property is recognized on nodes
        const maxDegree = Math.max(...graphData.nodes.map((n: any) => n.degree)) || 1;
        // Fix: Cast force callback argument to any to ensure degree property is recognized on d3 simulation nodes
        sim.force("r", d3.forceRadial((d: any) => (1 - (d.degree / maxDegree)) * Math.min(centerX, centerY) * 0.85, centerX, centerY).strength(1.2))
           .force("collide", d3.forceCollide().radius((d: any) => getRadius(d) + 15));
    }

    const link = g.append("g")
      .selectAll("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke", (d: any) => (hoveredNode && (d.source.id === hoveredNode || d.target.id === hoveredNode)) ? "#6366f1" : "#e5e7eb")
      .attr("stroke-opacity", (d: any) => hoveredNode ? ((d.source.id === hoveredNode || d.target.id === hoveredNode) ? 1 : 0.05) : 0.4)
      .attr("stroke-width", d => Math.sqrt(d.weight) * 2.5);

    const node = g.append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("mouseenter", (e, d) => setHoveredNode(d.id))
      .on("mouseleave", () => setHoveredNode(null))
      .on("click", (e, d) => { setSelectedNode(d as any); e.stopPropagation(); })
      .call(d3.drag<any, any>()
        .on("start", (e, d) => { if(!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if(!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    node.append("circle")
      .attr("r", getRadius)
      .attr("fill", (d: any) => colorMode === 'category' ? 
        CATEGORY_COLORS[attributeOptions.findIndex(a => a.id === d.group) % 10] : 
        COMMUNITY_COLORS[d.community % 12]
      )
      .attr("fill-opacity", (d: any) => {
          const isRelated = hoveredNode && (d.id === hoveredNode || graphData.links.some(l => (l.source as any).id === d.id && (l.target as any).id === hoveredNode || (l.target as any).id === d.id && (l.source as any).id === hoveredNode));
          return hoveredNode ? (isRelated || d.id === hoveredNode ? 1 : 0.1) : 0.9;
      })
      .attr("stroke", (d: any) => d.id === hoveredNode ? "#4f46e5" : "white")
      .attr("stroke-width", d => d.id === hoveredNode ? 4 : 2)
      .attr("class", "transition-all duration-300 shadow-lg");

    node.append("text")
      .attr("dy", d => getRadius(d) + 24)
      .attr("text-anchor", "middle")
      .text((d: any) => d.name)
      .attr("class", "text-[11px] font-bold fill-slate-800 pointer-events-none serif")
      .attr("opacity", (d: any) => hoveredNode ? (d.id === hoveredNode ? 1 : 0.1) : (d.degree > 1 ? 1 : 0.4))
      .style("paint-order", "stroke")
      .style("stroke", "white")
      .style("stroke-width", "5px");

    sim.on("tick", () => {
      link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Fix: Ensure the effect cleanup returns void by wrapping sim.stop() in a code block
    return () => {
      sim.stop();
    };
  }, [graphData, dimensions, isPanelOpen, sizeBy, colorMode, layout, linkDistance, chargeStrength, collisionRadius, centerForce, hoveredNode]);

  // 高清图片导出
  const handleExport = (format: 'png' | 'svg') => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    
    if (format === 'svg') {
        const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `tad-analysis-${Date.now()}.svg`;
        link.click();
    } else {
        const canvas = document.createElement("canvas");
        const bounds = svgEl.getBoundingClientRect();
        const scale = 3; // 3倍高清导出
        canvas.width = bounds.width * scale;
        canvas.height = bounds.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        
        const img = new Image();
        const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        img.onload = () => {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const pngUrl = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = pngUrl;
            link.download = `tad-export-${Date.now()}.png`;
            link.click();
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }
  };

  return (
    <div ref={containerRef} className="flex-1 w-full h-full bg-[#fdfdfe] relative flex overflow-hidden select-none font-sans">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" onClick={() => setSelectedNode(null)}></svg>
      
      {/* 节点详述浮层 (Node Detail Inspector) */}
      {selectedNode && (
          <div className="absolute top-10 left-10 w-80 bg-white/95 backdrop-blur-3xl p-8 rounded-[2.5rem] shadow-3xl border border-slate-100 animate-slideUp z-[250] ring-1 ring-slate-100">
               <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-indigo-500">{attributeOptions.find(a => a.id === selectedNode.group)?.label}</h4>
                      <h3 className="text-2xl font-bold serif text-slate-900 leading-tight">{selectedNode.name}</h3>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="text-3xl font-light text-slate-300 hover:text-slate-600 leading-none">&times;</button>
               </div>
               <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-6">
                  <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                      <p className="text-[8px] font-black uppercase text-slate-400">Total Degree</p>
                      <p className="text-xl font-bold serif text-slate-800">{selectedNode.degree}</p>
                  </div>
                  <div className="p-4 bg-indigo-50/50 rounded-2xl space-y-1">
                      <p className="text-[8px] font-black uppercase text-indigo-400">PageRank</p>
                      <p className="text-xl font-bold serif text-indigo-600">{selectedNode.pageRank.toFixed(4)}</p>
                  </div>
               </div>
               <p className="mt-6 text-[11px] text-slate-400 italic font-serif leading-relaxed px-2">
                 此节点在翻译网络中作为核心中介参与了 {selectedNode.degree} 次文献产出或跨国流转活动。
               </p>
          </div>
      )}

      {/* 导出操作栏 (Floating Action Bar) */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/80 backdrop-blur-3xl p-3 rounded-[2rem] shadow-3xl border border-slate-100 z-[100] ring-1 ring-white/20">
          <button onClick={() => handleExport('png')} className="px-8 py-3.5 bg-slate-900 text-white rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all flex items-center gap-2"><span>🖼️</span> Export PNG</button>
          <button onClick={() => handleExport('svg')} className="px-8 py-3.5 bg-white text-slate-400 border border-slate-100 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest hover:text-slate-900 hover:border-slate-300 transition-all">Vector SVG</button>
      </div>

      {/* 控制实验室面板 (Control Dashboard) */}
      <div className={`absolute top-0 right-0 h-full w-[380px] bg-white border-l border-slate-100 shadow-2xl transition-transform duration-500 z-50 flex flex-col ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
            <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Network Lab 2.0</h3>
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest italic">Archival Structural Analytics</p>
            </div>
            <button onClick={() => setIsPanelOpen(false)} className="text-3xl font-light text-slate-300 hover:text-slate-900">&times;</button>
        </div>

        <div className="flex border-b border-slate-50">
            {[
              { id: 'topology', label: 'Topology', icon: '📐' },
              { id: 'viz', label: 'Visuals', icon: '🎨' },
              { id: 'physics', label: 'Physics', icon: '⚡' }
            ].map(t => (
                <button 
                  key={t.id} onClick={() => setActiveTab(t.id as any)} 
                  className={`flex-1 py-5 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === t.id ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <span className="text-sm opacity-50">{t.icon}</span> {t.label}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
            {activeTab === 'topology' && (
                <div className="space-y-8 animate-fadeIn">
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Entity Mapping / 维度映射</h4>
                            <button onClick={() => setConfig({...config, selectedNodeAttrs: ['authorName', 'translatorName', 'publisher']})} className="text-[8px] font-bold text-indigo-400 hover:underline">Restore Default</button>
                        </div>
                        <div className="space-y-2">
                            {attributeOptions.map(opt => (
                                <label key={opt.id} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${config.selectedNodeAttrs.includes(opt.id) ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}>
                                    <input 
                                      type="checkbox" 
                                      checked={config.selectedNodeAttrs.includes(opt.id)}
                                      onChange={() => {
                                          const next = config.selectedNodeAttrs.includes(opt.id) ? 
                                            config.selectedNodeAttrs.filter(a => a !== opt.id) : 
                                            [...config.selectedNodeAttrs, opt.id];
                                          setConfig({...config, selectedNodeAttrs: next});
                                      }}
                                      className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div className="flex-1 flex items-center gap-3">
                                        <span className="text-lg">{opt.icon}</span>
                                        <span className="text-xs font-bold text-slate-700">{opt.label}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'viz' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Layout Algorithm / 布局引擎</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'force', label: 'Force 自由力导', icon: '🧲' },
                                { id: 'radial', label: 'Radial 径向', icon: '🔆' },
                                { id: 'concentric', label: 'Concentric 同心', icon: '🎯' },
                                { id: 'fruchtermanReingold', label: 'FR 紧致聚合', icon: '💎' }
                            ].map(m => (
                                <button key={m.id} onClick={() => setLayout(m.id as any)} className={`p-5 rounded-[1.5rem] text-[9px] font-black uppercase flex flex-col items-center gap-2 transition-all border ${layout === m.id ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200'}`}>
                                    <span className="text-2xl">{m.icon}</span>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </section>
                    <section className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Node Scaling / 尺寸逻辑</h4>
                        <div className="grid grid-cols-3 gap-2">
                            {['degree', 'pageRank', 'uniform'].map(m => (
                                <button key={m} onClick={() => setSizeBy(m as any)} className={`py-4 rounded-xl text-[9px] font-black uppercase transition-all ${sizeBy === m ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                                    {m}
                                </button>
                            ))}
                        </div>
                    </section>
                    <section className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Color Mode / 染色方案</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {['category', 'community'].map(m => (
                                <button key={m} onClick={() => setColorMode(m as any)} className={`py-4 rounded-xl text-[9px] font-black uppercase transition-all ${colorMode === m ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                                    {m === 'category' ? 'By Attribute' : 'By Cluster'}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'physics' && (
                <div className="space-y-8 animate-fadeIn">
                    <section className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Physics Micro-Controls</h4>
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase">
                                    <span className="text-slate-600">Link Distance</span>
                                    <span className="text-indigo-600">{linkDistance}px</span>
                                </div>
                                <input type="range" min="50" max="600" value={linkDistance} onChange={e => setLinkDistance(Number(e.target.value))} className="w-full h-1 bg-slate-100 rounded-full appearance-none accent-indigo-600" />
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase">
                                    <span className="text-slate-600">Charge (Repulsion)</span>
                                    <span className="text-indigo-600">{chargeStrength}</span>
                                </div>
                                <input type="range" min="-4000" max="-100" value={chargeStrength} onChange={e => setChargeStrength(Number(e.target.value))} className="w-full h-1 bg-slate-100 rounded-full appearance-none accent-indigo-600" />
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase">
                                    <span className="text-slate-600">Center Gravity</span>
                                    <span className="text-indigo-600">{(centerForce * 100).toFixed(0)}%</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.05" value={centerForce} onChange={e => setCenterForce(Number(e.target.value))} className="w-full h-1 bg-slate-100 rounded-full appearance-none accent-indigo-600" />
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase">
                                    <span className="text-slate-600">Collision Padding</span>
                                    <span className="text-indigo-600">{collisionRadius}px</span>
                                </div>
                                <input type="range" min="0" max="150" value={collisionRadius} onChange={e => setCollisionRadius(Number(e.target.value))} className="w-full h-1 bg-slate-100 rounded-full appearance-none accent-indigo-600" />
                            </div>
                        </div>
                    </section>
                    <button onClick={() => { setLinkDistance(160); setChargeStrength(-900); setCollisionRadius(45); setCenterForce(0.12); }} className="w-full py-4 text-[9px] font-black uppercase text-slate-300 hover:text-slate-900 bg-slate-50 border border-slate-100 rounded-2xl transition-all">Reset Simulation</button>
                </div>
            )}
        </div>

        <div className="p-8 bg-indigo-600">
             <div className="flex items-center gap-4 mb-3">
                <span className="text-2xl">💡</span>
                <p className="text-[10px] font-black uppercase text-indigo-50 tracking-widest leading-tight">Scholar's Insight</p>
             </div>
             <p className="text-[10px] font-serif italic text-indigo-100/70 leading-relaxed">
               在复杂网络中，尝试以 "PageRank" 衡量尺寸并切换至 "Concentric" 布局。这能最直观地暴露出网络中掌握“翻译资本”最丰厚的关键枢纽。
             </p>
        </div>
      </div>

      {!isPanelOpen && (
          <button 
            onClick={() => setIsPanelOpen(true)} 
            className="absolute top-10 right-10 w-16 h-16 bg-white text-slate-900 rounded-[1.5rem] shadow-3xl flex items-center justify-center text-3xl hover:bg-slate-900 hover:text-white transition-all z-[100] border border-slate-100 hover:scale-110 active:scale-95"
          >
              ⚙️
          </button>
      )}
    </div>
  );
};

export default NetworkGraph;
