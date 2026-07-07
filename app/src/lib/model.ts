// Helpers for the wall-based model (ported from prototype P1).
// All lengths in meters.

import type { Plan, Point, Wall } from '../types';

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export const DEFAULTS = {
  wallThicknessExt: 0.25,
  wallThicknessInt: 0.12,
  wallHeight: 2.7,
  door: { width: 0.9, height: 2.1, sill: 0 },
  window: { width: 1.2, height: 1.3, sill: 0.9 },
};

export function emptyPlan(): Plan {
  return { name: 'planimetria', walls: [], labels: [] };
}

export function wallLength(w: Wall): number {
  return Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
}

export function wallDir(w: Wall): Point {
  const len = wallLength(w);
  if (len === 0) return { x: 1, y: 0 };
  return { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len };
}

export function pointOnWall(w: Wall, offset: number): Point {
  const d = wallDir(w);
  return { x: w.a.x + d.x * offset, y: w.a.y + d.y * offset };
}

/** Distance from point p to segment ab; also returns offset along the wall of the closest point. */
export function distToWall(w: Wall, p: Point): { dist: number; offset: number } {
  const len = wallLength(w);
  const d = wallDir(w);
  const t = (p.x - w.a.x) * d.x + (p.y - w.a.y) * d.y;
  const clamped = Math.max(0, Math.min(len, t));
  const cp = pointOnWall(w, clamped);
  return { dist: Math.hypot(p.x - cp.x, p.y - cp.y), offset: clamped };
}

export function serializePlan(plan: Plan): string {
  return JSON.stringify({ version: 1, ...plan }, null, 2);
}

export function deserializePlan(json: string): Plan {
  const raw = JSON.parse(json);
  if (!Array.isArray(raw.walls)) throw new Error('File piano non valido: mancano i muri');
  return {
    name: typeof raw.name === 'string' ? raw.name : 'planimetria',
    walls: raw.walls,
    labels: Array.isArray(raw.labels) ? raw.labels : [],
    rooms: Array.isArray(raw.rooms) ? raw.rooms : undefined,
    floorMaterialId: typeof raw.floorMaterialId === 'string' ? raw.floorMaterialId : undefined,
  };
}
