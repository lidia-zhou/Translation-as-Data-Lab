
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { BibEntry } from '../types';

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
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(t => setMapData(topojson.feature(t, t.objects.countries)));
  }, []);

  const geoData = useMemo(() => {
    const flows = data.map(e => {
      const sourceCoord = (e.customMetadata?.sourceCoord as any) || null;
      const targetCoord = (e.customMetadata?.targetCoord as any) || null;
      if (sourceCoord && targetCoord) {
        return { source: sourceCoord, target: targetCoord, title: e.title, from: e.originalCity || 'Unknown', to: e.city || 'Unknown', province: e.provinceState };
      }
      return null;
    }).filter(Boolean) as any[];

    // Grouping by location for Distribution mode
    const distribution = new Map<string, any>();
    flows.forEach(f => {
        const key = `${f.target[0]},${f.target[1]}`;
        if (!distribution.has(key)) {
            distribution.set(key, { coords: f.target, count: 0, name: f.to, province: f.province });
        }
        distribution.get(key).count++;
    });

    return { flows, distribution: Array.from(distribution.values()) };
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

    // Dynamic Projection: Use Mercator for local GIS feel, NaturalEarth for global
    let projection = d3.geoMercator();
    
    if (focusMode && geoData.distribution.length > 0) {
        // Calculate bounds of the data points
        const points = geoData.distribution.map(d => d.coords);
        const lons = points.map(p => p[0]);
        const lats = points.map(p => p[1]);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        // Standard Mercator projection focused on the region
        projection = d3.geoMercator()
            .center([(minLon + maxLon) / 2, (minLat + maxLat) / 2])
            .scale(width * 2) // Aggressive zoom for regional focus
            .translate([width / 2, height / 2]);
    } else {
        projection = d3.geoMercator()
            .scale(width / 6.5)
            .translate([width / 2, height / 1.5]);
    }

    const path = d3.geoPath().projection(projection);

    const zoom = d3.zoom<SVGSVGElement, any>().scaleExtent([0.5, 40]).on("zoom", e => g.attr("transform", e.transform));
    svg.call(zoom);

    // Oceans
    g.append("path").datum({type: "Sphere"}).attr("fill", "#f8fafc").attr("d", path as any);

    // Map base - draw countries
    g.selectAll(".country")
      .data(mapData.features)
      .join("path")
      .attr("fill", "#ffffff")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", 0.5)
      .attr("d", path as any);

    if (mode === 'flow') {
      const arcLayer = g.append("g");
      const arcGenerator = (d: any) => {
        const route = { type: "LineString", coordinates: [d.source, d.target] };
        return path(route as any);
      };

      arcLayer.selectAll(".flow-arc")
        .data(geoData.flows)
        .join("path")
        .attr("fill", "none")
        .attr("stroke", "#6366f1")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.1)
        .attr("d", arcGenerator)
        .on("mouseenter", (e, d) => {
            setHoverInfo({title: d.title, from: d.from, to: d.to, province: d.province});
            d3.select(e.target).attr("stroke-opacity", 1).attr("stroke-width", 3).attr("stroke", "#4f46e5");
        })
        .on("mouseleave", (e) => {
            setHoverInfo(null);
            d3.select(e.target).attr("stroke-opacity", 0.1).attr("stroke-width", 1.5).attr("stroke", "#6366f1");
        });
    }

    if (mode === 'distribution') {
        const bubbleLayer = g.append("g");
        const radiusScale = d3.scaleSqrt().domain([1, Math.max(1, ...geoData.distribution.map(d => d.count))]).range([5, 40]);

        bubbleLayer.selectAll(".dist-bubble")
            .data(geoData.distribution)
            .join("circle")
            .attr("cx", d => projection(d.coords)![0])
            .attr("cy", d => projection(d.coords)![1])
            .attr("r", d => radiusScale(d.count))
            .attr("fill", "#6366f1")
            .attr("fill-opacity", 0.4)
            .attr("stroke", "#4f46e5")
            .attr("stroke-width", 1.5)
            .attr("class", "cursor-pointer transition-all hover:fill-opacity-80")
            .on("mouseenter", (e, d) => {
                setHoverInfo({title: `${d.count} Works`, from: "Aggregation", to: d.name, province: d.province});
            })
            .on("mouseleave", () => setHoverInfo(null));
            
        bubbleLayer.selectAll(".dist-label")
            .data(geoData.distribution)
            .join("text")
            .attr("x", d => projection(d.coords)![0])
            .attr("y", d => projection(d.coords)![1] + 5)
            .attr("text-anchor", "middle")
            .text(d => d.count)
            .attr("class", "text-[10px] font-black fill-white pointer-events-none");
    }

    // Points for cities
    geoData.distribution.forEach(f => {
      const p = projection(f.coords);
      if (p) {
        g.append("circle").attr("cx", p[0]).attr("cy", p[1]).attr("r", 2).attr("fill", "#10b981").attr("stroke", "white").attr("stroke-width", 0.5);
      }
    });

  }, [mapData, geoData, mode, focusMode]);

  return (
    <div className="flex-1 w-full h-full bg-slate-50 relative overflow-hidden flex flex-col">
      <div className="absolute top-10 right-10 z-[100] flex gap-3">
         <div className="bg-white/90 backdrop-blur-xl p-2 rounded-2xl border border-slate-200 shadow-xl flex gap-1">
            <button 
                onClick={() => setMode('distribution')} 
                className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'distribution' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
            >
                Distribution (点)
            </button>
            <button 
                onClick={() => setMode('flow')} 
                className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'flow' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
            >
                Flow (线)
            </button>
         </div>
         <button 
            onClick={() => setFocusMode(!focusMode)} 
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-xl ${focusMode ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200'}`}
         >
            {focusMode ? '🎯 Regional Focus' : '🌍 World View'}
         </button>
      </div>

      <svg ref={svgRef} className="w-full h-full"></svg>

      {hoverInfo && (
        <div className="absolute top-10 left-10 bg-white/95 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl border border-slate-100 animate-fadeIn z-50 space-y-3 max-w-sm">
          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">GIS Lab Insight</div>
          <div className="text-2xl font-bold serif text-slate-800 leading-tight">{hoverInfo.title}</div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-800">Location: {hoverInfo.to}</div>
            {hoverInfo.province && <div className="text-xs text-indigo-600 font-serif italic">Province/State: {hoverInfo.province}</div>}
          </div>
          <div className="h-px bg-slate-100 w-full"></div>
          <div className="text-[10px] text-slate-400 font-mono">Archive Entry Analysis Active</div>
        </div>
      )}

      <div className="absolute bottom-10 left-10 flex gap-10 bg-white/50 backdrop-blur-md p-6 rounded-3xl border border-white/20">
         <div className="space-y-4">
            <h5 className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4">Spatial Map Legends</h5>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-lg shadow-indigo-200"></div>
              <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Circulation Hub</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-1 bg-indigo-500/20 rounded-full"></div>
              <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Textual Flow Arc</span>
            </div>
         </div>
         <div className="w-px bg-slate-200"></div>
         <div className="space-y-2">
            <p className="text-[10px] font-serif italic text-slate-400 max-w-[200px]">GIS mapping is automatically projected based on the geographic bounds of your archival dataset.</p>
         </div>
      </div>
    </div>
  );
};

export default WorldMap;
