
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { BibEntry } from '../types';
import { COORDS } from '../constants';

interface WorldMapProps {
  data: BibEntry[];
}

type MapMode = 'flow' | 'distribution';

const WorldMap: React.FC<WorldMapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mapData, setMapData] = useState<any>(null);
  const [hoverInfo, setHoverInfo] = useState<{title: string, from: string, to: string, province?: string} | null>(null);
  const [mode, setMode] = useState<MapMode>('distribution');
  const [focusMode, setFocusMode] = useState(true);

  useEffect(() => {
    // High resolution world map with clearer boundaries
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(t => setMapData(topojson.feature(t, t.objects.countries)));
  }, []);

  const geoData = useMemo(() => {
    const flows = data.map(e => {
      // Default source to Lisbon if not specified, given the context of the lab (Portuguese-Chinese)
      const sourceCoord = (e.customMetadata?.sourceCoord as any) || COORDS["lisbon"];
      const targetCoord = (e.customMetadata?.targetCoord as any) || null;
      
      if (sourceCoord && targetCoord) {
        return { 
          source: sourceCoord, 
          target: targetCoord, 
          title: e.title, 
          from: e.originalCity || 'Source Node', 
          to: e.city || 'Target Node', 
          province: e.provinceState 
        };
      }
      return null;
    }).filter(Boolean) as any[];

    const distributionMap = new Map<string, any>();
    data.forEach(e => {
        const coords = (e.customMetadata?.targetCoord as any) || null;
        if (coords) {
            const key = `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`;
            if (!distributionMap.has(key)) {
                distributionMap.set(key, { coords, count: 0, name: e.city || 'Point', province: e.provinceState });
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
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        // Calculate a tighter padding for China regions
        const centerLon = (minLon + maxLon) / 2;
        const centerLat = (minLat + maxLat) / 2;
        
        projection = d3.geoMercator()
            .center([centerLon, centerLat])
            .scale(width * 1.8) // Higher scale for focus
            .translate([width / 2, height / 2]);
    } else {
        // Global overview with better centering
        projection = d3.geoMercator()
            .scale(width / 7)
            .translate([width / 2, height / 1.4]);
    }

    const path = d3.geoPath().projection(projection);
    const zoom = d3.zoom<SVGSVGElement, any>()
      .scaleExtent([0.5, 50])
      .on("zoom", (e) => g.attr("transform", e.transform));
    
    svg.call(zoom);

    // Deep Ocean background
    g.append("path")
      .datum({type: "Sphere"})
      .attr("fill", "#f1f5f9")
      .attr("d", path as any);

    // Graticule for architectural feel
    g.append("path")
      .datum(d3.geoGraticule())
      .attr("class", "graticule")
      .attr("d", path as any)
      .attr("fill", "none")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", 0.5);

    // Land layer with higher contrast
    g.selectAll(".country")
      .data(mapData.features)
      .join("path")
      .attr("fill", "#ffffff")
      .attr("stroke", "#94a3b8") // Darker border
      .attr("stroke-width", 0.8) // Thicker border
      .attr("d", path as any)
      .attr("class", "transition-colors hover:fill-slate-50");

    if (mode === 'flow') {
      const arcLayer = g.append("g");
      
      // Arc generator with great circle paths
      const arcGenerator = (d: any) => {
        const route = { type: "LineString", coordinates: [d.source, d.target] };
        return path(route as any);
      };

      // Draw shadow arcs for depth
      arcLayer.selectAll(".flow-shadow")
        .data(geoData.flows)
        .join("path")
        .attr("fill", "none")
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.1)
        .attr("d", arcGenerator);

      // Active Arcs
      arcLayer.selectAll(".flow-arc")
        .data(geoData.flows)
        .join("path")
        .attr("fill", "none")
        .attr("stroke", "#6366f1")
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.4)
        .attr("d", arcGenerator)
        .attr("stroke-dasharray", function() { return (this as any).getTotalLength(); })
        .attr("stroke-dashoffset", function() { return (this as any).getTotalLength(); })
        .each(function() {
            d3.select(this)
                .transition()
                .duration(2000)
                .delay(() => Math.random() * 1000)
                .attr("stroke-dashoffset", 0);
        })
        .on("mouseenter", (e, d) => {
            setHoverInfo({title: d.title, from: d.from, to: d.to, province: d.province});
            d3.select(e.target).attr("stroke-opacity", 1).attr("stroke-width", 4).attr("stroke", "#4f46e5");
        })
        .on("mouseleave", (e) => {
            setHoverInfo(null);
            d3.select(e.target).attr("stroke-opacity", 0.4).attr("stroke-width", 2).attr("stroke", "#6366f1");
        });
    }

    if (mode === 'distribution') {
        const bubbleLayer = g.append("g");
        const maxVal = Math.max(1, ...geoData.distribution.map(d => d.count));
        const radiusScale = d3.scaleSqrt().domain([1, maxVal]).range([10, 50]);

        // Bubble Glow Effect
        bubbleLayer.selectAll(".dist-glow")
            .data(geoData.distribution)
            .join("circle")
            .attr("cx", d => projection(d.coords)![0])
            .attr("cy", d => projection(d.coords)![1])
            .attr("r", d => radiusScale(d.count) * 1.5)
            .attr("fill", "url(#glowGradient)")
            .attr("fill-opacity", 0.3)
            .attr("pointer-events", "none");

        bubbleLayer.selectAll(".dist-bubble")
            .data(geoData.distribution)
            .join("circle")
            .attr("cx", d => projection(d.coords)![0])
            .attr("cy", d => projection(d.coords)![1])
            .attr("r", d => radiusScale(d.count))
            .attr("fill", "#6366f1")
            .attr("fill-opacity", 0.6)
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 2)
            .attr("class", "cursor-pointer transition-all hover:fill-indigo-700 hover:scale-110")
            .on("mouseenter", (e, d) => {
                setHoverInfo({title: `${d.count} Archival Entries`, from: "Circulation Node", to: d.name, province: d.province});
            })
            .on("mouseleave", () => setHoverInfo(null));
            
        bubbleLayer.selectAll(".dist-label")
            .data(geoData.distribution)
            .join("text")
            .attr("x", d => projection(d.coords)![0])
            .attr("y", d => projection(d.coords)![1] + 5)
            .attr("text-anchor", "middle")
            .text(d => d.count > 0 ? d.count : "")
            .attr("class", "text-[12px] font-black fill-white pointer-events-none drop-shadow-md");
    }

    // Individual Precision Points (Resolved Pins)
    g.selectAll(".pin")
        .data(geoData.distribution)
        .join("circle")
        .attr("cx", d => projection(d.coords)![0])
        .attr("cy", d => projection(d.coords)![1])
        .attr("r", 3)
        .attr("fill", "#10b981")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .attr("class", "pointer-events-none shadow-sm");

    // Add Gradients
    const defs = svg.append("defs");
    const radialGradient = defs.append("radialGradient").attr("id", "glowGradient");
    radialGradient.append("stop").attr("offset", "0%").attr("stop-color", "#6366f1").attr("stop-opacity", 0.6);
    radialGradient.append("stop").attr("offset", "100%").attr("stop-color", "#6366f1").attr("stop-opacity", 0);

  }, [mapData, geoData, mode, focusMode]);

  return (
    <div className="flex-1 w-full h-full bg-[#f8fafc] relative overflow-hidden flex flex-col">
      <div className="absolute top-10 right-10 z-[100] flex gap-4">
         <div className="bg-white/95 backdrop-blur-2xl p-2 rounded-[2rem] border border-slate-200 shadow-2xl flex gap-1 ring-1 ring-slate-100">
            <button 
                onClick={() => setMode('distribution')} 
                className={`px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${mode === 'distribution' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}
            >
                Distribution (密度)
            </button>
            <button 
                onClick={() => setMode('flow')} 
                className={`px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${mode === 'flow' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}
            >
                Flows (流转)
            </button>
         </div>
         <button 
            onClick={() => setFocusMode(!focusMode)} 
            className={`px-8 py-4 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all border shadow-2xl ${focusMode ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200'}`}
         >
            {focusMode ? '🎯 Regional Focus' : '🌍 World View'}
         </button>
      </div>

      <svg ref={svgRef} className="w-full h-full"></svg>

      {hoverInfo && (
        <div className="absolute top-10 left-10 bg-white/98 backdrop-blur-3xl p-10 rounded-[3rem] shadow-2xl border border-slate-100 animate-fadeIn z-[150] space-y-4 max-w-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse"></div>
            <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Lab GIS Resolver</div>
          </div>
          <div className="space-y-2">
            <h4 className="text-3xl font-bold serif text-slate-900 leading-tight">{hoverInfo.title}</h4>
            <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-700">Target: {hoverInfo.to}</span>
                {hoverInfo.province && <span className="text-xs text-slate-400 font-serif italic">Administrative: {hoverInfo.province}</span>}
            </div>
          </div>
          <div className="h-px bg-slate-100 w-full"></div>
          <div className="flex items-center justify-between text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
            <span>Active Archive Sync</span>
            <span>📍 Map Mode</span>
          </div>
        </div>
      )}

      <div className="absolute bottom-10 left-10 flex flex-col gap-6 bg-white/70 backdrop-blur-xl p-8 rounded-[3rem] border border-white shadow-2xl z-40">
         <div className="space-y-5">
            <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Map Legend / 图例</h5>
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                <div className="w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-emerald-50 shadow-md"></div>
                <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Resolved Node</span>
                </div>
                <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-indigo-500/40 border-2 border-indigo-200 shadow-inner"></div>
                <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Archive Density</span>
                </div>
                <div className="flex items-center gap-4">
                <div className="w-12 h-0.5 bg-indigo-400/30 dashed border-t border-indigo-400 border-dashed"></div>
                <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Translation Path</span>
                </div>
            </div>
         </div>
         <div className="h-px bg-slate-200 w-full"></div>
         <p className="text-[10px] font-serif italic text-slate-400 max-w-[220px] leading-relaxed">
            The GIS lab performs real-time mapping of bibliographic locations. If a location is missing in focus mode, please verify your archive's city/province entries.
         </p>
      </div>
    </div>
  );
};

export default WorldMap;
