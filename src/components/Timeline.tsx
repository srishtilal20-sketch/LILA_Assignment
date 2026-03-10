import React, { useEffect, useState } from 'react';
import { Play, Pause, FastForward, Rewind } from 'lucide-react';
import { cn } from '../lib/utils';

interface TimelineProps {
  minTime: number;
  maxTime: number;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  className?: string;
}

export function Timeline({ minTime, maxTime, currentTime, setCurrentTime, className }: TimelineProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    let animationFrame: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (isPlaying) {
        const delta = now - lastTime;
        const timeDelta = delta * speed * 1000; // speed multiplier
        
        setCurrentTime(prev => {
          const next = prev + timeDelta;
          if (next >= maxTime) {
            setIsPlaying(false);
            return maxTime;
          }
          return next;
        });
      }
      lastTime = now;
      animationFrame = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      animationFrame = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, speed, maxTime, setCurrentTime]);

  const progress = maxTime > minTime ? ((currentTime - minTime) / (maxTime - minTime)) * 100 : 0;

  const formatTime = (ts: number) => {
    if (!ts || isNaN(ts)) return '00:00';
    const d = new Date(ts);
    return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("bg-white border-t border-gray-200 p-4 flex items-center gap-6", className)}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setCurrentTime(minTime);
            setIsPlaying(false);
          }}
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Rewind className="w-5 h-5" />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-3 bg-indigo-500 text-white hover:bg-indigo-600 rounded-full transition-colors shadow-lg shadow-indigo-500/20"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <button
          onClick={() => setSpeed(s => s === 1 ? 2 : s === 2 ? 5 : s === 5 ? 10 : 1)}
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 font-mono text-xs"
        >
          <FastForward className="w-5 h-5" />
          {speed}x
        </button>
      </div>

      <div className="flex-1 flex items-center gap-4">
        <span className="text-xs font-mono text-gray-500 w-12 text-right">
          {formatTime(currentTime)}
        </span>
        <div className="flex-1 relative h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer group"
             onClick={(e) => {
               const rect = e.currentTarget.getBoundingClientRect();
               const p = (e.clientX - rect.left) / rect.width;
               setCurrentTime(minTime + p * (maxTime - minTime));
             }}>
          <div 
            className="absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-mono text-gray-500 w-12">
          {formatTime(maxTime)}
        </span>
      </div>
    </div>
  );
}
