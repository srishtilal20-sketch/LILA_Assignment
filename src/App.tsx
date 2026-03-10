import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MapCanvas } from './components/MapCanvas';
import { Timeline } from './components/Timeline';
import { generateMockData, TelemetryEvent, MapId, MAP_CONFIG } from './lib/mockData';
import { Upload, Loader2 } from 'lucide-react';
import { parquetReadObjects } from 'hyparquet';

export default function App() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [mapId, setMapId] = useState<MapId>('AmbroseValley');
  const [matchId, setMatchId] = useState<string>('All');
  const [playerId, setPlayerId] = useState<string>('All');
  const [playerType, setPlayerType] = useState<'All' | 'Human' | 'Bot'>('All');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [availableMaps, setAvailableMaps] = useState<string[]>(['AmbroseValley', 'GrandRift', 'Lockdown']);
  const [customMapImages, setCustomMapImages] = useState<Record<string, string>>({});
  
  const [layers, setLayers] = useState({
    paths: true,
    kills: true,
    deaths: true,
    stormDeaths: true,
    loot: true,
    heatmap: false,
  });

  // Generate initial mock data
  useEffect(() => {
    const data = generateMockData(10000);
    setEvents(data);
    if (data.length > 0) {
      setMatchId(data[0].match_id);
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setLoadingProgress('Scanning files...');

    try {
      // Filter for parquet files
      const parquetFiles = Array.from(files).filter((f: File) => f.name.endsWith('.parquet'));
      
      if (parquetFiles.length === 0) {
        alert('No .parquet files found in the selection.');
        setIsLoading(false);
        return;
      }

      // Sort files: prioritize paths containing "February 10" or similar, then others
      parquetFiles.sort((a: File, b: File) => {
        const aPath = a.webkitRelativePath || a.name;
        const bPath = b.webkitRelativePath || b.name;
        const aHasFeb10 = aPath.toLowerCase().includes('february 10') || aPath.toLowerCase().includes('feb 10');
        const bHasFeb10 = bPath.toLowerCase().includes('february 10') || bPath.toLowerCase().includes('feb 10');
        if (aHasFeb10 && !bHasFeb10) return -1;
        if (!aHasFeb10 && bHasFeb10) return 1;
        return aPath.localeCompare(bPath);
      });

      let allEvents: TelemetryEvent[] = [];
      let firstRowKeys: string[] = [];
      
      for (let i = 0; i < parquetFiles.length; i++) {
        const file = parquetFiles[i] as File;
        setLoadingProgress(`Processing ${file.name} (${i + 1}/${parquetFiles.length})...`);
        
        const fileAsyncBuffer = {
          byteLength: file.size,
          slice: async (start: number, end: number) => {
            const slice = file.slice(start, end);
            return await slice.arrayBuffer();
          }
        };

        try {
          const rows = await parquetReadObjects({ file: fileAsyncBuffer }) as any[];
          
          if (rows.length > 0 && firstRowKeys.length === 0) {
            firstRowKeys = Object.keys(rows[0]);
            console.log("First row of first file:", rows[0]);
          }

          // Map rows to TelemetryEvent with fallback column names
          const mappedRows: TelemetryEvent[] = rows.map(row => {
            let payload: any = {};
            if (typeof row.payload === 'string') {
              try { payload = JSON.parse(row.payload); } catch(e) {}
            } else if (typeof row.properties === 'string') {
              try { payload = JSON.parse(row.properties); } catch(e) {}
            } else if (typeof row.payload === 'object' && row.payload !== null) {
              payload = row.payload;
            }

            const user_id = row.user_id ?? row.player_id ?? row.userId ?? row.playerId ?? row.id ?? row.client_id ?? payload.user_id ?? payload.playerId ?? '';
            const match_id = row.match_id ?? row.matchId ?? row.match ?? row.session_id ?? row.sessionId ?? payload.match_id ?? payload.sessionId ?? file.name;
            const map_id = row.map_id ?? row.mapId ?? row.map ?? row.level ?? payload.map_id ?? payload.level ?? 'Unknown';
            
            let x = 0, y = 0, z = 0;
            if (row.position && typeof row.position === 'object') {
              x = row.position.x ?? 0;
              y = row.position.y ?? 0;
              z = row.position.z ?? 0;
            } else if (typeof row.position === 'string') {
              try { const p = JSON.parse(row.position); x = p.x ?? 0; y = p.y ?? 0; z = p.z ?? 0; } catch(e) {}
            } else {
              x = Number(row.x ?? row.pos_x ?? row.position_x ?? row.X ?? payload.x ?? payload.pos_x ?? 0);
              y = Number(row.y ?? row.pos_y ?? row.position_y ?? row.Y ?? payload.y ?? payload.pos_y ?? 0);
              z = Number(row.z ?? row.pos_z ?? row.position_z ?? row.Z ?? payload.z ?? payload.pos_z ?? 0);
            }

            const ts = Number(row.ts ?? row.time ?? row.timestamp ?? row.t ?? row.create_time ?? payload.ts ?? payload.timestamp ?? 0);
            const rawEvent = String(row.event ?? row.type ?? row.event_type ?? row.name ?? payload.event ?? payload.type ?? 'Position');
            
            let event = 'move';
            if (rawEvent === 'Position' || rawEvent === 'BotPosition') event = 'move';
            else if (rawEvent === 'Kill' || rawEvent === 'BotKill') event = 'kill';
            else if (rawEvent === 'Killed' || rawEvent === 'BotKilled') event = 'death';
            else if (rawEvent === 'KilledByStorm') event = 'storm_death';
            else if (rawEvent === 'Loot') event = 'loot';
            else event = rawEvent.toLowerCase();

            return {
              user_id: String(user_id),
              match_id: String(match_id),
              map_id: String(map_id) as MapId,
              x, y, z, ts,
              event: event as any
            };
          });
          
          allEvents = allEvents.concat(mappedRows);
        } catch (err) {
          console.error(`Error reading ${file.name}:`, err);
        }
      }

      if (allEvents.length > 0) {
        // Sort all events by timestamp
        setLoadingProgress('Sorting events...');
        allEvents.sort((a, b) => a.ts - b.ts);
        
        // Dynamically add unknown maps to MAP_CONFIG
        const uniqueMaps = Array.from(new Set(allEvents.map(e => e.map_id)));
        for (const m of uniqueMaps) {
          if (!(m in MAP_CONFIG)) {
            const mapEvents = allEvents.filter(e => e.map_id === m);
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            for (const e of mapEvents) {
              if (e.x < minX) minX = e.x;
              if (e.x > maxX) maxX = e.x;
              if (e.z < minZ) minZ = e.z;
              if (e.z > maxZ) maxZ = e.z;
            }
            const scaleX = maxX - minX;
            const scaleZ = maxZ - minZ;
            const scale = Math.max(scaleX, scaleZ) || 1000;
            
            // @ts-ignore - dynamically adding to config
            MAP_CONFIG[m] = {
              scale: scale * 1.1, // 10% padding
              origin: { x: minX - scale * 0.05, z: minZ - scale * 0.05 }
            };
          }
        }
        
        setAvailableMaps(uniqueMaps);
        setEvents(allEvents);
        
        const firstMap = allEvents[0].map_id;
        setMapId(firstMap);
        setMatchId('All');
        setPlayerId('All');

        const uniqueMatches = new Set(allEvents.map(e => e.match_id)).size;
        alert(`Successfully loaded ${allEvents.length} events across ${uniqueMaps.length} maps and ${uniqueMatches} matches.`);
      } else {
        alert(`No valid data found in the selected parquet files.\nColumns found: ${firstRowKeys.join(', ')}`);
      }
    } catch (error) {
      console.error('Error processing files:', error);
      alert('An error occurred while processing the files.');
    } finally {
      setIsLoading(false);
      setLoadingProgress('');
      // Reset file input
      e.target.value = '';
    }
  };

  // Filter events by map, match, and player
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (e.map_id !== mapId) return false;
      if (matchId !== 'All' && e.match_id !== matchId) return false;
      if (playerId !== 'All' && e.user_id !== playerId) return false;
      if (playerType !== 'All') {
        const isBot = /^\d+$/.test(e.user_id);
        if (playerType === 'Human' && isBot) return false;
        if (playerType === 'Bot' && !isBot) return false;
      }
      return true;
    });
  }, [events, mapId, matchId, playerId, playerType]);

  // Calculate time bounds
  const { minTime, maxTime } = useMemo(() => {
    if (filteredEvents.length === 0) return { minTime: 0, maxTime: 0 };
    const times = filteredEvents.map(e => e.ts);
    return {
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
    };
  }, [filteredEvents]);

  // Reset match and player filters when map changes
  useEffect(() => {
    setMatchId('All');
    setPlayerId('All');
  }, [mapId]);

  // Reset current time when match changes
  useEffect(() => {
    setCurrentTime(maxTime);
  }, [maxTime]);

  const handleMapImageUpload = (mapId: string, file: File) => {
    const url = URL.createObjectURL(file);
    setCustomMapImages(prev => ({ ...prev, [mapId]: url }));
  };

  const matches = useMemo(() => {
    return Array.from(new Set(events.filter(e => e.map_id === mapId).map(e => e.match_id)));
  }, [events, mapId]);

  const players = useMemo(() => {
    return Array.from(new Set(events.filter(e => e.map_id === mapId).map(e => e.user_id)));
  }, [events, mapId]);

  return (
    <div className="flex h-screen w-screen bg-gray-50 text-gray-900 overflow-hidden font-sans">
      <Sidebar
        mapId={mapId}
        setMapId={setMapId}
        matchId={matchId}
        setMatchId={setMatchId}
        matches={matches}
        playerId={playerId}
        setPlayerId={setPlayerId}
        players={players}
        playerType={playerType}
        setPlayerType={setPlayerType}
        layers={layers}
        setLayers={setLayers}
        availableMaps={availableMaps}
        customMapImages={customMapImages}
        onMapImageUpload={handleMapImageUpload}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-6 flex flex-col relative">
          {/* Top Bar / Upload */}
          <div className="absolute top-8 right-8 z-10 flex gap-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors shadow-xl">
              <Upload className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium">Upload Folders</span>
              <input 
                type="file" 
                className="hidden" 
                // @ts-ignore - webkitdirectory is non-standard but widely supported
                webkitdirectory="true" 
                directory="true" 
                multiple 
                onChange={handleFileUpload} 
              />
            </label>
            <label className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors shadow-xl">
              <Upload className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium">Upload Files</span>
              <input 
                type="file" 
                className="hidden" 
                accept=".parquet" 
                multiple 
                onChange={handleFileUpload} 
              />
            </label>
          </div>

          <div className="flex-1 flex items-center justify-center bg-white/50 rounded-2xl border border-gray-200/50 p-4 relative">
            {isLoading && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                <p className="text-lg font-medium text-gray-900">{loadingProgress}</p>
              </div>
            )}
            
            {filteredEvents.length > 0 ? (
              <MapCanvas
                events={filteredEvents}
                mapId={mapId}
                currentTime={currentTime}
                layers={layers}
                customMapImages={customMapImages}
                className="w-full h-full shadow-2xl"
              />
            ) : (
              <div className="text-gray-500 flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-200/50 flex items-center justify-center">
                  <MapCanvas className="w-8 h-8 opacity-50" events={[]} mapId={mapId} currentTime={0} layers={layers} customMapImages={customMapImages} />
                </div>
                <p>No telemetry data found for the selected filters.</p>
              </div>
            )}
          </div>
        </div>

        <Timeline
          minTime={minTime}
          maxTime={maxTime}
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
        />
      </div>
    </div>
  );
}
