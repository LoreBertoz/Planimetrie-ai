// "Arreda stanza": heuristic auto-furnishing per room type. Simple placement
// against free walls (no layout optimizer, by design — presentational tool).
// Plan coordinates: x right, y down; rotation is the THREE.js rotation.y
// applied in 3D (plan y maps to world z).

import type { FurnitureItem, PlacedRoom } from '../types';
import { ROOM_FURNISH_SETS, getFurniture } from '../materials/furnitureCatalog';
import { uid } from './model';

type SideName = 'n' | 's' | 'e' | 'w';

const MARGIN = 0.25; // clearance from the wall face (m)

/** Center + rotation to put a piece with its back against a room side.
 *  t = 0..1 position along the wall (0.5 = centered). */
function againstWall(
  room: PlacedRoom,
  side: SideName,
  footprint: { w: number; d: number },
  t = 0.5,
): { x: number; y: number; rotation: number } {
  const halfD = footprint.d / 2 + MARGIN;
  const halfW = footprint.w / 2 + 0.15;
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  switch (side) {
    case 'n': // back toward smaller y
      return { x: lerp(room.x + halfW, room.x + room.w - halfW, t), y: room.y + halfD, rotation: 0 };
    case 's':
      return {
        x: lerp(room.x + halfW, room.x + room.w - halfW, t),
        y: room.y + room.h - halfD,
        rotation: Math.PI,
      };
    case 'w': // back toward smaller x
      return { x: room.x + halfD, y: lerp(room.y + halfW, room.y + room.h - halfW, t), rotation: Math.PI / 2 };
    case 'e':
      return {
        x: room.x + room.w - halfD,
        y: lerp(room.y + halfW, room.y + room.h - halfW, t),
        rotation: -Math.PI / 2,
      };
  }
}

/** Wall length available on a side. */
function sideLength(room: PlacedRoom, side: SideName): number {
  return side === 'n' || side === 's' ? room.w : room.h;
}

function fits(room: PlacedRoom, side: SideName, fp: { w: number; d: number }): boolean {
  const along = sideLength(room, side);
  const across = side === 'n' || side === 's' ? room.h : room.w;
  return fp.w + 0.3 <= along && fp.d + 0.5 <= across;
}

/** Sides ordered longest-first, alternating so pieces spread around the room. */
function orderedSides(room: PlacedRoom): SideName[] {
  return room.w >= room.h ? ['n', 's', 'w', 'e'] : ['w', 'e', 'n', 's'];
}

/** Furnish one room based on its type. Returns new items (ids fresh). */
export function furnishRoom(room: PlacedRoom): FurnitureItem[] {
  const set = ROOM_FURNISH_SETS[room.type] ?? [];
  const items: FurnitureItem[] = [];
  const sides = orderedSides(room);
  let sideIndex = 0;

  for (const catalogId of set) {
    const def = getFurniture(catalogId);
    if (!def) continue;

    // Free-standing pieces go to the room center.
    if (catalogId === 'tavolo-pranzo' || catalogId === 'tavolino') {
      if (def.footprint.w + 0.6 <= room.w && def.footprint.d + 0.6 <= room.h) {
        items.push({
          id: uid('f'),
          catalogId,
          x: room.x + room.w / 2,
          y: room.y + room.h / 2,
          rotation: room.w >= room.h ? 0 : Math.PI / 2,
          roomId: room.id,
        });
      }
      continue;
    }

    // Bathroom: line the pieces up along the longest wall, shower in the corner.
    if (room.type === 'bathroom') {
      const side = sides[0];
      const t = catalogId === 'wc' ? 0.2 : catalogId === 'lavabo' ? 0.6 : 0.9;
      if (fits(room, side, def.footprint)) {
        items.push({ id: uid('f'), catalogId, roomId: room.id, ...againstWall(room, side, def.footprint, t) });
      }
      continue;
    }

    // Default: next free wall that fits, rotating through the sides.
    for (let k = 0; k < sides.length; k++) {
      const side = sides[(sideIndex + k) % sides.length];
      if (!fits(room, side, def.footprint)) continue;
      items.push({ id: uid('f'), catalogId, roomId: room.id, ...againstWall(room, side, def.footprint) });
      sideIndex = (sideIndex + k + 1) % sides.length;
      break;
    }
  }
  return items;
}
