export type RoomType =
  | 'living'
  | 'kitchen'
  | 'dining'
  | 'bedroom'
  | 'bathroom'
  | 'hallway'
  | 'office'
  | 'laundry'
  | 'closet'
  | 'garage';

export interface RoomSpec {
  id: string;
  type: RoomType;
  label: string;
  targetArea: number; // m²
  adjacentTo?: string; // id of a room this one must share a wall with
}

export interface LotSpec {
  width: number; // m
  depth: number; // m
}

export interface PlanRequest {
  lot: LotSpec;
  rooms: RoomSpec[];
  seed: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedRoom extends Rect {
  id: string;
  type: RoomType;
  label: string;
  /** Per-room floor material (roadmap; see src/materials/catalog.ts). */
  materialId?: string;
}

export type Side = 'n' | 's' | 'e' | 'w';

export interface Door {
  // door lies on a wall segment; x,y is the center point, horizontal = wall runs east-west
  x: number;
  y: number;
  width: number;
  horizontal: boolean;
  exterior: boolean;
}

export interface Window {
  x: number;
  y: number;
  width: number;
  horizontal: boolean;
}

export interface FloorPlan {
  lot: LotSpec;
  rooms: PlacedRoom[];
  doors: Door[];
  windows: Window[];
  score: number;
  seed: number;
}

/* ---------------------------------------------------------------------------
 * Wall-based model (from prototype P1) — used by the 2D editor and 3D engine.
 * The generator produces a FloorPlan (rooms as rects); floorplanToWalls()
 * converts it into a Plan (walls + openings). Units: meters everywhere.
 * ------------------------------------------------------------------------- */

export interface Point {
  x: number;
  y: number;
}

export type OpeningType = 'door' | 'window';

export interface Opening {
  id: string;
  type: OpeningType;
  /** Distance from wall start to opening center, along the wall (m). */
  offset: number;
  width: number;
  height: number;
  /** Bottom of opening above floor (m). 0 for doors. */
  sill: number;
}

export interface Wall {
  id: string;
  a: Point;
  b: Point;
  /** Total thickness (m). Derived from the assembly when assemblyId is set;
   *  free value for walls drawn before Fase 9 (kept for compatibility). */
  thickness: number;
  height: number;
  openings: Opening[];
  /** True when the wall faces the outside. */
  exterior?: boolean;
  /** Material applied in 3D (see src/materials/catalog.ts). */
  materialId?: string;
  /** Wall assembly preset (see src/materials/wallAssemblies.ts). */
  assemblyId?: string;
  /** Custom stratigraphy when the user edits layers (assemblyId = 'custom'). */
  layers?: WallLayer[];
}

/* ----------------------- Wall stratigraphy (Fase 9) ----------------------- */

export type WallLayerFunction =
  | 'struttura'
  | 'isolante'
  | 'intercapedine'
  | 'rasante'
  | 'intonaco'
  | 'cartongesso'
  | 'rivestimento';

export interface WallLayer {
  materialId: string;
  thickness: number; // meters
  function: WallLayerFunction;
}

export interface WallAssembly {
  id: string;
  nome: string; // e.g. "Muratura portante 30cm + cappotto canapa 12cm"
  categoria: 'portante' | 'tamponamento' | 'tramezzo' | 'cartongesso' | 'facciata-ventilata';
  /** Layers from the inside face to the outside face. */
  layers: WallLayer[];
  /** Sum of layer thicknesses; computed, never hand-edited. */
  thickness: number;
}

/* -------------------------- Furniture (Fase 10) --------------------------- */

export interface FurnitureItem {
  id: string;
  /** Catalog entry (see src/materials/furnitureCatalog.ts). */
  catalogId: string;
  /** Center position on the plan (m). */
  x: number;
  y: number;
  /** Rotation around the vertical axis (radians, CCW in plan). */
  rotation: number;
  roomId?: string;
}

/* ----------------------------- Roof (Fase 8) ------------------------------ */

export type RoofType = 'flat' | 'gable' | 'hip';

export interface RoofOptions {
  type: RoofType;
  /** Slope as rise/run (e.g. 0.3 = 30%). Ignored for flat roofs. */
  slope: number;
  visible: boolean;
}

export const DEFAULT_ROOF: RoofOptions = { type: 'gable', slope: 0.3, visible: true };

export interface RoomLabel {
  id: string;
  name: string;
  at: Point;
}

export interface Plan {
  name: string;
  walls: Wall[];
  labels: RoomLabel[];
  /** Rooms kept as plan metadata (labels, areas, per-room materials). */
  rooms?: PlacedRoom[];
  floorMaterialId?: string;
  /** Placed furniture (Fase 10). */
  furniture?: FurnitureItem[];
}

export const ROOM_META: Record<
  RoomType,
  { label: string; defaultArea: number; habitable: boolean; color: string }
> = {
  living: { label: 'Soggiorno', defaultArea: 25, habitable: true, color: '#e9e3d2' },
  kitchen: { label: 'Cucina', defaultArea: 12, habitable: true, color: '#f0e5c6' },
  dining: { label: 'Sala da pranzo', defaultArea: 14, habitable: true, color: '#ecdcc0' },
  bedroom: { label: 'Camera', defaultArea: 14, habitable: true, color: '#dde6d0' },
  bathroom: { label: 'Bagno', defaultArea: 6, habitable: false, color: '#d8e4dd' },
  hallway: { label: 'Corridoio', defaultArea: 8, habitable: false, color: '#efece3' },
  office: { label: 'Studio', defaultArea: 10, habitable: true, color: '#e3ddc9' },
  laundry: { label: 'Lavanderia', defaultArea: 5, habitable: false, color: '#e9e0d6' },
  closet: { label: 'Ripostiglio', defaultArea: 4, habitable: false, color: '#eae7dc' },
  garage: { label: 'Garage', defaultArea: 20, habitable: false, color: '#e1ded3' },
};
