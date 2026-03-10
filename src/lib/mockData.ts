export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown';
export type EventType = 'move' | 'kill' | 'death' | 'storm_death' | 'loot';

export interface TelemetryEvent {
  user_id: string;
  match_id: string;
  map_id: MapId;
  x: number;
  y: number;
  z: number;
  ts: number;
  event: EventType;
}

export const MAP_CONFIG = {
  AmbroseValley: { scale: 900, origin: { x: -370, z: -473 } },
  GrandRift: { scale: 581, origin: { x: -290, z: -290 } },
  Lockdown: { scale: 1000, origin: { x: -500, z: -500 } },
};

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function generateMockData(numEvents = 5000): TelemetryEvent[] {
  const events: TelemetryEvent[] = [];
  const maps: MapId[] = ['AmbroseValley', 'GrandRift', 'Lockdown'];
  const matchIds = ['match-1', 'match-2', 'match-3'];
  
  // Generate some users (humans and bots)
  const users = Array.from({ length: 20 }).map((_, i) => ({
    id: i < 10 ? generateUUID() : `${1000 + i}`, // first 10 human, next 10 bot
    isBot: i >= 10
  }));

  const startTime = Date.now() - 1000 * 60 * 60 * 24; // 1 day ago

  for (const matchId of matchIds) {
    const mapId = maps[Math.floor(Math.random() * maps.length)];
    const config = MAP_CONFIG[mapId];
    
    // Simulate paths for users in this match
    const matchUsers = users.filter(() => Math.random() > 0.3); // random subset of users
    
    matchUsers.forEach(user => {
      let currentX = config.origin.x + Math.random() * config.scale;
      let currentZ = config.origin.z + Math.random() * config.scale;
      let currentTs = startTime + Math.random() * 1000 * 60 * 5; // start within 5 mins
      
      const numUserEvents = 50 + Math.floor(Math.random() * 100);
      let isDead = false;

      for (let i = 0; i < numUserEvents; i++) {
        if (isDead) break;

        // Move
        currentX += (Math.random() - 0.5) * (config.scale * 0.05);
        currentZ += (Math.random() - 0.5) * (config.scale * 0.05);
        currentTs += 1000 + Math.random() * 5000; // 1-6 seconds between events
        
        // Keep within bounds
        currentX = Math.max(config.origin.x, Math.min(config.origin.x + config.scale, currentX));
        currentZ = Math.max(config.origin.z, Math.min(config.origin.z + config.scale, currentZ));

        let eventType: EventType = 'move';
        const rand = Math.random();
        
        if (i === numUserEvents - 1) {
           // End of path, maybe death
           if (rand < 0.3) eventType = 'death';
           else if (rand < 0.4) eventType = 'storm_death';
           isDead = eventType === 'death' || eventType === 'storm_death';
        } else {
           if (rand < 0.05) eventType = 'kill';
           else if (rand < 0.1) eventType = 'loot';
        }

        events.push({
          user_id: user.id,
          match_id: matchId,
          map_id: mapId,
          x: currentX,
          y: 0,
          z: currentZ,
          ts: currentTs,
          event: eventType
        });
      }
    });
  }

  return events.sort((a, b) => a.ts - b.ts);
}
