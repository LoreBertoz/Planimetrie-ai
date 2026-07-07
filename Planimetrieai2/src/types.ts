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

export const ROOM_META: Record<
  RoomType,
  { label: string; defaultArea: number; habitable: boolean; color: string }
> = {
  living: { label: 'Living Room', defaultArea: 25, habitable: true, color: '#dbeafe' },
  kitchen: { label: 'Kitchen', defaultArea: 12, habitable: true, color: '#fef3c7' },
  dining: { label: 'Dining Room', defaultArea: 14, habitable: true, color: '#fde68a' },
  bedroom: { label: 'Bedroom', defaultArea: 14, habitable: true, color: '#dcfce7' },
  bathroom: { label: 'Bathroom', defaultArea: 6, habitable: false, color: '#e0f2fe' },
  hallway: { label: 'Hallway', defaultArea: 8, habitable: false, color: '#f3f4f6' },
  office: { label: 'Office', defaultArea: 10, habitable: true, color: '#ede9fe' },
  laundry: { label: 'Laundry', defaultArea: 5, habitable: false, color: '#fce7f3' },
  closet: { label: 'Closet', defaultArea: 4, habitable: false, color: '#f5f5f4' },
  garage: { label: 'Garage', defaultArea: 20, habitable: false, color: '#e7e5e4' },
};
