import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { BibEntry, GraphNode, GraphLink, LayoutType, AdvancedGraphMetrics } from '../types';
import { suggestNetworkLayout, interpretNetworkMetrics } from '../services/geminiService';

interface NetworkGraphProps {
  data: BibEntry[];
}

type SizeMetric = 'pageRank' | 'degree' | 'betweenness' | 'uniform';
type NetworkType = 'directed' | 'undirected';
type ColorMode = 'role' | 'community';

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'controls' | 'metrics'>('controls');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [currentLayout, setCurrentLayout] = useState<LayoutType>('force');
  const [aiSuggestion, setAiSuggestion] = useState<{ layout: LayoutType, reason: string } | null>(null);
  const [isGettingSuggestion, setIsGettingSuggestion] = useState(false);
  const [metricAnalysis, setMetricAnalysis] = useState<string | null>(null);
  const [isAnalyzingMetrics, setIsAnalyzingMetrics] = useState(false);
  
  // Graph Configuration State
  const [networkType, setNetworkType] = useState<NetworkType>('directed');
  const [colorMode, setColorMode] = useState<ColorMode>('role');
  const [linkConfig, setLinkConfig] = useState({
      showAuthTrans: true, // Author <-> Translator
      showTransPub: true,  // Translator <-> Publisher
      showAuthPub: false   // Author <-> Publisher (Direct)
  });
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>('pageRank');
  
  // Physics Parameters State
  const [chargeStrength, setChargeStrength] = useState(-300);
  const [linkDistance, setLinkDistance] = useState(120);
  const [collideRadius, setCollideRadius] = useState(25);

  // Computed Metrics
  const [metrics, setMetrics] = useState<AdvancedGraphMetrics | null>(null);

  // 1. Process Data & Build Topology (Aggregation Logic for Edge Weights)
  const { nodes, links } = useMemo(() => {
    const nodesMap = new Map<string, GraphNode>();
    const linkMap = new Map<string, GraphLink>();

    // Helper to generate unique link keys based on directionality preference
    const getLinkKey = (source: string, target: string) => {
        return `${source}->${target}`; // Directed key structure, simpler for aggregation
    };

    // First pass: Identify all potential nodes
    data.forEach(entry => {
       const authorId = `A-${entry.author.name}`;
       const translatorId = `T-${entry.translator.name}`;
       const publisherId = `P-${entry.publisher}`;

       const ensureNode = (id: string, group: GraphNode['group'], name: string) => {
           if (!nodesMap.has(id)) {
               nodesMap.set(id, { 
                   id, group, name, val: 5,
                   inDegree: 0, outDegree: 0, pageRank: 0, betweenness: 0, community: 0
               });
           }
       };

       // 1. Author <-> Translator
       if (linkConfig.showAuthTrans) {
            ensureNode(authorId, 'author', entry.author.name);
            ensureNode(translatorId, 'translator', entry.translator.name);
            
            const key = getLinkKey(authorId, translatorId);
            if (linkMap.has(key)) {
                linkMap.get(key)!.weight = (linkMap.get(key)!.weight || 1) + 1;
            } else {
                linkMap.set(key, { source: authorId, target: translatorId, label: 'translated by', weight: 1 });
            }
       }

       // 2. Translator <-> Publisher
       if (linkConfig.showTransPub) {
            ensureNode(translatorId, 'translator', entry.translator.name);
            ensureNode(publisherId, 'publisher', entry.publisher);

            const key = getLinkKey(translatorId, publisherId);
            if (linkMap.has(key)) {
                linkMap.get(key)!.weight = (linkMap.get(key)!.weight || 1) + 1;
            } else {
                linkMap.set(key, { source: translatorId, target: publisherId, label: 'published by', weight: 1 });
            }
       }

       // 3. Author <-> Publisher (Direct)
       if (linkConfig.showAuthPub) {
            ensureNode(authorId, 'author', entry.author.name);
            ensureNode(publisherId, 'publisher', entry.publisher);

            const key = getLinkKey(authorId, publisherId);
            if (linkMap.has(key)) {
                linkMap.get(key)!.weight = (linkMap.get(key)!.weight || 1) + 1;
            } else {
                linkMap.set(key, { source: authorId, target: publisherId, label: 'published by', weight: 1 });
            }
       }
    });

    return { nodes: Array.from(nodesMap.values()), links: Array.from(linkMap.values()) };
  }, [data, linkConfig]);

  // 2. Calculate Advanced Metrics & Community Detection
  useEffect(() => {
    if (nodes.length === 0) {
        setMetrics(null);
        return;
    }

    // Reset metrics
    nodes.forEach(n => {
        n.inDegree = 0;
        n.outDegree = 0;
        n.betweenness = 0;
        n.pageRank = 0;
    });

    // --- Degree & Adj List ---
    const adjList = new Map<string, string[]>(); 
    nodes.forEach(n => adjList.set(n.id, []));

    links.forEach(l => {
      const sourceId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source as string;
      const targetId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target as string;
      const weight = l.weight || 1;

      const sourceNode = nodes.find(n => n.id === sourceId);
      const targetNode = nodes.find(n => n.id === targetId);

      if (sourceNode) sourceNode.outDegree = (sourceNode.outDegree || 0) + weight;
      if (targetNode) targetNode.inDegree = (targetNode.inDegree || 0) + weight;

      if (adjList.has(sourceId)) adjList.get(sourceId)?.push(targetId);
      
      // For undirected calculations (PageRank in undir mode, Community Detection)
      if (networkType === 'undirected' || true) { // Always create undirected adj list for community detection
          if (adjList.has(targetId)) adjList.get(targetId)?.push(sourceId);
          // Only update node degree stats if undirected mode is actually selected visually
          if (networkType === 'undirected') {
              if (sourceNode) sourceNode.inDegree = (sourceNode.inDegree || 0) + weight;
              if (targetNode) targetNode.outDegree = (targetNode.outDegree || 0) + weight;
          }
      }
    });

    // --- Community Detection (Label Propagation) ---
    // 1. Initialize unique labels
    const communities = new Map<string, number>();
    nodes.forEach((n, i) => communities.set(n.id, i));

    // 2. Propagate
    // Run a fixed number of iterations (e.g., 5) to let labels settle
    for (let iter = 0; iter < 5; iter++) {
        // Shuffle order to prevent oscillation
        const shuffled = [...nodes].sort(() => Math.random() - 0.5);
        
        shuffled.forEach(node => {
            const neighbors = adjList.get(node.id) || [];
            if (neighbors.length === 0) return;

            // Count neighbor labels
            const counts = new Map<number, number>();
            neighbors.forEach(neighId => {
                const label = communities.get(neighId)!;
                counts.set(label, (counts.get(label) || 0) + 1);
            });

            // Find max frequency label
            let maxCount = -1;
            let bestLabels: number[] = [];
            counts.forEach((count, label) => {
                if (count > maxCount) {
                    maxCount = count;
                    bestLabels = [label];
                } else if (count === maxCount) {
                    bestLabels.push(label);
                }
            });

            // Adopt new label (randomly if tie)
            if (bestLabels.length > 0) {
                const choice = bestLabels[Math.floor(Math.random() * bestLabels.length)];
                communities.set(node.id, choice);
            }
        });
    }

    // 3. Assign back to nodes & Re-index communities to 0..N for color scales
    const uniqueLabels = Array.from(new Set(communities.values()));
    const labelMap = new Map<number, number>();
    uniqueLabels.forEach((l, i) => labelMap.set(l, i));
    
    nodes.forEach(n => {
        n.community = labelMap.get(communities.get(n.id)!);
    });


    // --- PageRank ---
    const d = 0.85; 
    nodes.forEach(n => n.pageRank = 1 / nodes.length);
    for (let i = 0; i < 20; i++) {
        const newRanks = new Map<string, number>();
        nodes.forEach(n => newRanks.set(n.id, (1 - d) / nodes.length));

        nodes.forEach(source => {
            const neighbors = adjList.get(source.id) || [];
            const degree = neighbors.length;
            if (degree > 0) {
                const share = (d * (source.pageRank || 0)) / degree;
                neighbors.forEach(targetId => {
                    newRanks.set(targetId, (newRanks.get(targetId) || 0) + share);
                });
            } else {
                nodes.forEach(target => {
                    newRanks.set(target.id, (newRanks.get(target.id) || 0) + (d * (source.pageRank || 0)) / nodes.length);
                });
            }
        });
        nodes.forEach(n => n.pageRank = newRanks.get(n.id));
    }

    // --- Betweenness Centrality ---
    const CB = new Map<string, number>();
    nodes.forEach(n => CB.set(n.id, 0));

    // Limit betweenness calculation to a subset if graph is large for performance
    const sampleNodes = nodes.length > 100 ? nodes.filter(() => Math.random() < 0.5) : nodes;

    sampleNodes.forEach(s => {
        const S: string[] = [];
        const P = new Map<string, string[]>();
        const sigma = new Map<string, number>();
        const dist = new Map<string, number>();

        nodes.forEach(n => {
            P.set(n.id, []);
            sigma.set(n.id, 0);
            dist.set(n.id, -1);
        });

        sigma.set(s.id, 1);
        dist.set(s.id, 0);

        const Q: string[] = [s.id];

        while (Q.length > 0) {
            const v = Q.shift()!;
            S.push(v);
            const neighbors = adjList.get(v) || [];
            neighbors.forEach(w => {
                if (dist.get(w) === -1) {
                    Q.push(w);
                    dist.set(w, dist.get(v)! + 1);
                }
                if (dist.get(w) === dist.get(v)! + 1) {
                    sigma.set(w, sigma.get(w)! + sigma.get(v)!);
                    P.get(w)!.push(v);
                }
            });
        }

        const delta = new Map<string, number>();
        nodes.forEach(n => delta.set(n.id, 0));

        while (S.length > 0) {
            const w = S.pop()!;
            P.get(w)!.forEach(v => {
                delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
            });
            if (w !== s.id) {
                CB.set(w, CB.get(w)! + delta.get(w)!);
            }
        }
    });

    const n = nodes.length;
    if (n > 2) {
        const normFactor = networkType === 'directed' ? 1 / ((n - 1) * (n - 2)) : 2 / ((n - 1) * (n - 2)); 
        nodes.forEach(node => {
            node.betweenness = (CB.get(node.id) || 0) * normFactor;
        });
    }

    // --- Stats ---
    const maxEdges = nodes.length * (nodes.length - 1); 
    const density = maxEdges > 0 ? links.length / maxEdges : 0;
    
    setMetrics({
        nodeCount: nodes.length,
        edgeCount: links.length,
        density,
        avgDegree: (links.length / nodes.length) || 0,
        diameterEstimate: 0, 
        clusteringCoefficient: density * 2, 
        communityCount: uniqueLabels.length,
        topPageRank: [...nodes].sort((a, b) => (b.pageRank || 0) - (a.pageRank || 0)).slice(0, 3),
        topBetweenness: [...nodes].sort((a, b) => (b.betweenness || 0) - (a.betweenness || 0)).slice(0, 3),
        mostProductiveTranslators: nodes.filter(n => n.group === 'translator').sort((a, b) => (b.outDegree || 0) - (a.outDegree || 0)).slice(0, 3),
        mostTranslatedAuthors: nodes.filter(n => n.group === 'author').sort((a, b) => (b.outDegree || 0) - (a.outDegree || 0)).slice(0, 3)
    });

  }, [nodes, links, networkType]); 

  // Handle AI Suggestion
  const handleAskAILayout = async () => {
    if(!metrics) return;
    setIsGettingSuggestion(true);
    try {
        const suggestion = await suggestNetworkLayout(metrics.nodeCount, metrics.edgeCount, metrics.density);
        setAiSuggestion(suggestion);
        setCurrentLayout(suggestion.layout); 
    } catch (e) {
        console.error("AI Layout error", e);
    } finally {
        setIsGettingSuggestion(false);
    }
  };

  const handleAskAIMetrics = async () => {
      if (!metrics) return;
      setIsAnalyzingMetrics(true);
      try {
          const analysis = await interpretNetworkMetrics(metrics);
          setMetricAnalysis(analysis);
      } catch (e) {
          console.error("Metric Analysis Error", e);
      } finally {
          setIsAnalyzingMetrics(false);
      }
  };

  // 3. D3 Rendering
  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 600;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    if (nodes.length === 0) {
        svg.append("text")
           .attr("x", width/2)
           .attr("y", height/2)
           .attr("text-anchor", "middle")
           .attr("fill", "#94a3b8")
           .text("No active connections selected.");
        return;
    }

    const container = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            container.attr("transform", event.transform);
        });
    svg.call(zoom);

    // Simulation Config
    const simulation = d3.forceSimulation(nodes)
       .force("collide", d3.forceCollide().radius(d => getRadius(d, sizeMetric) + 8).strength(0.7)); 

    simulationRef.current = simulation;

    // --- Arrows (Only if Directed) ---
    if (networkType === 'directed') {
        const defs = svg.append("defs");
        defs.append("marker")
            .attr("id", "arrow-head")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 20) 
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#94a3b8");
    }

    // Community Color Scale
    const communityColorScale = d3.scaleOrdinal(d3.schemeTableau10);

    // Links
    const link = container.append("g")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      // Variable stroke width based on weight (collaborations)
      .attr("stroke-width", d => Math.sqrt(d.weight || 1) * 1.5 + 0.5);
    
    if (networkType === 'directed') {
        link.attr("marker-end", "url(#arrow-head)");
    }

    // Helper: Get Radius
    function getRadius(node: GraphNode, metric: SizeMetric) {
        const base = 8;
        if (metric === 'uniform') return 10;
        if (metric === 'degree') return base + ((node.inDegree || 0) + (node.outDegree || 0)); 
        if (metric === 'betweenness') return base + (node.betweenness || 0) * 100; 
        return base + (node.pageRank || 0) * 150;
    }

    // Helper: Get Color
    function getNodeColor(node: GraphNode) {
        if (colorMode === 'community') {
            return communityColorScale(String(node.community || 0));
        }
        // Role based
        if (node.group === 'author') return "#ef4444";
        if (node.group === 'translator') return "#3b82f6";
        return "#10b981";
    }

    const node = container.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", d => getRadius(d, sizeMetric))
      .attr("fill", d => getNodeColor(d))
      .attr("cursor", "grab")
      .call(d3.drag<SVGCircleElement, GraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      );

    const labels = container.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("dx", d => getRadius(d, sizeMetric) + 6)
        .attr("dy", 4)
        .text(d => d.name)
        .attr("font-size", "11px")
        .attr("fill", "#334155")
        .attr("font-weight", "500")
        .attr("pointer-events", "none")
        .style("text-shadow", "0 1px 2px rgba(255,255,255,0.8)");

    // Interaction
    node.on("mouseover", (event, d) => {
        const connectedIds = new Set<string>();
        connectedIds.add(d.id);
        
        link.attr("stroke", l => {
            const isConn = l.source === d || l.target === d;
            if (isConn) {
                connectedIds.add((l.source as GraphNode).id);
                connectedIds.add((l.target as GraphNode).id);
                return "#6366f1";
            }
            return "#e2e8f0";
        })
        .attr("stroke-opacity", l => (l.source === d || l.target === d) ? 1 : 0.1);
        
        node.attr("opacity", n => connectedIds.has(n.id) ? 1 : 0.1);
        labels.attr("opacity", n => connectedIds.has(n.id) ? 1 : 0.1);
    })
    .on("mouseout", () => {
        link.attr("stroke", "#cbd5e1").attr("stroke-opacity", 0.6);
        node.attr("opacity", 1);
        labels.attr("opacity", 1);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => {
             if (networkType === 'directed') {
                const target = d.target as GraphNode;
                const r = getRadius(target, sizeMetric);
                const dx = target.x! - (d.source as GraphNode).x!;
                const dy = target.y! - (d.source as GraphNode).y!;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if(dist === 0) return target.x!;
                const scale = Math.max(0, dist - r - 5) / dist; 
                return (d.source as GraphNode).x! + dx * scale;
             }
             return (d.target as GraphNode).x!;
        })
        .attr("y2", d => {
             if (networkType === 'directed') {
                const target = d.target as GraphNode;
                const r = getRadius(target, sizeMetric);
                const dx = target.x! - (d.source as GraphNode).x!;
                const dy = target.y! - (d.source as GraphNode).y!;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if(dist === 0) return target.y!;
                const scale = Math.max(0, dist - r - 5) / dist; 
                return (d.source as GraphNode).y! + dy * scale;
             }
             return (d.target as GraphNode).y!;
        });

      node.attr("cx", d => d.x!).attr("cy", d => d.y!);
      labels.attr("x", d => d.x!).attr("y", d => d.y!);
    });

    function dragstarted(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event: any, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      if (currentLayout === 'force') {
        d.fx = null;
        d.fy = null;
      }
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, links, currentLayout, sizeMetric, collideRadius, networkType, colorMode]);

  // 4. Update Simulation Forces
  useEffect(() => {
    if (!simulationRef.current) return;
    const simulation = simulationRef.current;
    const width = 800;
    const height = 600;

    simulation.force("link", null).force("charge", null).force("center", null).force("x", null).force("y", null).force("r", null);
    
    // Recalculate radius based on current metric for collision
    const getR = (d: GraphNode) => {
        const base = 8;
        if (sizeMetric === 'uniform') return 10;
        if (sizeMetric === 'degree') return base + ((d.inDegree || 0) + (d.outDegree || 0));
        if (sizeMetric === 'betweenness') return base + (d.betweenness || 0) * 100;
        return base + (d.pageRank || 0) * 150;
    };
    simulation.force("collide", d3.forceCollide().radius(d => getR(d as GraphNode) + 5).strength(0.7));
    
    nodes.forEach(n => { n.fx = null; n.fy = null; });

    if (currentLayout === 'force') {
        simulation
            .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(linkDistance))
            .force("charge", d3.forceManyBody().strength(chargeStrength))
            .force("center", d3.forceCenter(width / 2, height / 2));
    } 
    else if (currentLayout === 'circular') {
        const r = Math.min(width, height) / 2 - 50;
        simulation
            .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).strength(0.01))
            .force("charge", d3.forceManyBody().strength(-30))
            .force("r", d3.forceRadial(r, width/2, height/2).strength(0.8));
    }
    else if (currentLayout === 'concentric') {
        simulation
            .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).strength(0.1))
            .force("r", d3.forceRadial((d: GraphNode) => {
                if (d.group === 'publisher') return 0;
                if (d.group === 'translator') return 150;
                return 300; // author
            }, width/2, height/2).strength(1));
    }
    else if (currentLayout === 'grid') {
        const cols = Math.ceil(Math.sqrt(nodes.length));
        const spacing = 80;
        const offsetX = (width - cols * spacing) / 2 + spacing/2;
        const offsetY = (height - Math.ceil(nodes.length/cols) * spacing) / 2 + spacing/2;
        const sortedNodes = [...nodes].sort((a,b) => a.group.localeCompare(b.group));
        
        simulation
            .force("x", d3.forceX((d: GraphNode) => {
                const index = sortedNodes.findIndex(n => n.id === d.id);
                return (index % cols) * spacing + offsetX;
            }).strength(0.8))
            .force("y", d3.forceY((d: GraphNode) => {
                const index = sortedNodes.findIndex(n => n.id === d.id);
                return Math.floor(index / cols) * spacing + offsetY;
            }).strength(0.8));
    }

    simulation.alpha(0.3).restart();
  }, [currentLayout, chargeStrength, linkDistance, collideRadius, links, nodes, sizeMetric, networkType, colorMode]);

  return (
    <div className="w-full h-[600px] border border-slate-200 rounded-xl bg-slate-50 overflow-hidden relative shadow-sm flex">
        
        {/* Graph Canvas */}
        <div className="flex-1 h-full relative">
            <svg ref={svgRef} className="w-full h-full cursor-move bg-white"></svg>
            
            {/* Legend with Directionality Note */}
            <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur p-3 rounded-lg shadow border border-slate-100 text-xs">
                <div className="font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                    {networkType === 'directed' ? 'Flow Direction' : 'Connections'}
                </div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-red-500 font-bold">Author</span> 
                    <span className="text-slate-400">{networkType === 'directed' ? '→' : '—'}</span> 
                    <span className="text-blue-500 font-bold">Translator</span>
                    <span className="text-slate-400">{networkType === 'directed' ? '→' : '—'}</span> 
                    <span className="text-emerald-500 font-bold">Publisher</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="h-0.5 w-6 bg-slate-400 rounded-full"></div>
                        <span className="text-slate-500">Thin Line (1 collab)</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 w-6 bg-slate-400 rounded-full"></div>
                        <span className="text-slate-500 font-medium">Thick Line (Many)</span>
                    </div>
                </div>
                {colorMode === 'community' && (
                     <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-indigo-600 font-semibold">
                         Displaying Automated Community Clusters
                     </div>
                )}
            </div>

            {/* AI Suggestion Toast */}
            {aiSuggestion && (
                <div className="absolute top-4 right-4 max-w-xs z-10 bg-indigo-600/90 backdrop-blur text-white p-4 rounded-xl shadow-lg animate-fadeIn">
                    <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-xs uppercase tracking-wider text-indigo-200">Layout Advice</span>
                        <button onClick={() => setAiSuggestion(null)} className="text-white hover:text-indigo-200">&times;</button>
                    </div>
                    <div className="font-serif text-lg mb-1 capitalize">{aiSuggestion.layout} Layout</div>
                    <p className="text-xs text-indigo-100 leading-snug">{aiSuggestion.reason}</p>
                </div>
            )}
        </div>

        {/* Sidebar Controls & Metrics */}
        <div className={`absolute right-0 top-0 bottom-0 w-80 bg-white/95 backdrop-blur shadow-xl border-l border-slate-200 transform transition-transform duration-300 z-20 flex flex-col ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            
            <button 
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className="absolute -left-8 top-4 bg-white p-2 rounded-l-md shadow-md border-y border-l border-slate-200 text-slate-500 hover:text-indigo-600"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isPanelOpen ? 
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /> : 
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    }
                </svg>
            </button>

            <div className="p-4 border-b border-slate-100">
                <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('controls')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'controls' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        Controls
                    </button>
                    <button 
                        onClick={() => setActiveTab('metrics')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'metrics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        Adv. Metrics
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {activeTab === 'controls' && (
                    <div className="space-y-6">
                         
                         {/* 1. Network Topology (Type Selection) */}
                         <div>
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Network Topology</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setNetworkType('directed')}
                                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-1 ${
                                        networkType === 'directed'
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    <span>Directed</span>
                                    <span className="text-lg leading-none">→</span>
                                </button>
                                <button
                                    onClick={() => setNetworkType('undirected')}
                                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-1 ${
                                        networkType === 'undirected'
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    <span>Undirected</span>
                                    <span className="text-lg leading-none">—</span>
                                </button>
                            </div>
                         </div>

                         {/* 2. Link Strategy (Conditional) */}
                         {networkType === 'directed' ? (
                             <div className="animate-fadeIn">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Flow Direction</label>
                                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={linkConfig.showAuthTrans}
                                            onChange={e => setLinkConfig({...linkConfig, showAuthTrans: e.target.checked})}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Author → Translator
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={linkConfig.showTransPub}
                                            onChange={e => setLinkConfig({...linkConfig, showTransPub: e.target.checked})}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Translator → Publisher
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={linkConfig.showAuthPub}
                                            onChange={e => setLinkConfig({...linkConfig, showAuthPub: e.target.checked})}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Author → Publisher <span className="text-[10px] text-indigo-500 font-bold ml-auto">(Direct)</span>
                                    </label>
                                </div>
                             </div>
                         ) : (
                             <div className="animate-fadeIn">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Relationships</label>
                                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={linkConfig.showAuthTrans}
                                            onChange={e => setLinkConfig({...linkConfig, showAuthTrans: e.target.checked})}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Author — Translator
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={linkConfig.showTransPub}
                                            onChange={e => setLinkConfig({...linkConfig, showTransPub: e.target.checked})}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Translator — Publisher
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={linkConfig.showAuthPub}
                                            onChange={e => setLinkConfig({...linkConfig, showAuthPub: e.target.checked})}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Author — Publisher <span className="text-[10px] text-slate-400 font-bold ml-auto">(Direct)</span>
                                    </label>
                                </div>
                             </div>
                         )}

                         {/* Visualization Settings */}
                         <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Node Size</label>
                                <select 
                                    value={sizeMetric}
                                    onChange={(e) => setSizeMetric(e.target.value as SizeMetric)}
                                    className="w-full text-sm p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="pageRank">PageRank (Prestige/Centrality)</option>
                                    <option value="degree">Degree (Connections)</option>
                                    <option value="betweenness">Betweenness (Gatekeeping)</option>
                                    <option value="uniform">Uniform (Fixed Size)</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Color By</label>
                                <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
                                    <button 
                                        onClick={() => setColorMode('role')}
                                        className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${colorMode === 'role' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                                    >
                                        Role
                                    </button>
                                    <button 
                                        onClick={() => setColorMode('community')}
                                        className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${colorMode === 'community' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                                    >
                                        Cluster
                                    </button>
                                </div>
                            </div>
                         </div>

                         {/* Layouts */}
                         <div>
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Layout</label>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                {(['force', 'circular', 'concentric', 'grid'] as LayoutType[]).map(l => (
                                    <button
                                        key={l}
                                        onClick={() => setCurrentLayout(l)}
                                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all capitalize ${
                                            currentLayout === l 
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                            <button 
                                onClick={handleAskAILayout}
                                disabled={isGettingSuggestion}
                                className="w-full py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                            >
                                {isGettingSuggestion ? 'Analyzing...' : 'AI Suggest Layout'}
                            </button>
                         </div>

                        <hr className="border-slate-100" />
                        
                         {/* Sliders */}
                         <div>
                            <label className="flex justify-between text-xs font-medium text-slate-700 mb-2">
                                <span>Link Distance</span>
                                <span className="text-slate-400">{linkDistance}</span>
                            </label>
                            <input 
                                type="range" min="10" max="300" step="10"
                                value={linkDistance}
                                onChange={(e) => setLinkDistance(Number(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                disabled={currentLayout !== 'force'}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'metrics' && metrics && (
                    <div className="space-y-6 animate-fadeIn">
                        
                        {/* AI Metric Analysis Panel */}
                         <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                             <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Sociological Analysis</h4>
                             </div>
                             {metricAnalysis ? (
                                 <p className="text-xs text-indigo-800 leading-relaxed italic">{metricAnalysis}</p>
                             ) : (
                                <button 
                                    onClick={handleAskAIMetrics}
                                    disabled={isAnalyzingMetrics}
                                    className="w-full py-1.5 bg-white text-indigo-600 border border-indigo-200 rounded text-xs font-semibold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isAnalyzingMetrics ? (
                                        'Consulting AI...'
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                            Explain Metrics
                                        </>
                                    )}
                                </button>
                             )}
                         </div>

                         {/* Community Detection Stats */}
                         <div>
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Cluster Analysis</h4>
                            <div className="bg-slate-50 p-3 rounded border border-slate-100">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs text-slate-500">Detected Communities</span>
                                    <span className="text-sm font-mono font-bold text-indigo-600">{metrics.communityCount}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-snug">
                                    Based on label propagation. Switch "Color By" to "Cluster" to visualize these groups.
                                </p>
                            </div>
                        </div>

                        {/* Density & Cohesion */}
                        <div>
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Cohesion</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                    <div className="text-[10px] text-slate-400">Density (Connectance)</div>
                                    <div className="text-sm font-mono font-bold text-slate-700">{metrics.density.toFixed(3)}</div>
                                </div>
                                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                    <div className="text-[10px] text-slate-400">Avg Degree (Links/Node)</div>
                                    <div className="text-sm font-mono font-bold text-slate-700">{metrics.avgDegree.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Prestige (PageRank) */}
                        <div>
                             <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                                 <span>PageRank (Prestige)</span>
                             </h4>
                             <div className="space-y-1.5">
                                {metrics.topPageRank.map((node, idx) => (
                                    <div key={node.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-2 truncate">
                                            <div className={`w-1.5 h-1.5 rounded-full ${node.group === 'author' ? 'bg-red-500' : node.group === 'translator' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                                            <span className="truncate max-w-[120px]" title={node.name}>{node.name}</span>
                                        </div>
                                        <span className="font-mono text-indigo-600">{(node.pageRank || 0).toFixed(3)}</span>
                                    </div>
                                ))}
                             </div>
                        </div>

                        {/* Gatekeepers (Betweenness) */}
                        <div>
                             <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                                 <span>Betweenness (Gatekeepers)</span>
                             </h4>
                             <div className="space-y-1.5">
                                {metrics.topBetweenness.map((node, idx) => (
                                    <div key={node.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-2 truncate">
                                            <div className={`w-1.5 h-1.5 rounded-full ${node.group === 'author' ? 'bg-red-500' : node.group === 'translator' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                                            <span className="truncate max-w-[120px]" title={node.name}>{node.name}</span>
                                        </div>
                                        <span className="font-mono text-purple-600">{(node.betweenness || 0).toFixed(2)}</span>
                                    </div>
                                ))}
                             </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default NetworkGraph;