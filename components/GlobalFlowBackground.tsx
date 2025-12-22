import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

const GlobalFlowBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let land: any = null;
    let timer: d3.Timer | null = null;
    
    const projection = d3.geoOrthographic()
        .scale(Math.min(width, height) * 0.45)
        .translate([width / 1.15, height / 1.15]) // Corner position
        .clipAngle(90);

    const path = d3.geoPath(projection, ctx);
    const graticule = d3.geoGraticule();

    // Generate random points for "translation arcs"
    const arcs = Array.from({ length: 15 }, () => ({
        source: [Math.random() * 360 - 180, Math.random() * 180 - 90],
        target: [Math.random() * 360 - 180, Math.random() * 180 - 90],
        offset: Math.random() * 2000,
        speed: 0.15 + Math.random() * 0.4,
        hue: Math.random() * 40 + 220 // Indigo-ish hues
    }));

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      projection.scale(Math.min(width, height) * 0.45).translate([width / 1.15, height / 1.15]);
    };
    window.addEventListener('resize', resize);
    
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(response => response.json())
      .then(topology => {
        land = topojson.feature(topology, topology.objects.countries);
        startAnimation();
      })
      .catch(err => console.error("Failed to load map bg", err));

    const startAnimation = () => {
        let rotation = 0;
        
        timer = d3.timer((elapsed) => {
            rotation = elapsed * 0.0025; 
            projection.rotate([rotation, -15]);

            ctx.clearRect(0, 0, width, height);

            // Subtle background radial gradient for depth
            const gradient = ctx.createRadialGradient(
                width / 1.15, height / 1.15, 0,
                width / 1.15, height / 1.15, width * 0.7
            );
            gradient.addColorStop(0, 'rgba(238, 242, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Sphere base shadow/glow
            ctx.beginPath();
            path({type: "Sphere"});
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fill();

            // Graticule lines
            ctx.beginPath();
            path(graticule());
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.04)'; 
            ctx.lineWidth = 0.5;
            ctx.stroke();

            if (land) {
                // Draw land
                ctx.beginPath();
                path(land);
                ctx.fillStyle = 'rgba(226, 232, 240, 0.4)'; 
                ctx.fill();
                
                // Fine borders
                ctx.lineWidth = 0.3;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.stroke();
            }

            // Draw animated translation arcs
            ctx.save();
            ctx.setLineDash([2, 5]);
            arcs.forEach(arc => {
                const route: any = {
                    type: "LineString",
                    coordinates: [arc.source, arc.target]
                };
                
                // Draw full arc path
                ctx.beginPath();
                path(route);
                ctx.strokeStyle = `hsla(${arc.hue}, 70%, 50%, 0.1)`;
                ctx.lineWidth = 0.8;
                ctx.stroke();

                // Draw moving "text particle"
                const progress = ((elapsed + arc.offset) * 0.001 * arc.speed) % 1;
                const interpolator = d3.geoInterpolate(arc.source as any, arc.target as any);
                const pos = interpolator(progress);
                const [px, py] = projection(pos) || [0, 0];
                
                // Visibility check (front side of globe)
                const distance = d3.geoDistance(projection.invert!([width / 1.15, height / 1.15]) as any, pos);
                if (distance < Math.PI / 2) {
                    ctx.beginPath();
                    ctx.arc(px, py, 1.2, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${arc.hue}, 70%, 40%, 0.3)`;
                    ctx.fill();
                    
                    // Tiny trail/glow
                    ctx.beginPath();
                    ctx.arc(px, py, 4, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${arc.hue}, 70%, 60%, 0.05)`;
                    ctx.fill();
                }
            });
            ctx.restore();
            
            // Sphere outline
            ctx.beginPath();
            path({type: "Sphere"});
            ctx.strokeStyle = 'rgba(203, 213, 225, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    };

    return () => {
        window.removeEventListener('resize', resize);
        if (timer) timer.stop();
    };
  }, []);

  return (
    <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.8, zIndex: 0 }}
    />
  );
};

export default GlobalFlowBackground;