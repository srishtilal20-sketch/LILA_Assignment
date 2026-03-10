import React, { useEffect, useRef, useState } from 'react';
import { TelemetryEvent, MAP_CONFIG, MapId } from '../lib/mockData';
import { cn } from '../lib/utils';
import * as d3 from 'd3';
import { RotateCw, Maximize, ChevronDown, ChevronUp } from 'lucide-react';

interface MapCanvasProps {
  events: TelemetryEvent[];
  mapId: MapId;
  currentTime: number;
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

export function MapCanvas({ events, mapId, currentTime, layers, customMapImages = {}, className }: MapCanvasProps) {
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

    // Apply rotation
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

    // Filter events up to current time
    const visibleEvents = events.filter(e => e.ts <= currentTime);

    // Helper to convert world to pixel
    const toPixel = (x: number, z: number) => {
      const u = (x - config.origin.x) / config.scale;
      const v = (z - config.origin.z) / config.scale;
      return {
        px: u * width,
        py: (1 - v) * height
      };
    };

    // Group events by user
    const userPaths = new Map<string, TelemetryEvent[]>();
    visibleEvents.forEach(e => {
      if (!userPaths.has(e.user_id)) {
        userPaths.set(e.user_id, []);
      }
      userPaths.get(e.user_id)!.push(e);
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
          gradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.4)');
          gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
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
      userPaths.forEach((path, userId) => {
        if (path.length < 2) return;
        
        ctx.beginPath();
        const start = toPixel(path[0].x, path[0].z);
        ctx.moveTo(start.px, start.py);
        
        for (let i = 1; i < path.length; i++) {
          const p = toPixel(path[i].x, path[i].z);
          ctx.lineTo(p.px, p.py);
        }
        
        // Bots: numeric, Humans: UUID
        const isBot = /^\d+$/.test(userId);
        ctx.strokeStyle = isBot ? 'rgba(34, 197, 94, 0.8)' : 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2 / transform.k;
        if (!isBot) {
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 2 / transform.k;
        }
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      });
    }

    // Draw Events
    visibleEvents.forEach(e => {
      if (e.event === 'move') return;

      const { px, py } = toPixel(e.x, e.z);
      const isBot = /^\d+$/.test(e.user_id);
      const size = 6 / transform.k;
      
      ctx.save();
      ctx.translate(px, py);

      if (e.event === 'kill' && layers.kills) {
        ctx.fillStyle = isBot ? '#eab308' : '#ef4444';
        ctx.beginPath();
        ctx.moveTo(0, -size * 1.5);
        ctx.quadraticCurveTo(size, 0, 0, size);
        ctx.quadraticCurveTo(-size, 0, 0, -size * 1.5);
        ctx.fill();
      } else if (e.event === 'death' && layers.deaths) {
        ctx.fillStyle = isBot ? '#eab308' : '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -size * 0.2, size * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-size * 0.4, 0, size * 0.8, size * 0.6);
      } else if (e.event === 'storm_death' && layers.stormDeaths) {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(-size, -size);
        ctx.lineTo(size, -size);
        ctx.lineTo(size * 0.5, -size * 0.2);
        ctx.lineTo(-size * 0.5, -size * 0.2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-size * 0.6, 0);
        ctx.lineTo(size * 0.6, 0);
        ctx.lineTo(size * 0.2, size * 0.8);
        ctx.lineTo(-size * 0.2, size * 0.8);
        ctx.fill();
      } else if (e.event === 'loot' && layers.loot) {
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        ctx.fill();
      }

      ctx.restore();
    });

    ctx.restore();
  }, [events, mapId, currentTime, layers, mapImage, transform]);

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
        <button onClick={handleRotate} className="p-2 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-700 transition-colors" title="Rotate 90°">
          <RotateCw className="w-4 h-4" />
        </button>
      </div>
      
      {/* Legend overlay */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 text-xs text-gray-700 shadow-lg overflow-hidden transition-all w-48">
        <div 
          className={cn("flex items-center justify-between p-3 cursor-pointer bg-gray-50/80 hover:bg-gray-100 transition-colors", isLegendOpen ? "border-b border-gray-200" : "")}
          onClick={() => setIsLegendOpen(!isLegendOpen)}
        >
          <span className="font-medium text-gray-900">Legend</span>
          {isLegendOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
        
        {isLegendOpen && (
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2 Q12 8 8 14 Q4 8 8 2 Z" fill="#ef4444"/></svg> Player Kill
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="6" r="5" fill="#ef4444"/><rect x="5" y="8" width="6" height="5" fill="#ef4444"/></svg> Player Death
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2 Q12 8 8 14 Q4 8 8 2 Z" fill="#eab308"/></svg> Bot Kill
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="6" r="5" fill="#eab308"/><rect x="5" y="8" width="6" height="5" fill="#eab308"/></svg> Bot Death
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 4 L14 4 L11 7 L5 7 Z M4 9 L12 9 L9 14 L7 14 Z" fill="#3b82f6"/></svg> Storm Death
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2 L14 8 L8 14 L2 8 Z" fill="#22c55e"/></svg> Loot Pickup
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
              <div className="w-4 h-0.5 bg-white border border-gray-300"></div> Player Movement
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-green-500"></div> Bot Movement
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
              <div className="w-16 h-2 rounded bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500"></div> Heatmap
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
