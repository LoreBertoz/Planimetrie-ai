// Procedural furniture catalog (Fase 10): compositions of Box/Cylinder
// geometry in the same style as the rest of the engine. No external GLTF —
// zero licensing, coherent look, instant to extend. A GLTFLoader for specific
// hero pieces can be added later if more realism is ever needed.
//
// Conventions: units meters, y up. Each build() returns a THREE.Group centered
// on (0,0) in plan, footprint w along x and d along z, resting on y=FLOOR_EPS
// (slightly above the floor top face to avoid z-fighting).

import * as THREE from 'three';
import type { RoomType } from '../types';

/** Floor top face sits at +0.01; keep furniture a hair above it. */
export const FLOOR_EPS = 0.012;

export type FurnitureCategory = 'camera' | 'soggiorno' | 'cucina' | 'bagno' | 'studio';

export interface FurnitureDef {
  id: string;
  nome: string;
  categoria: FurnitureCategory;
  /** Plan footprint in meters (w along x, d along z at rotation 0). */
  footprint: { w: number; d: number };
  build: () => THREE.Group;
}

export const FURNITURE_CATEGORIA_LABEL: Record<FurnitureCategory, string> = {
  camera: 'Camera',
  soggiorno: 'Soggiorno',
  cucina: 'Cucina',
  bagno: 'Bagno',
  studio: 'Studio',
};

/* ------------------------------- palette --------------------------------- */

const WOOD = 0xa5814f;
const WOOD_DARK = 0x6f5138;
const FABRIC = 0xd8cfb8;
const FABRIC_ACCENT = 0x8ca187;
const WHITE = 0xf4f1ea;
const CERAMIC = 0xf7f5ef;
const METAL = 0x9a9d9f;

function mat(color: number, roughness = 0.8, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cylinder(
  r: number,
  h: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  radialSegments = 20,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, radialSegments), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ------------------------------- builders -------------------------------- */

function buildLetto(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(WOOD);
  const fabric = mat(FABRIC, 0.95);
  const accent = mat(FABRIC_ACCENT, 0.95);
  const E = FLOOR_EPS;
  // frame + mattress
  g.add(box(1.7, 0.25, 2.05, wood, 0, E, 0));
  g.add(box(1.62, 0.18, 1.95, fabric, 0, E + 0.25, -0.02));
  // headboard (against -z side)
  g.add(box(1.7, 0.85, 0.06, wood, 0, E, -1.02));
  // pillows + runner
  g.add(box(0.6, 0.1, 0.4, mat(WHITE, 0.95), -0.42, E + 0.43, -0.72));
  g.add(box(0.6, 0.1, 0.4, mat(WHITE, 0.95), 0.42, E + 0.43, -0.72));
  g.add(box(1.62, 0.04, 0.5, accent, 0, E + 0.43, 0.6));
  // bedside tables with legs hint
  for (const sx of [-1, 1]) {
    g.add(box(0.45, 0.4, 0.42, wood, sx * 1.1, E + 0.12, -0.78));
    g.add(cylinder(0.09, 0.02, mat(WOOD_DARK), sx * 1.1, E + 0.52, -0.78, 14));
  }
  return g;
}

function buildArmadio(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(WOOD);
  const E = FLOOR_EPS;
  g.add(box(2.4, 2.3, 0.6, wood, 0, E, 0));
  // door seams + handles
  const seam = mat(WOOD_DARK, 0.7);
  for (const sx of [-0.6, 0, 0.6]) g.add(box(0.015, 2.2, 0.02, seam, sx, E + 0.05, 0.31));
  for (const sx of [-0.08, 0.08]) g.add(box(0.03, 0.28, 0.03, seam, sx, E + 1.0, 0.32));
  return g;
}

function buildDivano(): THREE.Group {
  const g = new THREE.Group();
  const fabric = mat(FABRIC_ACCENT, 0.95);
  const cushion = mat(FABRIC, 0.95);
  const E = FLOOR_EPS;
  g.add(box(2.2, 0.35, 0.9, fabric, 0, E, 0)); // base
  g.add(box(2.2, 0.5, 0.2, fabric, 0, E + 0.35, -0.35)); // backrest
  for (const sx of [-1, 1]) g.add(box(0.2, 0.55, 0.9, fabric, sx * 1.0, E + 0.05, 0)); // arms
  for (const sx of [-0.53, 0.53]) g.add(box(0.95, 0.14, 0.62, cushion, sx, E + 0.35, 0.08));
  return g;
}

function buildTavolino(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(WOOD_DARK, 0.6);
  const E = FLOOR_EPS;
  g.add(cylinder(0.45, 0.04, wood, 0, E + 0.34, 0, 28));
  g.add(cylinder(0.05, 0.34, wood, 0, E, 0, 14));
  g.add(cylinder(0.28, 0.02, mat(METAL, 0.4, 0.3), 0, E + 0.16, 0, 24));
  return g;
}

function buildSedia(woodMat?: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const wood = woodMat ?? mat(WOOD_DARK, 0.7);
  const E = FLOOR_EPS;
  g.add(box(0.42, 0.04, 0.42, wood, 0, E + 0.42, 0)); // seat
  g.add(box(0.42, 0.45, 0.04, wood, 0, E + 0.46, -0.19)); // back
  for (const sx of [-0.18, 0.18])
    for (const sz of [-0.18, 0.18]) g.add(box(0.04, 0.42, 0.04, wood, sx, E, sz));
  return g;
}

function buildTavoloPranzo(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(WOOD, 0.6);
  const chairWood = mat(WOOD_DARK, 0.7);
  const E = FLOOR_EPS;
  g.add(box(1.8, 0.05, 0.9, wood, 0, E + 0.72, 0));
  for (const sx of [-0.82, 0.82])
    for (const sz of [-0.37, 0.37]) g.add(box(0.06, 0.72, 0.06, wood, sx, E, sz));
  // chairs share one material (same look, fewer GPU programs)
  const positions: [number, number, number][] = [
    [-0.55, 0.75, Math.PI],
    [0.55, 0.75, Math.PI],
    [-0.55, -0.75, 0],
    [0.55, -0.75, 0],
  ];
  for (const [x, z, ry] of positions) {
    const chair = buildSedia(chairWood);
    chair.position.set(x, 0, z);
    chair.rotation.y = ry;
    g.add(chair);
  }
  return g;
}

function buildCucina(): THREE.Group {
  const g = new THREE.Group();
  const base = mat(FABRIC, 0.7);
  const top = mat(WOOD_DARK, 0.5);
  const upper = mat(WHITE, 0.7);
  const E = FLOOR_EPS;
  g.add(box(3.0, 0.9, 0.62, base, 0, E, 0)); // base units
  g.add(box(3.04, 0.04, 0.66, top, 0, E + 0.9, 0)); // worktop
  g.add(box(3.0, 0.7, 0.35, upper, 0, E + 1.5, -0.13)); // wall units
  // sink + hob hints
  g.add(box(0.5, 0.02, 0.4, mat(METAL, 0.35, 0.6), -0.9, E + 0.94, 0.02));
  for (const i of [0, 1])
    for (const j of [0, 1])
      g.add(cylinder(0.09, 0.015, mat(0x3c4237, 0.6), 0.75 + i * 0.28, E + 0.94, -0.12 + j * 0.26, 16));
  // seams
  const seam = mat(0xcabf9f, 0.8);
  for (const sx of [-0.5, 0.5]) g.add(box(0.012, 0.82, 0.02, seam, sx, E + 0.04, 0.315));
  return g;
}

function buildWc(): THREE.Group {
  const g = new THREE.Group();
  const ceramic = mat(CERAMIC, 0.3);
  const E = FLOOR_EPS;
  g.add(box(0.38, 0.4, 0.3, ceramic, 0, E, -0.16)); // cistern
  g.add(cylinder(0.19, 0.4, ceramic, 0, E, 0.1, 22)); // bowl
  g.add(cylinder(0.21, 0.04, mat(WHITE, 0.4), 0, E + 0.4, 0.1, 22)); // seat
  return g;
}

function buildLavabo(): THREE.Group {
  const g = new THREE.Group();
  const ceramic = mat(CERAMIC, 0.3);
  const wood = mat(WOOD);
  const E = FLOOR_EPS;
  g.add(box(0.6, 0.5, 0.45, wood, 0, E + 0.3, 0)); // vanity
  g.add(cylinder(0.2, 0.12, ceramic, 0, E + 0.8, 0, 24)); // basin
  g.add(box(0.03, 0.25, 0.03, mat(METAL, 0.3, 0.7), 0, E + 0.8, -0.16)); // tap
  return g;
}

function buildDoccia(): THREE.Group {
  const g = new THREE.Group();
  const E = FLOOR_EPS;
  g.add(box(0.9, 0.06, 0.9, mat(CERAMIC, 0.4), 0, E, 0)); // tray
  const glass = new THREE.MeshStandardMaterial({
    color: 0xaecfc2,
    roughness: 0.1,
    metalness: 0.2,
    transparent: true,
    opacity: 0.35,
  });
  g.add(box(0.9, 1.9, 0.02, glass, 0, E + 0.06, 0.44));
  g.add(box(0.02, 1.9, 0.9, glass, 0.44, E + 0.06, 0));
  g.add(box(0.03, 1.95, 0.03, mat(METAL, 0.3, 0.7), -0.4, E + 0.06, -0.4)); // riser
  return g;
}

function buildScrivania(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(WOOD, 0.6);
  const E = FLOOR_EPS;
  g.add(box(1.4, 0.04, 0.7, wood, 0, E + 0.72, -0.25));
  for (const sx of [-0.65, 0.65]) g.add(box(0.05, 0.72, 0.6, wood, sx, E, -0.25));
  const chair = buildSedia();
  chair.position.set(0, 0, 0.35);
  chair.rotation.y = Math.PI;
  g.add(chair);
  return g;
}

/* -------------------------------- catalog -------------------------------- */

export const FURNITURE: FurnitureDef[] = [
  { id: 'letto-matrimoniale', nome: 'Letto matrimoniale + comodini', categoria: 'camera', footprint: { w: 2.7, d: 2.1 }, build: buildLetto },
  { id: 'armadio', nome: 'Armadio', categoria: 'camera', footprint: { w: 2.4, d: 0.6 }, build: buildArmadio },
  { id: 'divano', nome: 'Divano', categoria: 'soggiorno', footprint: { w: 2.2, d: 0.9 }, build: buildDivano },
  { id: 'tavolino', nome: 'Tavolino', categoria: 'soggiorno', footprint: { w: 0.9, d: 0.9 }, build: buildTavolino },
  { id: 'tavolo-pranzo', nome: 'Tavolo da pranzo + sedie', categoria: 'cucina', footprint: { w: 2.4, d: 2.0 }, build: buildTavoloPranzo },
  { id: 'cucina-blocco', nome: 'Blocco cucina', categoria: 'cucina', footprint: { w: 3.0, d: 0.66 }, build: buildCucina },
  { id: 'wc', nome: 'WC', categoria: 'bagno', footprint: { w: 0.45, d: 0.65 }, build: buildWc },
  { id: 'lavabo', nome: 'Lavabo con mobile', categoria: 'bagno', footprint: { w: 0.6, d: 0.5 }, build: buildLavabo },
  { id: 'doccia', nome: 'Doccia', categoria: 'bagno', footprint: { w: 0.9, d: 0.9 }, build: buildDoccia },
  { id: 'scrivania', nome: 'Scrivania + sedia', categoria: 'studio', footprint: { w: 1.4, d: 1.3 }, build: buildScrivania },
];

export function getFurniture(id: string): FurnitureDef | undefined {
  return FURNITURE.find((f) => f.id === id);
}

/** Auto-furnish sets per room type ("Arreda stanza"). */
export const ROOM_FURNISH_SETS: Partial<Record<RoomType, string[]>> = {
  bedroom: ['letto-matrimoniale', 'armadio'],
  living: ['divano', 'tavolino'],
  kitchen: ['cucina-blocco', 'tavolo-pranzo'],
  dining: ['tavolo-pranzo'],
  bathroom: ['wc', 'lavabo', 'doccia'],
  office: ['scrivania', 'armadio'],
  laundry: ['lavabo'],
  closet: ['armadio'],
};
