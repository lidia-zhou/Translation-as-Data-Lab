
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { BibEntry } from '../types';
import { COORDS } from '../constants';

interface WorldMapProps {
  data: BibEntry[];
}

type MapMode = 'flow' | 'distribution';

interface TooltipData {
    x: number;
    y: number;
    title: string;
    subtitle?: string;
    count?: number;
    from?: string;
    to?: string;
    type: 'node' | 'arc';
}

const WorldMap: React.FC<WorldMapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mapData, setMapData] = useState<any>(null);
  const [mode, setMode] = useState<MapMode>('distribution');
  const [focusMode, setFocusMode] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(t => setMapData(topojson.feature(t, t.objects.countries)));
  }, []);

  const handleExport = (format: 'svg' | 'png' | 'html') => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    
    if (format === 'html') {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Interactive Translation Map</title>
          <style>
            body { margin: 0; background: #f8fafc; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; }
            svg { width: 100%; height: 100%; max-width: 1200px; filter: drop-shadow(0 20px 50px rgba(0,0,0,0.1)); }
          </style>
        </head>
        <body>${svgData}</body>
        </html>
      `;
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `spatial-analysis-${Date.now()}.html`;
      link.click();
      return;
    }

    // Fix: Reference svgBlob instead of the non-existent 'blob' variable on line 68.
    if (format === 'svg') {
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `spatial-vector-${Date.now()}.svg`;
      link.click();
    } else {
      const canvas = document.createElement("canvas");
      const svgSize = svgElement.getBoundingClientRect();
      canvas.width = svgSize.width * 2;
      canvas.height = svgSize.height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

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
        link.download = `spatial-snapshot-${Date.now()}.png`;
        link.click();
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  const geoData = useMemo(() => {
    // 1. Flow Calculation
    const flows = data.map(e => {
      const sCoord = (e.customMetadata?.sourceCoord as any) || COORDS["lisbon"];
      const tCoord = (e.customMetadata?.targetCoord as any) || null;
      if (sCoord && tCoord && (sCoord[0] !== tCoord[0] || sCoord[1] !== tCoord[1])) {
        return { source: sCoord, target: tCoord, title: e.title, from: e.originalCity || 'Source Hub', to: e.city || 'Target Hub' };
      }
      return null;
    }).filter(Boolean) as any[];

    // 2. Distribution - Robust naming logic
    const distributionMap = new Map<string, any>();
    data.forEach(e => {
        const coords = (e.customMetadata?.targetCoord as any) || null;
        if (coords) {
            const key = `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`;
            const validName = (e.city && e.city.toLowerCase() !== 'unknown') ? e.city : 
                              (e.provinceState && e.provinceState.toLowerCase() !== 'unknown') ? e.provinceState : 
                              null;
            
            if (!distributionMap.has(key)) {
                distributionMap.set(key, { 
                  coords, 
                  count: 0, 
                  name: validName || 'Unknown Location', 
                  province: e.provinceState 
                });
            } else if (validName) {
                // Prioritize the best available name for this coordinate cluster
                const existing = distributionMap.get(key);
                if (existing.name === 'Unknown Location') {
                    existing.name = validName;
                }
            }
            distributionMap.get(key).count++;
        }
    });

    return { flows, distribution: Array.from(distributionMap.values()) };
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !mapData) return;
    const svg = d3.select(svgRef.current);
    const container = svgRef.current.parentElement;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    svg.attr("width", width).attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g");
    let projection = d3.geoMercator();
    
    if (focusMode && geoData.distribution.length > 0) {
        const lons = geoData.distribution.map(d => d.coords[0]);
        const lats = geoData.distribution.map(d => d.coords[1]);
        const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        projection = d3.geoMercator().center([centerLon, centerLat]).scale(width * 1.5).translate([width / 2, height / 2]);
    } else {
        projection = d3.geoMercator().scale(width / 7.5).translate([width / 2, height / 1.4]);
    }

    const path = d3.geoPath().projection(projection);
    const zoom = d3.zoom<SVGSVGElement, any>().scaleExtent([0.5, 60]).on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    // Basemap Layer
    g.append("path").datum({type: "Sphere"}).attr("fill", "#fcfcfd").attr("d", path as any);
    g.selectAll(".country").data(mapData.features).join("path")
      .attr("fill", "#ffffff").attr("stroke", "#cbd5e1").attr("stroke-width", 0.5).attr("d", path as any);

    if (mode === 'flow') {
      const arcLayer = g.append("g");
      const arcGenerator = (d: any) => {
          const s = projection(d.source);
          const t = projection(d.target);
          if (!s || !t) return "";
          const dx = t[0] - s[0], dy = t[1] - s[1], dr = Math.sqrt(dx * dx + dy * dy);
          return `M${s[0]},${s[1]}A${dr},${dr} 0 0,1 ${t[0]},${t[1]}`;
      };
      
      // Hit Areas (Invisible but wide)
      arcLayer.selectAll(".flow-hit").data(geoData.flows).join("path")
        .attr("fill", "none").attr("stroke", "transparent").attr("stroke-width", 20)
        .attr("d", arcGenerator)
        .style("cursor", "pointer")
        .on("mouseenter", (e, d) => {
            setTooltip({ x: e.pageX, y: e.pageY, title: d.title, from: d.from, to: d.to, type: 'arc' });
        })
        .on("mouseleave", () => setTooltip(null));

      // Visual Arcs
      arcLayer.selectAll(".flow-visual").data(geoData.flows).join("path")
        .attr("fill", "none").attr("stroke", "#6366f1").attr("stroke-width", 2).attr("stroke-opacity", 0.25)
        .attr("d", arcGenerator)
        .attr("pointer-events", "none");

      // Particles
      geoData.flows.forEach((d) => {
          const s = projection(d.source);
          const t = projection(d.target);
          if (!s || !t) return;

          const arc = arcLayer.append("path").attr("d", arcGenerator(d)).attr("fill", "none").attr("stroke", "transparent").attr("pointer-events", "none");
          const totalLength = (arc.node() as SVGPathElement).getTotalLength();
          const particle = arcLayer.append("circle").attr("r", 2.5).attr("fill", "#6366f1").attr("pointer-events", "none");

          const animate = () => {
              particle.transition().duration(2500 + Math.random() * 2000).ease(d3.easeQuadInOut)
                .attrTween("transform", () => {
                  const node = arc.node() as SVGPathElement;
                  return (t: number) => {
                    const p = node.getPointAtLength(t * totalLength);
                    return `translate(${p.x},${p.y})`;
                  };
                }).on("end", animate);
          };
          animate();
      });
    }

    if (mode === 'distribution') {
        const bubbleLayer = g.append("g");
        const maxVal = Math.max(1, ...geoData.distribution.map(d => d.count));
        const radiusScale = d3.scaleSqrt().domain([1, maxVal]).range([7, 55]);
        
        bubbleLayer.selectAll(".dist-bubble").data(geoData.distribution).join("circle")
            .attr("cx", d => projection(d.coords)![0]).attr("cy", d => projection(d.coords)![1])
            .attr("r", d => radiusScale(d.count))
            .attr("fill", "#6366f1").attr("fill-opacity", 0.35)
            .attr("stroke", "#6366f1").attr("stroke-width", 2)
            .style("cursor", "pointer")
            .on("mouseenter", (e, d) => {
                setTooltip({ x: e.pageX, y: e.pageY, title: d.name, subtitle: d.province, count: d.count, type: 'node' });
            })
            .on("mouseleave", () => setTooltip(null));
    }
  }, [mapData, geoData, mode, focusMode]);

  return (
    <div className="flex-1 w-full h-full bg-[#f8fafc] relative overflow-hidden flex flex-col select-none">
      {/* TOOLTIP COMPONENT */}
      {tooltip && (
          <div 
            className="fixed z-[9999] pointer-events-none bg-slate-900 text-white p-6 rounded-[2rem] shadow-3xl border border-white/10 animate-fadeIn space-y-2 backdrop-blur-2xl ring-1 ring-white/20 transition-opacity duration-200"
            style={{ left: tooltip.x + 30, top: tooltip.y - 30 }}
          >
              <h5 className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400">
                {tooltip.type === 'node' ? 'City Hub' : 'Textual Movement'}
              </h5>
              <p className="text-xl font-bold serif leading-tight">{tooltip.title}</p>
              {tooltip.subtitle && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{tooltip.subtitle}</p>}
              {tooltip.count !== undefined && (
                  <p className="text-[11px] font-bold text-slate-300 pt-1">
                    Dataset Volume: <span className="text-indigo-300">{tooltip.count} Works</span>
                  </p>
              )}
              {tooltip.from && (
                  <div className="pt-2 flex items-center gap-3">
                      <span className="text-[10px] bg-white/10 px-3 py-1.5 rounded-lg font-bold border border-white/5 uppercase">{tooltip.from}</span>
                      <span className="text-indigo-400 text-xl">→</span>
                      <span className="text-[10px] bg-indigo-600 px-3 py-1.5 rounded-lg font-bold border border-indigo-400 uppercase">{tooltip.to}</span>
                  </div>
              )}
          </div>
      )}

      {/* ACTION PANEL */}
      <div className="absolute top-10 right-10 z-[100] flex gap-4">
         <div className="bg-white/95 backdrop-blur-2xl p-1.5 rounded-[2rem] border border-slate-200 shadow-2xl flex gap-1 ring-1 ring-slate-100">
            <button onClick={() => setMode('distribution')} className={`px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${mode === 'distribution' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>Density / 密度</button>
            <button onClick={() => setMode('flow')} className={`px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${mode === 'flow' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>Flow / 流转</button>
         </div>
         <button onClick={() => setFocusMode(!focusMode)} className={`px-8 py-4 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all border shadow-2xl ${focusMode ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200' : 'bg-white text-slate-400 border-slate-200'}`}>
            {focusMode ? '🎯 Regional Focus' : '🌍 World Projection'}
         </button>
         <div className="flex gap-1 bg-white p-1 rounded-[2rem] border border-slate-200 shadow-2xl ring-1 ring-slate-100">
            <button onClick={() => handleExport('html')} className="px-6 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">HTML</button>
            <button onClick={() => handleExport('png')} className="px-6 py-4 rounded-[1.5rem] bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all">PNG</button>
         </div>
      </div>

      {/* PROFESSIONAL LEGEND */}
      <div className="absolute bottom-12 left-12 z-[100] bg-white/90 backdrop-blur-2xl p-8 rounded-[3rem] border border-slate-100 shadow-3xl w-80 space-y-6 animate-slideUp ring-1 ring-slate-100">
          <div className="space-y-1">
              <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Computational GIS</h5>
              <h4 className="text-2xl font-bold serif text-slate-800">Spatial Matrix / 空间矩阵</h4>
          </div>
          <div className="h-px bg-slate-100 w-full"></div>
          <div className="space-y-4 text-left">
              <div className="flex items-center gap-4">
                  <div className="w-7 h-7 rounded-full bg-indigo-600/30 border-2 border-indigo-600 animate-pulse"></div>
                  <div>
                      <p className="text-[11px] font-bold text-slate-700">Cluster Intensity</p>
                      <p className="text-[9px] uppercase text-slate-400 font-black tracking-tighter">Publication weight at city hub</p>
                  </div>
              </div>
              <div className="flex items-center gap-4">
                  <div className="w-10 h-1.5 bg-indigo-600/20 rounded-full relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-3 h-full bg-indigo-600 animate-[move_3s_infinite_linear]"></div>
                  </div>
                  <div>
                      <p className="text-[11px] font-bold text-slate-700">Translational Vector</p>
                      <p className="text-[9px] uppercase text-slate-400 font-black tracking-tighter">Movement of textual capital</p>
                  </div>
              </div>
          </div>
          <p className="text-[9px] font-serif text-slate-400 leading-relaxed border-l-2 border-indigo-100 pl-4 italic">
            Visualizing the cross-border circulation of bibliographic artifacts. Use "Density" for production focus and "Flow" for transfer analysis.
          </p>
      </div>

      <style>{`
        @keyframes move {
          0% { left: -30%; }
          100% { left: 130%; }
        }
      `}</style>

      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"></svg>
    </div>
  );
};

export default WorldMap;
