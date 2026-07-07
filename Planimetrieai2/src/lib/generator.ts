import type {
  Door,
  FloorPlan,
  PlacedRoom,
  PlanRequest,
  Rect,
  RoomSpec,
  RoomType,
  Window,
} from '../types';
import { ROOM_META } from '../types';
import { mulberry32, shuffled, type Rng } from './rng';

const WALL = 0.15; // interior wall render thickness, m
const DOOR_WIDTH = 0.85;
const EPS = 0.01;

// Desired adjacencies: [a, b, weight]. Score rewards plans where these room
// types share a wall long enough for a door.
const ADJACENCY_RULES: [RoomType, RoomType, number][] = [
  ['kitchen', 'dining', 3],
  ['kitchen', 'living', 2],
  ['dining', 'living', 2],
  ['bedroom', 'bathroom', 1.5],
  ['bedroom', 'hallway', 2],
  ['bathroom', 'hallway', 2],
  ['living', 'hallway', 2],
  ['laundry', 'kitchen', 1],
  ['closet', 'bedroom', 1],
  ['office', 'hallway', 1],
  ['garage', 'kitchen', 1],
  ['garage', 'laundry', 1],
];

// Rooms people should not walk through to reach other rooms.
const PRIVATE: Set<RoomType> = new Set(['bedroom', 'bathroom', 'closet', 'laundry']);
// Rooms that must touch an exterior wall (need windows).
const NEEDS_EXTERIOR: Set<RoomType> = new Set([
  'living',
  'kitchen',
  'dining',
  'bedroom',
  'office',
]);

interface Adjacency {
  a: number; // room index
  b: number;
  sharedLen: number;
  horizontal: boolean; // shared wall runs east-west
  // segment of the shared wall
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Recursive guillotine slicing: divide rect among rooms proportional to target areas. */
function slice(rect: Rect, rooms: RoomSpec[], rng: Rng, out: PlacedRoom[]): void {
  if (rooms.length === 1) {
    const r = rooms[0];
    out.push({ ...rect, id: r.id, type: r.type, label: r.label });
    return;
  }
  const total = rooms.reduce((s, r) => s + r.targetArea, 0);
  // split rooms into two contiguous groups, balanced-ish by area with jitter
  const targetFrac = 0.35 + rng() * 0.3;
  let acc = 0;
  let cut = 1;
  for (let i = 0; i < rooms.length - 1; i++) {
    acc += rooms[i].targetArea;
    if (acc / total >= targetFrac) {
      cut = i + 1;
      break;
    }
    cut = i + 1;
  }
  const g1 = rooms.slice(0, cut);
  const g2 = rooms.slice(cut);
  const frac = g1.reduce((s, r) => s + r.targetArea, 0) / total;

  // split along the longer axis (occasionally the shorter, for variety)
  const splitVertical = rect.w > rect.h ? rng() > 0.15 : rng() < 0.15;
  if (splitVertical) {
    const w1 = rect.w * frac;
    slice({ ...rect, w: w1 }, g1, rng, out);
    slice({ ...rect, x: rect.x + w1, w: rect.w - w1 }, g2, rng, out);
  } else {
    const h1 = rect.h * frac;
    slice({ ...rect, h: h1 }, g1, rng, out);
    slice({ ...rect, y: rect.y + h1, h: rect.h - h1 }, g2, rng, out);
  }
}

function findAdjacencies(rooms: PlacedRoom[]): Adjacency[] {
  const adj: Adjacency[] = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];
      // vertical shared wall (a right edge == b left edge or vice versa)
      if (Math.abs(a.x + a.w - b.x) < EPS || Math.abs(b.x + b.w - a.x) < EPS) {
        const x = Math.abs(a.x + a.w - b.x) < EPS ? a.x + a.w : b.x + b.w;
        const y1 = Math.max(a.y, b.y);
        const y2 = Math.min(a.y + a.h, b.y + b.h);
        if (y2 - y1 > EPS) {
          adj.push({ a: i, b: j, sharedLen: y2 - y1, horizontal: false, x1: x, y1, x2: x, y2 });
        }
      }
      // horizontal shared wall
      if (Math.abs(a.y + a.h - b.y) < EPS || Math.abs(b.y + b.h - a.y) < EPS) {
        const y = Math.abs(a.y + a.h - b.y) < EPS ? a.y + a.h : b.y + b.h;
        const x1 = Math.max(a.x, b.x);
        const x2 = Math.min(a.x + a.w, b.x + b.w);
        if (x2 - x1 > EPS) {
          adj.push({ a: i, b: j, sharedLen: x2 - x1, horizontal: true, x1, y1: y, x2, y2: y });
        }
      }
    }
  }
  return adj;
}

function exteriorSides(room: PlacedRoom, lot: { width: number; depth: number }) {
  const sides: { horizontal: boolean; x1: number; y1: number; x2: number; y2: number }[] = [];
  if (room.x < EPS) sides.push({ horizontal: false, x1: 0, y1: room.y, x2: 0, y2: room.y + room.h });
  if (Math.abs(room.x + room.w - lot.width) < EPS)
    sides.push({ horizontal: false, x1: lot.width, y1: room.y, x2: lot.width, y2: room.y + room.h });
  if (room.y < EPS) sides.push({ horizontal: true, x1: room.x, y1: 0, x2: room.x + room.w, y2: 0 });
  if (Math.abs(room.y + room.h - lot.depth) < EPS)
    sides.push({ horizontal: true, x1: room.x, y1: lot.depth, x2: room.x + room.w, y2: lot.depth });
  return sides;
}

function scorePlan(rooms: PlacedRoom[], adj: Adjacency[], req: PlanRequest): number {
  let score = 0;

  // 1. aspect ratio: punish skinny rooms hard
  for (const r of rooms) {
    const ratio = Math.max(r.w / r.h, r.h / r.w);
    if (ratio > 1.6) score -= (ratio - 1.6) * 4;
    const minDim = Math.min(r.w, r.h);
    if (minDim < 1.8 && r.type !== 'closet' && r.type !== 'hallway') score -= (1.8 - minDim) * 10;
  }

  // 2. adjacency rules
  const doorable = adj.filter((e) => e.sharedLen >= DOOR_WIDTH + 0.2);
  for (const [ta, tb, w] of ADJACENCY_RULES) {
    const wantA = rooms.some((r) => r.type === ta);
    const wantB = rooms.some((r) => r.type === tb);
    if (!wantA || !wantB) continue;
    const ok = doorable.some(
      (e) =>
        (rooms[e.a].type === ta && rooms[e.b].type === tb) ||
        (rooms[e.a].type === tb && rooms[e.b].type === ta),
    );
    score += ok ? w : -w * 0.5;
  }

  // 2b. user-specified adjacency pairs (hard preference, weight above type rules)
  for (const spec of req.rooms) {
    if (!spec.adjacentTo) continue;
    const ia = rooms.findIndex((r) => r.id === spec.id);
    const ib = rooms.findIndex((r) => r.id === spec.adjacentTo);
    if (ia < 0 || ib < 0) continue;
    const ok = doorable.some(
      (e) => (e.a === ia && e.b === ib) || (e.a === ib && e.b === ia),
    );
    score += ok ? 5 : -6;
  }

  // 3. exterior access for habitable rooms
  for (const r of rooms) {
    if (NEEDS_EXTERIOR.has(r.type) && exteriorSides(r, req.lot).length === 0) score -= 8;
  }

  // 4. privacy: bathroom should not open onto kitchen/dining only
  // handled implicitly by adjacency rules; small bonus if hallway is central
  const hall = rooms.find((r) => r.type === 'hallway');
  if (hall) {
    const cx = Math.abs(hall.x + hall.w / 2 - req.lot.width / 2) / req.lot.width;
    const cy = Math.abs(hall.y + hall.h / 2 - req.lot.depth / 2) / req.lot.depth;
    score += (1 - (cx + cy)) * 1.5;
  }

  return score;
}

/**
 * Doors: build a spanning tree over the room adjacency graph so every room is
 * reachable, preferring circulation through hallway/living, avoiding routes
 * through private rooms. Then one entrance on an exterior wall.
 */
function placeDoors(rooms: PlacedRoom[], adj: Adjacency[], req: PlanRequest, rng: Rng): Door[] {
  const doors: Door[] = [];
  const doorable = adj.filter((e) => e.sharedLen >= DOOR_WIDTH + 0.2);

  // edge cost: cheap if either end is circulation space, expensive through private rooms
  const cost = (e: Adjacency) => {
    const ta = rooms[e.a].type;
    const tb = rooms[e.b].type;
    let c = 1;
    if (ta === 'hallway' || tb === 'hallway') c = 0.1;
    else if (ta === 'living' || tb === 'living') c = 0.3;
    else if (PRIVATE.has(ta) && PRIVATE.has(tb)) c = ta === 'bathroom' || tb === 'bathroom' ? 2 : 3;
    return c;
  };

  // Prim's MST from the main circulation room
  const start = Math.max(
    0,
    rooms.findIndex((r) => r.type === 'hallway') !== -1
      ? rooms.findIndex((r) => r.type === 'hallway')
      : rooms.findIndex((r) => r.type === 'living'),
  );
  const inTree = new Set<number>([start]);
  while (inTree.size < rooms.length) {
    let best: Adjacency | null = null;
    let bestCost = Infinity;
    for (const e of doorable) {
      const aIn = inTree.has(e.a);
      const bIn = inTree.has(e.b);
      if (aIn === bIn) continue;
      const c = cost(e);
      if (c < bestCost) {
        bestCost = c;
        best = e;
      }
    }
    if (!best) break; // disconnected (shared walls all too short) — plan will score poorly anyway
    inTree.add(best.a);
    inTree.add(best.b);
    const t = 0.35 + rng() * 0.3;
    doors.push({
      x: best.x1 + (best.x2 - best.x1) * t,
      y: best.y1 + (best.y2 - best.y1) * t,
      width: DOOR_WIDTH,
      horizontal: best.horizontal,
      exterior: false,
    });
  }

  // entrance: exterior wall of hallway > living > anything
  const entranceRoom =
    rooms.find((r) => r.type === 'hallway' && exteriorSides(r, req.lot).length > 0) ??
    rooms.find((r) => r.type === 'living' && exteriorSides(r, req.lot).length > 0) ??
    rooms.find((r) => exteriorSides(r, req.lot).length > 0);
  if (entranceRoom) {
    const side = exteriorSides(entranceRoom, req.lot)[0];
    doors.push({
      x: (side.x1 + side.x2) / 2,
      y: (side.y1 + side.y2) / 2,
      width: DOOR_WIDTH + 0.15,
      horizontal: side.horizontal,
      exterior: true,
    });
  }
  return doors;
}

function placeWindows(rooms: PlacedRoom[], req: PlanRequest, entrance: Door | undefined): Window[] {
  const windows: Window[] = [];
  for (const r of rooms) {
    if (r.type === 'garage' || r.type === 'closet') continue;
    for (const side of exteriorSides(r, req.lot)) {
      const len = side.horizontal ? side.x2 - side.x1 : side.y2 - side.y1;
      if (len < 1.6) continue;
      const cx = (side.x1 + side.x2) / 2;
      const cy = (side.y1 + side.y2) / 2;
      // don't overlap the entrance door
      if (entrance && Math.hypot(entrance.x - cx, entrance.y - cy) < 1.5) continue;
      windows.push({
        x: cx,
        y: cy,
        width: Math.min(1.8, len * 0.45),
        horizontal: side.horizontal,
      });
      if (!NEEDS_EXTERIOR.has(r.type)) break; // one window is enough for service rooms
    }
  }
  return windows;
}

function buildCandidate(req: PlanRequest, rng: Rng): FloorPlan {
  const rooms: PlacedRoom[] = [];
  const order = shuffled(req.rooms, rng);
  slice({ x: 0, y: 0, w: req.lot.width, h: req.lot.depth }, order, rng, rooms);
  const adj = findAdjacencies(rooms);
  const score = scorePlan(rooms, adj, req);
  const doors = placeDoors(rooms, adj, req, rng);
  const windows = placeWindows(rooms, req, doors.find((d) => d.exterior));
  return { lot: req.lot, rooms, doors, windows, score, seed: req.seed };
}

/** Fingerprint of room layout topology, used to keep returned variants distinct. */
function layoutKey(plan: FloorPlan): string {
  return plan.rooms
    .map((r) => `${r.id}:${r.x.toFixed(1)},${r.y.toFixed(1)}`)
    .sort()
    .join('|');
}

/**
 * Generate `count` distinct floor plan variants. Random-restart search:
 * many candidates per variant slot, keep the best-scoring distinct layouts.
 */
export function generateVariants(req: Omit<PlanRequest, 'seed'>, count: number, baseSeed: number): FloorPlan[] {
  const ATTEMPTS = 400;
  const candidates: FloorPlan[] = [];
  for (let i = 0; i < ATTEMPTS; i++) {
    const seed = baseSeed + i * 7919;
    const rng = mulberry32(seed);
    candidates.push(buildCandidate({ ...req, seed }, rng));
  }
  candidates.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: FloorPlan[] = [];
  for (const c of candidates) {
    const key = layoutKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= count) break;
  }
  return out;
}

export { WALL, DOOR_WIDTH };

export function totalArea(rooms: RoomSpec[]): number {
  return rooms.reduce((s, r) => s + r.targetArea, 0);
}

export function roomAreaLabel(r: PlacedRoom): string {
  return `${(r.w * r.h).toFixed(1)} m²`;
}

export function defaultRooms(): RoomSpec[] {
  let n = 0;
  const mk = (type: RoomType, label?: string): RoomSpec => ({
    id: `r${n++}`,
    type,
    label: label ?? ROOM_META[type].label,
    targetArea: ROOM_META[type].defaultArea,
  });
  return [
    mk('living'),
    mk('kitchen'),
    mk('hallway'),
    mk('bedroom', 'Bedroom 1'),
    mk('bedroom', 'Bedroom 2'),
    mk('bathroom'),
  ];
}
