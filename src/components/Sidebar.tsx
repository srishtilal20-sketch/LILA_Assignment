import React from 'react';
import { MapId, TelemetryEvent } from '../lib/mockData';
import { cn } from '../lib/utils';
import { Layers, Map as MapIcon, Calendar, Filter, User, Image as ImageIcon, ChevronDown, ChevronRight, Upload, Database } from 'lucide-react';
import { GeminiInsights } from './GeminiInsights';

interface SidebarProps {
  mapId: MapId;
  setMapId: (mapId: MapId) => void;
  matchId: string;
  setMatchId: (matchId: string) => void;
  matches: string[];
  playerId: string;
  setPlayerId: (playerId: string) => void;
  players: string[];
  playerType: 'All' | 'Human' | 'Bot';
  setPlayerType: (type: 'All' | 'Human' | 'Bot') => void;
  layers: {
    paths: boolean;
    kills: boolean;
    deaths: boolean;
    stormDeaths: boolean;
    loot: boolean;
    heatmap: boolean;
  };
  setLayers: (layers: any) => void;
  availableMaps?: string[];
  customMapImages?: Record<string, string>;
  onMapImageUpload?: (mapId: string, file: File) => void;
  totalEvents: number;
  filteredEventsCount: number;
  events: TelemetryEvent[];
  kills: number;
  deaths: number;
  className?: string;
}

export function Sidebar({ mapId, setMapId, matchId, setMatchId, matches, playerId, setPlayerId, players, playerType, setPlayerType, layers, setLayers, availableMaps = ['AmbroseValley', 'GrandRift', 'Lockdown'], customMapImages = {}, onMapImageUpload, totalEvents, filteredEventsCount, events, kills, deaths, className }: SidebarProps) {
  const [isMapUploadOpen, setIsMapUploadOpen] = React.useState(false);
  const [isDebugOpen, setIsDebugOpen] = React.useState(false);

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers({ ...layers, [key]: !layers[key] });
  };

  return (
    <div className={cn("w-80 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto text-gray-600", className)}>
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-indigo-500" />
          LevelVis
        </h1>
        <p className="text-xs text-gray-500 mt-1">Telemetry Visualization Tool</p>
      </div>

      <div className="p-6 space-y-8">
        {/* Map Selection */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2 uppercase tracking-wider">
            <MapIcon className="w-4 h-4" /> Map
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {availableMaps.map(m => (
              <button
                key={m}
                onClick={() => setMapId(m as MapId)}
                className={cn(
                  "px-4 py-2 text-sm text-left rounded-lg transition-colors border",
                  mapId === m 
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-medium" 
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Match Selection */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2 uppercase tracking-wider">
            <Filter className="w-4 h-4" /> Match
          </h3>
          <select
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="All">All Matches</option>
            {matches.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Player Selection */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2 uppercase tracking-wider">
            <User className="w-4 h-4" /> Player
          </h3>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="All">All Players</option>
            {players.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Player Type Selection */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2 uppercase tracking-wider">
            <User className="w-4 h-4" /> Player Type
          </h3>
          <select
            value={playerType}
            onChange={(e) => setPlayerType(e.target.value as any)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="All">All Types</option>
            <option value="Human">Human Players</option>
            <option value="Bot">AI Bots</option>
          </select>
        </div>

        {/* Layers */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2 uppercase tracking-wider">
            <Layers className="w-4 h-4" /> Layers
          </h3>
          <div className="space-y-2">
            {Object.entries(layers).map(([key, value]) => (
              <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  className="hidden"
                  checked={value}
                  onChange={() => toggleLayer(key as keyof typeof layers)}
                />
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                  value ? "bg-indigo-500 border-indigo-500" : "border-gray-300 bg-white"
                )}>
                  {value && <svg className="w-3 h-3 text-white" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Map Background Uploads */}
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <button 
            onClick={() => setIsMapUploadOpen(!isMapUploadOpen)}
            className="flex items-center justify-between w-full text-sm font-medium text-gray-800 uppercase tracking-wider hover:text-indigo-600 transition-colors"
          >
            <span className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Map Backgrounds</span>
            {isMapUploadOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          {isMapUploadOpen && (
            <div className="space-y-3 pl-6 mt-3">
              {availableMaps.map(m => (
                <div key={m} className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-gray-700">{m}</span>
                  <label className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors text-xs text-gray-600">
                    <Upload className="w-3 h-3" />
                    {customMapImages[m] ? 'Change Image' : 'Upload Image'}
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0] && onMapImageUpload) {
                          onMapImageUpload(m, e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Debug Info */}
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <button 
            onClick={() => setIsDebugOpen(!isDebugOpen)}
            className="flex items-center justify-between w-full text-sm font-medium text-gray-800 uppercase tracking-wider hover:text-indigo-600 transition-colors"
          >
            <span className="flex items-center gap-2"><Database className="w-4 h-4" /> Debug Data</span>
            {isDebugOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          {isDebugOpen && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-2 font-mono">
              <div className="flex justify-between"><span>Total Events:</span> <span>{totalEvents}</span></div>
              <div className="flex justify-between"><span>Filtered Events:</span> <span>{filteredEventsCount}</span></div>
              <div className="flex justify-between"><span>Kills:</span> <span>{kills}</span></div>
              <div className="flex justify-between"><span>Deaths:</span> <span>{deaths}</span></div>
              <div className="flex justify-between"><span>K/D Ratio:</span> <span>{deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? 'Infinity' : '0.00'}</span></div>
              <div className="flex justify-between"><span>Map:</span> <span>{mapId}</span></div>
              <div className="flex justify-between"><span>Match:</span> <span className="truncate max-w-[100px]">{matchId}</span></div>
              <div className="flex justify-between"><span>Player:</span> <span className="truncate max-w-[100px]">{playerId}</span></div>
              <div className="flex justify-between"><span>Type:</span> <span>{playerType}</span></div>
            </div>
          )}
        </div>

        <GeminiInsights events={events.filter(e => e.map_id === mapId)} mapId={mapId} />
      </div>
    </div>
  );
}
