import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Sparkles, Loader2 } from 'lucide-react';
import { TelemetryEvent } from '../lib/mockData';

export function GeminiInsights({ events, mapId }: { events: TelemetryEvent[], mapId: string }) {
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Aggregate data to avoid sending too much raw data
      const totalEvents = events.length;
      const kills = events.filter(e => e.event === 'kill').length;
      const deaths = events.filter(e => e.event === 'death').length;
      const uniquePlayers = new Set(events.map(e => e.user_id)).size;
      
      const prompt = `You are an expert game level designer. Analyze this telemetry summary for the map "${mapId}" and provide 3 concise, actionable insights to improve the level design.
      
      Data Summary:
      - Total Events: ${totalEvents}
      - Unique Players: ${uniquePlayers}
      - Total Kills: ${kills}
      - Total Deaths: ${deaths}
      
      Focus on pacing, choke points, and player flow. Keep it brief.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      setInsights(response.text || 'No insights generated.');
    } catch (error) {
      console.error(error);
      setInsights('Failed to generate insights. Please check your API key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          AI Level Insights
        </h3>
        <button 
          onClick={generateInsights}
          disabled={loading || events.length === 0}
          className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Generate'}
        </button>
      </div>
      {insights && (
        <div className="text-sm text-indigo-800 whitespace-pre-wrap mt-3 bg-white/50 p-3 rounded-lg border border-indigo-100/50">
          {insights}
        </div>
      )}
    </div>
  );
}
