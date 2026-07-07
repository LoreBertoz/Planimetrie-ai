// Constraint-based procedural floor plan generator.
// Slicing-tree layout: footprint rectangle recursively cut proportionally
// to room target areas. Walls deduped, doors placed on a spanning tree of
// room adjacency, windows on exterior walls.

import type { Plan, Point, Wall } from './model'
import { DEFAULTS, uid } from './model'

export interface RoomSpec {
  name: string
  /** Target area in m². Used as proportional weight. */
  area: number
}

export interface PlanSpec {
  /** Footprint width (m). */
  width: number
  /** Footprint depth (m). */
  depth: number
  rooms: RoomSpec[]
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
  name: string
}

// Deterministic seeded RNG (mulberry32) so each seed gives one stable variant.
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function slice(rect: Rect, rooms: RoomSpec[], out: Rect[]): void {
  if (rooms.length === 1) {
    out.push({ ...rect, name: rooms[0].name })
    return
  }
  const total = rooms.reduce((s, r) => s + r.area, 0)
  // Split room list at ~half the total weight.
  let acc = 0
  let cut = 1
  for (let i = 0; i < rooms.length - 1; i++) {
    acc += rooms[i].area
    cut = i + 1
    if (acc >= total / 2) break
  }
  const groupA = rooms.slice(0, cut)
  const groupB = rooms.slice(cut)
  const fracA = groupA.reduce((s, r) => s + r.area, 0) / total
  // Cut across the longer dimension to keep rooms close to square.
  if (rect.w >= rect.h) {
    const wA = rect.w * fracA
    slice({ ...rect, w: wA }, groupA, out)
    slice({ ...rect, x: rect.x + wA, w: rect.w - wA }, groupB, out)
  } else {
    const hA = rect.h * fracA
    slice({ ...rect, h: hA }, groupA, out)
    slice({ ...rect, y: rect.y + hA, h: rect.h - hA }, groupB, out)
  }
}

const EPS = 1e-6

function roomAt(rects: Rect[], p: Point): number {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    if (p.x > r.x - EPS && p.x < r.x + r.w + EPS && p.y > r.y - EPS && p.y < r.y + r.h + EPS) {
      // Strict interior check with tolerance
      if (p.x > r.x + EPS && p.x < r.x + r.w - EPS && p.y > r.y + EPS && p.y < r.y + r.h - EPS) {
        return i
      }
    }
  }
  return -1
}

interface Run {
  a: Point
  b: Point
  /** Room index on each side; -1 = outside. */
  side1: number
  side2: number
}

/** Build merged wall runs from room rectangles. */
function buildRuns(rects: Rect[]): Run[] {
  const xs = uniqueSorted(rects.flatMap((r) => [r.x, r.x + r.w]))
  const ys = uniqueSorted(rects.flatMap((r) => [r.y, r.y + r.h]))
  const probe = 0.001
  const runs: Run[] = []

  // Vertical wall lines
  for (const x of xs) {
    let current: Run | null = null
    for (let i = 0; i < ys.length - 1; i++) {
      const y0 = ys[i]
      const y1 = ys[i + 1]
      const my = (y0 + y1) / 2
      const left = roomAt(rects, { x: x - probe, y: my })
      const right = roomAt(rects, { x: x + probe, y: my })
      const isWall = left !== right
      if (isWall && (left !== -1 || right !== -1)) {
        if (current && current.side1 === left && current.side2 === right && Math.abs(current.b.y - y0) < EPS) {
          current.b = { x, y: y1 }
        } else {
          current = { a: { x, y: y0 }, b: { x, y: y1 }, side1: left, side2: right }
          runs.push(current)
        }
      } else {
        current = null
      }
    }
  }

  // Horizontal wall lines
  for (const y of ys) {
    let current: Run | null = null
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i]
      const x1 = xs[i + 1]
      const mx = (x0 + x1) / 2
      const below = roomAt(rects, { x: mx, y: y - probe })
      const above = roomAt(rects, { x: mx, y: y + probe })
      const isWall = below !== above
      if (isWall && (below !== -1 || above !== -1)) {
        if (current && current.side1 === below && current.side2 === above && Math.abs(current.b.x - x0) < EPS) {
          current.b = { x: x1, y }
        } else {
          current = { a: { x: x0, y }, b: { x: x1, y }, side1: below, side2: above }
          runs.push(current)
        }
      } else {
        current = null
      }
    }
  }

  return runs
}

function uniqueSorted(vals: number[]): number[] {
  const sorted = [...vals].sort((a, b) => a - b)
  const out: number[] = []
  for (const v of sorted) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]) > EPS) out.push(v)
  }
  return out
}

function runLength(r: Run): number {
  return Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y)
}

export function generatePlan(spec: PlanSpec, seed = 1): Plan {
  const random = rng(seed)
  const rooms = [...spec.rooms]
  // Shuffle order per seed → different layout variants.
  for (let i = rooms.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[rooms[i], rooms[j]] = [rooms[j], rooms[i]]
  }

  const rects: Rect[] = []
  slice({ x: 0, y: 0, w: spec.width, h: spec.depth, name: '' }, rooms, rects)

  const runs = buildRuns(rects)
  const walls: Wall[] = runs.map((r) => ({
    id: uid('w'),
    a: r.a,
    b: r.b,
    thickness: DEFAULTS.wallThickness,
    height: DEFAULTS.wallHeight,
    openings: [],
  }))

  // Interior doors: spanning tree over room adjacency so every room is reachable.
  const doorMin = DEFAULTS.door.width + 0.3
  const connected = new Set<number>([0])
  const pending = runs
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.side1 !== -1 && r.side2 !== -1 && runLength(r) >= doorMin)
  let progress = true
  while (progress && connected.size < rects.length) {
    progress = false
    for (const { r, i } of pending) {
      const hasA = connected.has(r.side1)
      const hasB = connected.has(r.side2)
      if (hasA === hasB) continue
      connected.add(hasA ? r.side2 : r.side1)
      walls[i].openings.push({
        id: uid('o'),
        type: 'door',
        offset: runLength(r) / 2,
        width: DEFAULTS.door.width,
        height: DEFAULTS.door.height,
        sill: 0,
      })
      progress = true
    }
  }

  // Entrance: longest exterior run of the first (largest-weight) room.
  const entryRoom = rects.findIndex((r) => r.name === spec.rooms[0].name)
  const exteriorRuns = runs
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => (r.side1 === -1) !== (r.side2 === -1))
  const entryCandidates = exteriorRuns
    .filter(({ r }) => r.side1 === entryRoom || r.side2 === entryRoom)
    .sort((a, b) => runLength(b.r) - runLength(a.r))
  if (entryCandidates.length > 0 && runLength(entryCandidates[0].r) >= doorMin) {
    const { r, i } = entryCandidates[0]
    walls[i].openings.push({
      id: uid('o'),
      type: 'door',
      offset: runLength(r) / 2,
      width: DEFAULTS.door.width,
      height: DEFAULTS.door.height,
      sill: 0,
    })
  }

  // Windows: one centered on each exterior run long enough, skipping the entrance wall.
  for (const { r, i } of exteriorRuns) {
    if (walls[i].openings.length > 0) continue
    const len = runLength(r)
    if (len < DEFAULTS.window.width + 0.6) continue
    walls[i].openings.push({
      id: uid('o'),
      type: 'window',
      offset: len / 2,
      width: DEFAULTS.window.width,
      height: DEFAULTS.window.height,
      sill: DEFAULTS.window.sill,
    })
  }

  return {
    name: 'planimetria generata',
    walls,
    labels: rects.map((r) => ({
      id: uid('l'),
      name: `${r.name} (${(r.w * r.h).toFixed(1)} m²)`,
      at: { x: r.x + r.w / 2, y: r.y + r.h / 2 },
    })),
  }
}
