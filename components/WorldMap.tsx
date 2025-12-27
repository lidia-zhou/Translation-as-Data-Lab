
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { BibEntry } from '../types';

interface WorldMapProps {
  data: BibEntry[];
}

const WorldMap: React.FC<WorldMapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mapData, setMapData] = useState<any>(null);
  const [hoverInfo, setHoverInfo] = useState<{title: string, from: string, to: string} | null>(null);

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(t => setMapData(topojson.feature(t, t.objects.countries)));
  }, []);

  const flows = useMemo(() => {
    return data.map(e => {
      const sourceCoord = (e.customMetadata?.sourceCoord as any) || null;
      const targetCoord = (e.customMetadata?.targetCoord as any) || null;
      
      if (sourceCoord && targetCoord) {
        return { source: sourceCoord, target: targetCoord, title: e.title, from: e.originalCity || 'Unknown', to: e.city || 'Unknown' };
      }
      return null;
    }).filter(Boolean) as any[];
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !mapData) return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.parentElement?.clientWidth || svgRef.current.clientWidth;
    const height = svgRef.current.parentElement?.clientHeight || svgRef.current.clientHeight;
    
    svg.attr("width", width).attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g");
    // 动态缩放和居中投影
    const projection = d3.geoNaturalEarth1().scale(width / 5.5).translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    const zoom = d3.zoom<SVGSVGElement, any>().scaleExtent([1, 15]).on("zoom", e => g.attr("transform", e.transform));
    svg.call(zoom);

    // 绘制海洋背景
    g.append("path").datum({type: "Sphere"}).attr("fill", "#fcfcfd").attr("d", path as any);

    // 绘制陆地
    g.selectAll(".country")
      .data(mapData.features)
      .join("path")
      .attr("fill", "#f1f5f9")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .attr("d", path as any);

    const arcLayer = g.append("g");
    const particlesLayer = g.append("g");

    const arcGenerator = (d: any) => {
      const route = { type: "LineString", coordinates: [d.source, d.target] };
      return path(route as any);
    };

    arcLayer.selectAll(".flow-arc")
      .data(flows)
      .join("path")
      .attr("class", "flow-arc")
      .attr("fill", "none")
      .attr("stroke", "#6366f1")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.2)
      .attr("d", arcGenerator)
      .on("mouseenter", (e, d) => {
          setHoverInfo({title: d.title, from: d.from, to: d.to});
          d3.select(e.target).attr("stroke-opacity", 1).attr("stroke-width", 3).attr("stroke", "#4f46e5");
      })
      .on("mouseleave", (e) => {
          setHoverInfo(null);
          d3.select(e.target).attr("stroke-opacity", 0.2).attr("stroke-width", 1.5).attr("stroke", "#6366f1");
      });

    const timer = d3.timer((elapsed) => {
      particlesLayer.selectAll(".particle").remove();
      
      particlesLayer.selectAll(".particle")
        .data(flows)
        .join("circle")
        .attr("class", "particle")
        .attr("r", 2.5)
        .attr("fill", "#6366f1")
        .attr("filter", "blur(1px)")
        .attr("transform", d => {
          const t = (elapsed * 0.0005 + flows.indexOf(d) * 0.1) % 1;
          const interp = d3.geoInterpolate(d.source, d.target);
          const coord = interp(t);
          const pos = projection(coord);
          return pos ? `translate(${pos[0]}, ${pos[1]})` : "translate(-100, -100)";
        });
    });

    flows.forEach(f => {
      const s = projection(f.source);
      const t = projection(f.target);
      if (s && t) {
        g.append("circle").attr("cx", s[0]).attr("cy", s[1]).attr("r", 3).attr("fill", "#f43f5e").attr("stroke", "white").attr("stroke-width", 1);
        g.append("circle").attr("cx", t[0]).attr("cy", t[1]).attr("r", 3).attr("fill", "#10b981").attr("stroke", "white").attr("stroke-width", 1);
      }
    });

    return () => timer.stop();
  }, [mapData, flows]);

  return (
    <div className="flex-1 w-full h-full bg-[#fcfcfd] relative overflow-hidden">
      <svg ref={svgRef} className="w-full h-full"></svg>
      {hoverInfo && (
        <div className="absolute top-10 left-10 bg-white/95 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl border border-slate-100 animate-fadeIn z-50 space-y-3">
          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Translation Flow Insight</div>
          <div className="text-2xl font-bold serif text-slate-800">{hoverInfo.title}</div>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
            <span className="text-rose-500 font-bold">{hoverInfo.from}</span>
            <span className="text-slate-300">→</span>
            <span className="text-emerald-500 font-bold">{hoverInfo.to}</span>
          </div>
        </div>
      )}
      <div className="absolute bottom-10 right-10 bg-white/80 p-6 rounded-3xl border border-slate-100 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-rose-500"></div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Origin of Text</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Place of Publication</span>
        </div>
      </div>
    </div>
  );
};

export default WorldMap;
