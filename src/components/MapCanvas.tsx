import React, { useEffect, useRef, useState } from 'react';
import { TelemetryEvent, MAP_CONFIG, MapId } from '../lib/mockData';
import { cn } from '../lib/utils';
import * as d3 from 'd3';
import { RotateCw, Maximize, ChevronDown, ChevronUp, List } from 'lucide-react';

const flamePath = new Path2D("M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z");
const skullPath = new Path2D("M9 12h.01M15 12h.01M8 20v2h8v-2M12.5 17l-.5-1-1.5 1-1.5-1-.5 1M16 16a6 6 0 0 0-8 0c-2.5 0-3.5 1.5-3.5 3s1 3 3 3h8c2 0 3-1.5 3-3s-1-3-3-3Z");
const cloudLightningPath = new Path2D("M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973M13 11l-4 6h6l-4 6");
const diamondPath = new Path2D("M12 2L22 12L12 22L2 12Z");


interface MapCanvasProps {
  events: TelemetryEvent[];
  mapId: MapId;
  layers: {
    paths: boolean;
    kills: boolean;
    deaths: boolean;
    stormDeaths: boolean;
    loot: boolean;
    heatmap: boolean;
  };
  customMapImages?: Record<string, string>;
  className?: string;
}

export function MapCanvas({ events, mapId, layers, customMapImages = {}, className }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [rotation, setRotation] = useState(0);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);

  useEffect(() => {
    // Load map image
    const img = new Image();
    
    const mapImages: Record<string, string> = {
      'AmbroseValley': '/AmbroseValley_Minimap.png',
      'GrandRift': '/GrandRift_Minimap.png',
      'Lockdown': '/Lockdown_Minimap.jpg',
    };
    
    img.src = customMapImages[mapId] || mapImages[mapId] || `https://picsum.photos/seed/${mapId}/1024/1024?blur=4`;
    img.onload = () => setMapImage(img);
    img.onerror = () => {
      if (mapImages[mapId] && !customMapImages[mapId]) {
        const fallbackImg = new Image();
        fallbackImg.src = `https://picsum.photos/seed/${mapId}/1024/1024?blur=4`;
        fallbackImg.onload = () => setMapImage(fallbackImg);
      }
    };
  }, [mapId, customMapImages]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.5, 10])
      .on('zoom', (e) => {
        setTransform(e.transform);
      });

    zoomRef.current = zoom;
    d3.select(canvas).call(zoom);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Apply rotation to entire context around center
    ctx.translate(width / 2, height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);

    // Draw map image
    if (mapImage) {
      ctx.drawImage(mapImage, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(0, 0, width, height);
    }

    const config = MAP_CONFIG[mapId];
    if (!config) {
      ctx.restore();
      return;
    }

    // Use all events since playback is removed
    const visibleEvents = events;

    // Helper to convert world to pixel
    const toPixel = (x: number, z: number) => {
      const u = (x - config.origin.x) / config.scale;
      const v = (z - config.origin.z) / config.scale;
      return {
        px: u * width,
        py: (1 - v) * height
      };
    };

    // Group events by user and match
    const userPaths = new Map<string, TelemetryEvent[]>();
    visibleEvents.forEach(e => {
      const key = `${e.match_id}-${e.user_id}`;
      if (!userPaths.has(key)) {
        userPaths.set(key, []);
      }
      userPaths.get(key)!.push(e);
    });

    // Draw Heatmap
    if (layers.heatmap) {
      ctx.globalAlpha = 0.05;
      visibleEvents.forEach(e => {
        if (e.event === 'move') {
          const { px, py } = toPixel(e.x, e.z);
          const radius = 20 / transform.k;
          const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
          gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
          gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.5)');
          gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1.0;
    }

    // Draw Paths
    if (layers.paths) {
      userPaths.forEach((path, key) => {
        if (path.length < 2) return;
        
        ctx.beginPath();
        const start = toPixel(path[0].x, path[0].z);
        ctx.moveTo(start.px, start.py);
        
        for (let i = 1; i < path.length; i++) {
          const p = toPixel(path[i].x, path[i].z);
          ctx.lineTo(p.px, p.py);
        }
        
        // Bots: numeric, Humans: UUID
        const isBot = /^\d+$/.test(path[0].user_id);
        if (isBot) {
          ctx.strokeStyle = 'rgba(99, 102, 241, 1)'; // Solid Indigo
          ctx.lineWidth = 2 / transform.k;
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; // White
          ctx.lineWidth = 2 / transform.k;
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4 / transform.k;
          ctx.stroke();
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }
      });
    }

    // Draw Events
    visibleEvents.forEach(e => {
      if (e.event === 'move') return;

      const { px, py } = toPixel(e.x, e.z);
      const isBot = /^\d+$/.test(e.user_id);
      const size = 16 / transform.k;
      
      ctx.save();
      ctx.translate(px, py);
      const scale = size / 24;
      ctx.scale(scale, scale);
      ctx.translate(-12, -12);
      
      ctx.lineWidth = 2 / scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (e.event === 'kill' && layers.kills) {
        ctx.strokeStyle = isBot ? '#eab308' : '#ef4444';
        ctx.stroke(flamePath);
      } else if (e.event === 'death' && layers.deaths) {
        ctx.strokeStyle = isBot ? '#eab308' : '#ef4444';
        ctx.stroke(skullPath);
      } else if (e.event === 'storm_death' && layers.stormDeaths) {
        ctx.strokeStyle = '#3b82f6';
        ctx.stroke(cloudLightningPath);
      } else if (e.event === 'loot' && layers.loot) {
        ctx.strokeStyle = '#22c55e';
        ctx.stroke(diamondPath);
      }

      ctx.restore();
    });

    ctx.restore();
  }, [events, mapId, layers, mapImage, transform, rotation]);

  const handleFitToScreen = () => {
    const canvas = canvasRef.current;
    if (!canvas || !zoomRef.current) return;
    d3.select(canvas).transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  return (
    <div className={cn("relative w-full h-full overflow-hidden bg-white rounded-xl border border-gray-200", className)}>
      <canvas
        ref={canvasRef}
        width={1024}
        height={1024}
        className="w-full h-full object-contain cursor-grab active:cursor-grabbing"
      />
      
      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button onClick={handleFitToScreen} className="p-2 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-700 transition-colors" title="Fit to Screen">
          <Maximize className="w-4 h-4" />
        </button>
        <button onClick={handleRotate} className="p-2 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-700 transition-colors" title="Rotate Map">
          <RotateCw className="w-4 h-4" />
        </button>
      </div>
      
      {/* Legend overlay */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
        {!isLegendOpen ? (
          <button 
            onClick={() => setIsLegendOpen(true)}
            className="p-3 bg-white/90 backdrop-blur-sm rounded-full border border-gray-200 shadow-md hover:bg-gray-50 text-gray-700 transition-colors flex items-center gap-2"
            title="Open Legend"
          >
            <List className="w-5 h-5" />
          </button>
        ) : (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 text-xs text-gray-700 shadow-lg overflow-hidden transition-all w-48">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer bg-gray-50/80 hover:bg-gray-100 transition-colors border-b border-gray-200"
              onClick={() => setIsLegendOpen(false)}
            >
              <span className="font-medium text-gray-900">Legend</span>
              <ChevronDown className="w-4 h-4" />
            </div>
            <div className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> Player Kill
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h.01M15 12h.01M8 20v2h8v-2M12.5 17l-.5-1-1.5 1-1.5-1-.5 1M16 16a6 6 0 0 0-8 0c-2.5 0-3.5 1.5-3.5 3s1 3 3 3h8c2 0 3-1.5 3-3s-1-3-3-3Z"/></svg> Player Death
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> Bot Kill
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h.01M15 12h.01M8 20v2h8v-2M12.5 17l-.5-1-1.5 1-1.5-1-.5 1M16 16a6 6 0 0 0-8 0c-2.5 0-3.5 1.5-3.5 3s1 3 3 3h8c2 0 3-1.5 3-3s-1-3-3-3Z"/></svg> Bot Death
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973M13 11l-4 6h6l-4 6"/></svg> Storm Death
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L22 12L12 22L2 12Z"/></svg> Loot Pickup
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
              <div className="w-4 h-0.5 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.5)]"></div> Player Movement
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-indigo-500"></div> Bot Movement
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 flex-col items-start">
              <div className="w-full h-2 rounded bg-gradient-to-r from-green-500 via-yellow-400 to-red-500"></div>
              <div className="flex justify-between w-full text-[10px] text-gray-500 font-medium">
                <span>Low</span>
                <span>Heatmap</span>
                <span>High</span>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
