// FloorPlan (rooms as rects, from the generator) → Plan (walls + openings,
// for the 2D editor and the 3D engine). Wall-run merging adapted from
// prototype P1's buildRuns(). Units: meters.

import type { Door, FloorPlan, Opening, Plan, Point, Wall, Window } from '../types';
import { DEFAULTS, uid, wallLength } from './model';

const EPS = 1e-6;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function roomAt(rects: Rect[], p: Point): number {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (p.x > r.x + EPS && p.x < r.x + r.w - EPS && p.y > r.y + EPS && p.y < r.y + r.h - EPS) {
      return i;
    }
  }
  return -1;
}

function uniqueSorted(vals: number[]): number[] {
  const sorted = [...vals].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]) > EPS) out.push(v);
  }
  return out;
}

interface Run {
  a: Point;
  b: Point;
  /** Room index on each side; -1 = outside. */
  side1: number;
  side2: number;
}

/** Build merged wall runs from room rectangles. */
function buildRuns(rects: Rect[]): Run[] {
  const xs = uniqueSorted(rects.flatMap((r) => [r.x, r.x + r.w]));
  const ys = uniqueSorted(rects.flatMap((r) => [r.y, r.y + r.h]));
  const probe = 0.001;
  const runs: Run[] = [];

  // Vertical wall lines
  for (const x of xs) {
    let current: Run | null = null;
    for (let i = 0; i < ys.length - 1; i++) {
      const y0 = ys[i];
      const y1 = ys[i + 1];
      const my = (y0 + y1) / 2;
      const left = roomAt(rects, { x: x - probe, y: my });
      const right = roomAt(rects, { x: x + probe, y: my });
      const isWall = left !== right;
      if (isWall && (left !== -1 || right !== -1)) {
        if (
          current &&
          current.side1 === left &&
          current.side2 === right &&
          Math.abs(current.b.y - y0) < EPS
        ) {
          current.b = { x, y: y1 };
        } else {
          current = { a: { x, y: y0 }, b: { x, y: y1 }, side1: left, side2: right };
          runs.push(current);
        }
      } else {
        current = null;
      }
    }
  }

  // Horizontal wall lines
  for (const y of ys) {
    let current: Run | null = null;
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      const mx = (x0 + x1) / 2;
      const below = roomAt(rects, { x: mx, y: y - probe });
      const above = roomAt(rects, { x: mx, y: y + probe });
      const isWall = below !== above;
      if (isWall && (below !== -1 || above !== -1)) {
        if (
          current &&
          current.side1 === below &&
          current.side2 === above &&
          Math.abs(current.b.x - x0) < EPS
        ) {
          current.b = { x: x1, y };
        } else {
          current = { a: { x: x0, y }, b: { x: x1, y }, side1: below, side2: above };
          runs.push(current);
        }
      } else {
        current = null;
      }
    }
  }

  return runs;
}

/** True if the point lies on the wall segment (same line, within extent). */
function wallContains(w: Wall, p: Point, horizontal: boolean, tol = 0.08): boolean {
  const wallHorizontal = Math.abs(w.a.y - w.b.y) < EPS;
  if (wallHorizontal !== horizontal) return false;
  if (horizontal) {
    if (Math.abs(p.y - w.a.y) > tol) return false;
    const x0 = Math.min(w.a.x, w.b.x);
    const x1 = Math.max(w.a.x, w.b.x);
    return p.x >= x0 - tol && p.x <= x1 + tol;
  }
  if (Math.abs(p.x - w.a.x) > tol) return false;
  const y0 = Math.min(w.a.y, w.b.y);
  const y1 = Math.max(w.a.y, w.b.y);
  return p.y >= y0 - tol && p.y <= y1 + tol;
}

function offsetAlong(w: Wall, p: Point): number {
  return Math.hypot(p.x - w.a.x, p.y - w.a.y);
}

function placeOpening(
  walls: Wall[],
  at: Point,
  horizontal: boolean,
  opening: Omit<Opening, 'id' | 'offset'>,
): void {
  // Prefer the narrowest matching wall (most specific segment).
  const candidates = walls.filter((w) => wallContains(w, at, horizontal));
  if (candidates.length === 0) return;
  const wall = candidates.sort((a, b) => wallLength(a) - wallLength(b))[0];
  const len = wallLength(wall);
  const raw = offsetAlong(wall, at);
  const half = opening.width / 2;
  if (len < opening.width + 0.1) return; // wall too short for this opening
  const offset = Math.max(half + 0.05, Math.min(len - half - 0.05, raw));
  wall.openings.push({ id: uid('o'), offset, ...opening });
}

/** Convert the generator's FloorPlan into a wall-based Plan for editor + 3D. */
export function floorplanToWalls(fp: FloorPlan): Plan {
  const runs = buildRuns(fp.rooms);
  const walls: Wall[] = runs.map((r) => {
    const exterior = (r.side1 === -1) !== (r.side2 === -1);
    return {
      id: uid('w'),
      a: r.a,
      b: r.b,
      thickness: exterior ? DEFAULTS.wallThicknessExt : DEFAULTS.wallThicknessInt,
      height: DEFAULTS.wallHeight,
      openings: [],
      exterior,
    };
  });

  for (const d of fp.doors as Door[]) {
    placeOpening(walls, { x: d.x, y: d.y }, d.horizontal, {
      type: 'door',
      width: d.width,
      height: DEFAULTS.door.height,
      sill: 0,
    });
  }
  for (const f of fp.windows as Window[]) {
    placeOpening(walls, { x: f.x, y: f.y }, f.horizontal, {
      type: 'window',
      width: f.width,
      height: DEFAULTS.window.height,
      sill: DEFAULTS.window.sill,
    });
  }

  return {
    name: 'planimetria',
    walls,
    labels: fp.rooms.map((r) => ({
      id: uid('l'),
      name: `${r.label} (${(r.w * r.h).toFixed(1)} m²)`,
      at: { x: r.x + r.w / 2, y: r.y + r.h / 2 },
    })),
    rooms: fp.rooms,
  };
}
