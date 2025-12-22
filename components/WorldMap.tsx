import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { BibEntry } from '../types';

interface WorldMapProps {
  data: BibEntry[];
}

// A dictionary to map Cities and Nationalities to Lat/Lng.
// In a production app, this would use a Geocoding API, but for this tool, 
// a robust lookup covering major literary capitals is faster and cost-free.
const LOCATION_LOOKUP: Record<string, [number, number]> = {
    // Cities
    "New York": [-74.006, 40.7128],
    "London": [-0.1278, 51.5074],
    "Paris": [2.3522, 48.8566],
    "Berlin": [13.4050, 52.5200],
    "Barcelona": [2.1734, 41.3851],
    "Madrid": [-3.7038, 40.4168],
    "Buenos Aires": [-58.3816, -34.6037],
    "Mexico City": [-99.1332, 19.4326],
    "Tokyo": [139.6917, 35.6895],
    "Beijing": [116.4074, 39.9042],
    "Shanghai": [121.4737, 31.2304],
    "Moscow": [37.6173, 55.7558],
    "St. Petersburg": [30.3351, 59.9343],
    "Rome": [12.4964, 41.9028],
    "Milan": [9.1900, 45.4642],
    "Dublin": [-6.2603, 53.3498],
    "Edinburgh": [-3.1883, 55.9533],

    // Nationalities (Mapped to capital or centroid)
    "American": [-95.7129, 37.0902],
    "French": [2.2137, 46.2276],
    "British": [-3.4360, 55.3781],
    "English": [-1.1743, 52.3555],
    "Scottish": [-4.2026, 56.4907],
    "German": [10.4515, 51.1657],
    "Italian": [12.5674, 41.8719],
    "Spanish": [-3.7492, 40.4637],
    "Argentine": [-63.6167, -38.4161],
    "Colombian": [-74.2973, 4.5709],
    "Russian": [105.3188, 61.5240],
    "Japanese": [138.2529, 36.2048],
    "Chinese": [104.1954, 35.8617],
    "Irish": [-8.2439, 53.4129],
};

const WorldMap: React.FC<WorldMapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mapData, setMapData] = useState<any>(null);
  const [tooltip, setTooltip] = useState<{x: number, y: number, text: string} | null>(null);
  const [missingLocations, setMissingLocations] = useState<string[]>([]);

  // Load Map Data
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(response => response.json())
      .then(topology => {
        setMapData(topojson.feature(topology, topology.objects.countries));
      })
      .catch(err => console.error("Failed to load map data", err));
  }, []);

  // Normalize location helper
  const getCoords = (name?: string): [number, number] | null => {
      if (!name) return null;
      // Exact match
      if (LOCATION_LOOKUP[name]) return LOCATION_LOOKUP[name];
      // Simple lookup match
      const key = Object.keys(LOCATION_LOOKUP).find(k => name.includes(k));
      return key ? LOCATION_LOOKUP[key] : null;
  };

  useEffect(() => {
    if (!svgRef.current || !mapData) return;

    const width = 960;
    const height = 550;
    
    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("width", "100%")
      .style("height", "auto")
      .style("background", "#f8fafc"); // Slate-50 like bg

    // Projection
    const projection = d3.geoNaturalEarth1()
      .scale(160)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Group for Map
    const g = svg.append("g");
    
    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    svg.call(zoom);

    // Draw Countries
    g.append("g")
      .selectAll("path")
      .data(mapData.features)
      .join("path")
      .attr("fill", "#e2e8f0") // Slate-200
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 0.5)
      .attr("d", path as any)
      .on("mouseover", function() {
          d3.select(this).attr("fill", "#cbd5e1");
      })
      .on("mouseout", function() {
          d3.select(this).attr("fill", "#e2e8f0");
      });

    // Process Flows
    const flows: {source: [number, number], target: [number, number], count: number, label: string}[] = [];
    const flowMap = new Map<string, number>();
    const unmapped = new Set<string>();

    data.forEach(entry => {
        const sourceName = entry.originalCity || entry.author.nationality;
        const targetName = entry.city || entry.translator.nationality; 
        
        const sourceCoords = getCoords(sourceName);
        const targetCoords = getCoords(targetName);

        if (!sourceCoords && sourceName) unmapped.add(sourceName);
        if (!targetCoords && targetName) unmapped.add(targetName);

        if (sourceCoords && targetCoords) {
            // Avoid self-loops 
            if (sourceCoords[0] === targetCoords[0] && sourceCoords[1] === targetCoords[1]) return;

            const key = `${sourceName}->${targetName}`;
            if (!flowMap.has(key)) {
                flowMap.set(key, 1);
                flows.push({
                    source: sourceCoords, 
                    target: targetCoords, 
                    count: 1, 
                    label: `${entry.title}: ${sourceName} → ${targetName}`
                });
            } else {
                 flows.push({
                    source: sourceCoords, 
                    target: targetCoords, 
                    count: 1, 
                    label: `${entry.title}: ${sourceName} → ${targetName}`
                });
            }
        }
    });

    setMissingLocations(Array.from(unmapped));

    // Draw Flows
    const linkGroup = g.append("g").attr("fill", "none").attr("stroke-opacity", 0.6);
    
    const lines = linkGroup.selectAll("path")
        .data(flows)
        .join("path")
        .attr("stroke", "#6366f1") // Indigo
        .attr("stroke-width", 1.5)
        .attr("d", d => {
            // Draw curve
            const route = {
                type: "LineString",
                coordinates: [d.source, d.target]
            };
            return path(route as any);
        })
        .on("mouseover", (event, d) => {
            d3.select(event.currentTarget).attr("stroke", "#ef4444").attr("stroke-opacity", 1).attr("stroke-width", 3);
            setTooltip({
                x: event.pageX,
                y: event.pageY,
                text: d.label
            });
        })
        .on("mouseout", (event) => {
             d3.select(event.currentTarget).attr("stroke", "#6366f1").attr("stroke-opacity", 0.6).attr("stroke-width", 1.5);
             setTooltip(null);
        });

    // Draw Source/Target dots
    g.append("g")
        .selectAll("circle")
        .data(flows.flatMap(f => [
            {coords: f.source, type: 'source'}, 
            {coords: f.target, type: 'target'}
        ]))
        .join("circle")
        .attr("transform", d => `translate(${projection(d.coords)!})`)
        .attr("r", 3)
        .attr("fill", d => d.type === 'source' ? "#ef4444" : "#10b981") // Red source, Green target
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5);

  }, [data, mapData]);

  return (
    <div className="relative w-full bg-slate-50 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <svg ref={svgRef} className="w-full h-auto cursor-move"></svg>
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur p-3 rounded-lg shadow border border-slate-100 text-xs z-10">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2">Translation Flow</h4>
            <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-slate-600">Origin (Original City/Nationality)</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-slate-600">Destination (Target City)</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-indigo-500"></div>
                <span className="text-slate-600">Circulation Path</span>
            </div>
        </div>
        
        {/* Missing Locations Alert */}
        {missingLocations.length > 0 && (
             <div className="absolute bottom-4 right-4 bg-orange-50/90 backdrop-blur p-3 rounded-lg shadow border border-orange-100 text-xs max-w-xs z-10">
                 <div className="flex items-center gap-2 mb-1 text-orange-700 font-bold uppercase tracking-wider">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Unmapped Locations
                 </div>
                 <p className="text-orange-600 leading-snug mb-2">
                     The following places could not be located on the map automatically:
                 </p>
                 <div className="flex flex-wrap gap-1">
                     {missingLocations.slice(0, 5).map(loc => (
                         <span key={loc} className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px]">{loc}</span>
                     ))}
                     {missingLocations.length > 5 && <span className="text-orange-500 text-[10px] italic">+{missingLocations.length - 5} more</span>}
                 </div>
             </div>
        )}

        {/* Hover Info Box (Replaces Tooltip for stability) */}
        {tooltip && (
             <div className="absolute top-4 right-4 bg-white/95 backdrop-blur shadow-lg p-3 rounded-lg border-l-4 border-indigo-500 max-w-xs animate-fadeIn z-20">
                 <div className="text-xs font-bold text-slate-400 uppercase mb-1">Active Flow</div>
                 <div className="text-sm text-slate-800 font-medium">{tooltip.text}</div>
             </div>
        )}
    </div>
  );
};

export default WorldMap;