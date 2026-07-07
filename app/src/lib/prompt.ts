import type { RoomSpec, RoomType } from '../types';
import { ROOM_META } from '../types';

/**
 * Natural-language brief → room program. Two paths:
 *  1. heuristic keyword parser (always available, EN + IT)
 *  2. local LLM via Ollama at localhost:11434 if running (optional, still 100% local)
 */

const KEYWORDS: [RegExp, RoomType][] = [
  [/bed\s*rooms?|camer[ae]|stanz[ae] da letto/i, 'bedroom'],
  [/bath\s*rooms?|bagn[oi]/i, 'bathroom'],
  [/kitchen|cucin[ae]/i, 'kitchen'],
  [/living|soggiorn[oi]|salott[oi]|sala/i, 'living'],
  [/dining|sala da pranzo|pranzo/i, 'dining'],
  [/office|studio|studi/i, 'office'],
  [/garage|box auto/i, 'garage'],
  [/laundry|lavanderi[ae]/i, 'laundry'],
  [/closet|cabina armadio|ripostigli[oi]/i, 'closet'],
  [/hall|corridoi[oi]|ingress[oi]|disimpegn[oi]/i, 'hallway'],
];

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5,
  a: 1,
};

export function parsePromptHeuristic(text: string): RoomSpec[] {
  const counts = new Map<RoomType, number>();
  const clauses = text.split(/[,.;+]| and | e | con /i);
  for (const clause of clauses) {
    for (const [re, type] of KEYWORDS) {
      const m = clause.match(re);
      if (!m) continue;
      let count = 1;
      const numMatch = clause.match(/(\d+)/);
      if (numMatch) count = Math.min(6, parseInt(numMatch[1], 10));
      else {
        const wordMatch = clause
          .toLowerCase()
          .match(/\b(one|two|three|four|five|un|uno|una|due|tre|quattro|cinque)\b/);
        if (wordMatch) count = NUM_WORDS[wordMatch[1]] ?? 1;
      }
      counts.set(type, Math.max(counts.get(type) ?? 0, count));
    }
  }
  if (counts.size === 0) return [];

  // sensible completions: a home needs living + kitchen + circulation
  if (!counts.has('living')) counts.set('living', 1);
  if (!counts.has('kitchen')) counts.set('kitchen', 1);
  if (!counts.has('bathroom')) counts.set('bathroom', 1);
  if ((counts.get('bedroom') ?? 0) >= 2 && !counts.has('hallway')) counts.set('hallway', 1);

  const rooms: RoomSpec[] = [];
  let n = 0;
  for (const [type, count] of counts) {
    for (let i = 0; i < count; i++) {
      rooms.push({
        id: `p${n++}`,
        type,
        label: count > 1 ? `${ROOM_META[type].label} ${i + 1}` : ROOM_META[type].label,
        targetArea: ROOM_META[type].defaultArea,
      });
    }
  }
  return rooms;
}

interface OllamaResponse {
  response: string;
}

/** Try a local Ollama model; returns null if Ollama isn't running or output unusable. */
export async function parsePromptOllama(text: string, model = 'llama3.2'): Promise<RoomSpec[] | null> {
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        prompt:
          `Extract a residential room program from this brief: "${text}". ` +
          `Respond ONLY with JSON: {"rooms":[{"type":"<one of living,kitchen,dining,bedroom,bathroom,hallway,office,laundry,closet,garage>","count":<int>,"area":<m2 number>}]}`,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OllamaResponse;
    const parsed = JSON.parse(data.response) as {
      rooms?: { type: string; count?: number; area?: number }[];
    };
    if (!parsed.rooms?.length) return null;
    const rooms: RoomSpec[] = [];
    let n = 0;
    for (const r of parsed.rooms) {
      if (!(r.type in ROOM_META)) continue;
      const type = r.type as RoomType;
      const count = Math.min(6, Math.max(1, r.count ?? 1));
      for (let i = 0; i < count; i++) {
        rooms.push({
          id: `o${n++}`,
          type,
          label: count > 1 ? `${ROOM_META[type].label} ${i + 1}` : ROOM_META[type].label,
          targetArea: r.area && r.area > 2 ? r.area : ROOM_META[type].defaultArea,
        });
      }
    }
    return rooms.length ? rooms : null;
  } catch {
    return null;
  }
}
