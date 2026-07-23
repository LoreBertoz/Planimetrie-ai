// Procedural roof (Fase 8). Generated plans are rectilinear (guillotine
// slicing), so we decompose the footprint into rectangles and roof each one —
// no generic straight-skeleton needed (revisit only if non-orthogonal plans
// ever arrive). Plan (x, y) maps to world (x, z); heights on world y.

import * as THREE from 'three';
import type { RoofOptions, Wall } from '../types';
import { boxUVsToMeters, generateWorldUVs } from './textures';

export interface FootRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const OVERHANG = 0.35; // eaves beyond the walls (m)
const FLAT_SLAB = 0.15;
const PARAPET_H = 0.6;
const PARAPET_T = 0.25;
const EPS = 1e-6;

/** Decompose the union of room rects into few maximal rectangles (greedy). */
export function footprintRects(rooms: FootRect[]): FootRect[] {
  if (rooms.length === 0) return [];
  const xs = uniq(rooms.flatMap((r) => [r.x, r.x + r.w]));
  const ys = uniq(rooms.flatMap((r) => [r.y, r.y + r.h]));
  const cols = xs.length - 1;
  const rows = ys.length - 1;
  const inside = (i: number, j: number): boolean => {
    const cx = (xs[i] + xs[i + 1]) / 2;
    const cy = (ys[j] + ys[j + 1]) / 2;
    return rooms.some(
      (r) => cx > r.x + EPS && cx < r.x + r.w - EPS && cy > r.y + EPS && cy < r.y + r.h - EPS,
    );
  };
  const covered: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const out: FootRect[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (covered[j][i] || !inside(i, j)) continue;
      // extend right
      let i1 = i;
      while (i1 + 1 < cols && !covered[j][i1 + 1] && inside(i1 + 1, j)) i1++;
      // extend down while the whole row span is free and inside
      let j1 = j;
      const rowFree = (jj: number) => {
        for (let k = i; k <= i1; k++) if (covered[jj][k] || !inside(k, jj)) return false;
        return true;
      };
      while (j1 + 1 < rows && rowFree(j1 + 1)) j1++;
      for (let jj = j; jj <= j1; jj++) for (let k = i; k <= i1; k++) covered[jj][k] = true;
      out.push({ x: xs[i], y: ys[j], w: xs[i1 + 1] - xs[i], h: ys[j1 + 1] - ys[j] });
    }
  }
  return out;
}

function uniq(vals: number[]): number[] {
  const sorted = [...vals].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) if (out.length === 0 || v - out[out.length - 1] > EPS) out.push(v);
  return out;
}

/** Non-indexed triangle soup → mesh-ready geometry. Each tri = 9 numbers. */
function geometryFrom(tris: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  geo.computeVertexNormals();
  generateWorldUVs(geo); // meter-scaled UVs for roof tiles / facade textures
  return geo;
}

function quad(
  tris: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
): void {
  tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  tris.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
}

function tri(tris: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void {
  tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
}

const V = (x: number, h: number, y: number) => new THREE.Vector3(x, h, y);

/** Gable (a capanna) or hip (a padiglione) roof over one rectangle. */
function pitchedRoofTris(
  r: FootRect,
  h0: number,
  slope: number,
  hip: boolean,
): { slopes: number[]; gables: number[] } {
  const x0 = r.x - OVERHANG;
  const x1 = r.x + r.w + OVERHANG;
  const y0 = r.y - OVERHANG;
  const y1 = r.y + r.h + OVERHANG;
  const alongX = x1 - x0 >= y1 - y0; // ridge along the longer axis
  const slopes: number[] = [];
  const gables: number[] = [];

  if (alongX) {
    const ym = (y0 + y1) / 2;
    const half = (y1 - y0) / 2;
    const hr = h0 + slope * half;
    const rx0 = hip ? Math.min(x0 + half, (x0 + x1) / 2) : x0;
    const rx1 = hip ? Math.max(x1 - half, (x0 + x1) / 2) : x1;
    // long slopes (trapezoids when hip)
    quad(slopes, V(x0, h0, y0), V(x1, h0, y0), V(rx1, hr, ym), V(rx0, hr, ym));
    quad(slopes, V(x1, h0, y1), V(x0, h0, y1), V(rx0, hr, ym), V(rx1, hr, ym));
    if (hip) {
      tri(slopes, V(x0, h0, y1), V(x0, h0, y0), V(rx0, hr, ym));
      tri(slopes, V(x1, h0, y0), V(x1, h0, y1), V(rx1, hr, ym));
    } else {
      tri(gables, V(x0, h0, y1), V(x0, h0, y0), V(x0, hr, ym));
      tri(gables, V(x1, h0, y0), V(x1, h0, y1), V(x1, hr, ym));
    }
  } else {
    const xm = (x0 + x1) / 2;
    const half = (x1 - x0) / 2;
    const hr = h0 + slope * half;
    const ry0 = hip ? Math.min(y0 + half, (y0 + y1) / 2) : y0;
    const ry1 = hip ? Math.max(y1 - half, (y0 + y1) / 2) : y1;
    quad(slopes, V(x1, h0, y0), V(x1, h0, y1), V(xm, hr, ry1), V(xm, hr, ry0));
    quad(slopes, V(x0, h0, y1), V(x0, h0, y0), V(xm, hr, ry0), V(xm, hr, ry1));
    if (hip) {
      tri(slopes, V(x0, h0, y0), V(x1, h0, y0), V(xm, hr, ry0));
      tri(slopes, V(x1, h0, y1), V(x0, h0, y1), V(xm, hr, ry1));
    } else {
      tri(gables, V(x0, h0, y0), V(x1, h0, y0), V(xm, hr, ry0));
      tri(gables, V(x1, h0, y1), V(x0, h0, y1), V(xm, hr, ry1));
    }
  }
  return { slopes, gables };
}

/** Build the whole roof group. exteriorWalls close the gable triangles with
 *  the facade material; parapets of flat roofs follow the exterior wall runs. */
export function buildRoofGroup(
  rooms: FootRect[],
  exteriorWalls: Wall[],
  wallHeight: number,
  opts: RoofOptions,
  roofMat: THREE.Material,
  gableMat: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'roof';
  const rects = footprintRects(rooms);
  if (rects.length === 0) return group;
  const h0 = wallHeight + 0.02;

  if (opts.type === 'flat') {
    // Slab over each footprint rect + parapet along the exterior wall runs.
    for (const r of rects) {
      const slabGeo = new THREE.BoxGeometry(r.w + PARAPET_T, FLAT_SLAB, r.h + PARAPET_T);
      boxUVsToMeters(slabGeo, r.w + PARAPET_T, FLAT_SLAB, r.h + PARAPET_T);
      const slab = new THREE.Mesh(slabGeo, roofMat);
      slab.position.set(r.x + r.w / 2, h0 + FLAT_SLAB / 2, r.y + r.h / 2);
      slab.castShadow = true;
      slab.receiveShadow = true;
      group.add(slab);
    }
    for (const w of exteriorWalls) {
      const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
      if (len < 0.05) continue;
      const parapetGeo = new THREE.BoxGeometry(len + PARAPET_T, PARAPET_H, PARAPET_T);
      boxUVsToMeters(parapetGeo, len + PARAPET_T, PARAPET_H, PARAPET_T);
      const parapet = new THREE.Mesh(parapetGeo, gableMat);
      const angle = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
      parapet.rotation.y = -angle;
      parapet.position.set(
        (w.a.x + w.b.x) / 2,
        h0 + FLAT_SLAB + PARAPET_H / 2 - 0.02,
        (w.a.y + w.b.y) / 2,
      );
      parapet.castShadow = true;
      group.add(parapet);
    }
    return group;
  }

  const hip = opts.type === 'hip';
  const allSlopes: number[] = [];
  const allGables: number[] = [];
  for (const r of rects) {
    const { slopes, gables } = pitchedRoofTris(r, h0, opts.slope, hip);
    allSlopes.push(...slopes);
    allGables.push(...gables);
  }
  const slopeMesh = new THREE.Mesh(geometryFrom(allSlopes), roofMat);
  slopeMesh.castShadow = true;
  slopeMesh.receiveShadow = true;
  group.add(slopeMesh);
  if (allGables.length > 0) {
    const gableMesh = new THREE.Mesh(geometryFrom(allGables), gableMat);
    gableMesh.castShadow = true;
    group.add(gableMesh);
  }

  // Eaves fascia boards (Fase 13): warm-white strips under the roof edge.
  const fasciaMat = new THREE.MeshStandardMaterial({ color: 0xf1ece1, roughness: 0.6 });
  const FASCIA_H = 0.16;
  const FASCIA_T = 0.06;
  for (const r of rects) {
    const x0 = r.x - OVERHANG;
    const x1 = r.x + r.w + OVERHANG;
    const y0 = r.y - OVERHANG;
    const y1 = r.y + r.h + OVERHANG;
    const alongX = x1 - x0 >= y1 - y0;
    const fy = h0 - FASCIA_H / 2 + 0.03;
    const addFascia = (w: number, d: number, x: number, z: number) => {
      const geoF = new THREE.BoxGeometry(w, FASCIA_H, d);
      boxUVsToMeters(geoF, w, FASCIA_H, d);
      const f = new THREE.Mesh(geoF, fasciaMat);
      f.position.set(x, fy, z);
      f.castShadow = true;
      group.add(f);
    };
    const cx = (x0 + x1) / 2;
    const cz = (y0 + y1) / 2;
    // Horizontal eaves: both long sides always; short sides only when hipped.
    if (alongX) {
      addFascia(x1 - x0, FASCIA_T, cx, y0);
      addFascia(x1 - x0, FASCIA_T, cx, y1);
      if (hip) {
        addFascia(FASCIA_T, y1 - y0, x0, cz);
        addFascia(FASCIA_T, y1 - y0, x1, cz);
      }
    } else {
      addFascia(FASCIA_T, y1 - y0, x0, cz);
      addFascia(FASCIA_T, y1 - y0, x1, cz);
      if (hip) {
        addFascia(x1 - x0, FASCIA_T, cx, y0);
        addFascia(x1 - x0, FASCIA_T, cx, y1);
      }
    }
  }

  // Chimney (Fase 13): on the largest footprint rect, near the ridge.
  const largest = rects.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));
  {
    const x0 = largest.x - OVERHANG;
    const x1 = largest.x + largest.w + OVERHANG;
    const y0 = largest.y - OVERHANG;
    const y1 = largest.y + largest.h + OVERHANG;
    const alongX = x1 - x0 >= y1 - y0;
    const half = (alongX ? y1 - y0 : x1 - x0) / 2;
    const ridgeH = h0 + opts.slope * half;
    const cxC = alongX ? x0 + (x1 - x0) * 0.28 : (x0 + x1) / 2 - half * 0.35;
    const czC = alongX ? (y0 + y1) / 2 - half * 0.35 : y0 + (y1 - y0) * 0.28;
    const topY = ridgeH + 0.45;
    const bodyGeo = new THREE.BoxGeometry(0.52, topY - h0 + 0.4, 0.44);
    boxUVsToMeters(bodyGeo, 0.52, topY - h0 + 0.4, 0.44);
    const body = new THREE.Mesh(bodyGeo, gableMat);
    body.position.set(cxC, (topY + h0 - 0.4) / 2, czC);
    body.castShadow = true;
    group.add(body);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.07, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x6b5844, roughness: 0.8 }),
    );
    cap.position.set(cxC, topY + 0.035, czC);
    cap.castShadow = true;
    group.add(cap);
  }
  return group;
}
