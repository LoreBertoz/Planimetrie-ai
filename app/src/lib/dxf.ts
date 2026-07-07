import type { FloorPlan } from '../types';

/**
 * Minimal DXF (R12 ASCII) writer: walls as LINE entities on layer WALLS,
 * room labels as TEXT on layer LABELS. Opens in AutoCAD, LibreCAD, Rhino.
 * Units: meters.
 */
export function planToDxf(plan: FloorPlan): string {
  const e: string[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, layer: string) => {
    e.push(
      '0', 'LINE', '8', layer,
      '10', x1.toFixed(3), '20', (-y1).toFixed(3), '30', '0',
      '11', x2.toFixed(3), '21', (-y2).toFixed(3), '31', '0',
    );
  };
  const text = (x: number, y: number, h: number, value: string, layer: string) => {
    e.push(
      '0', 'TEXT', '8', layer,
      '10', x.toFixed(3), '20', (-y).toFixed(3), '30', '0',
      '40', h.toFixed(3), '1', value, '72', '1', '73', '2',
      '11', x.toFixed(3), '21', (-y).toFixed(3), '31', '0',
    );
  };

  for (const r of plan.rooms) {
    line(r.x, r.y, r.x + r.w, r.y, 'WALLS');
    line(r.x + r.w, r.y, r.x + r.w, r.y + r.h, 'WALLS');
    line(r.x + r.w, r.y + r.h, r.x, r.y + r.h, 'WALLS');
    line(r.x, r.y + r.h, r.x, r.y, 'WALLS');
    text(r.x + r.w / 2, r.y + r.h / 2, 0.3, `${r.label} (${(r.w * r.h).toFixed(1)} m2)`, 'LABELS');
  }
  for (const d of plan.doors) {
    const half = d.width / 2;
    if (d.horizontal) line(d.x - half, d.y, d.x + half, d.y, 'DOORS');
    else line(d.x, d.y - half, d.x, d.y + half, 'DOORS');
  }
  for (const w of plan.windows) {
    const half = w.width / 2;
    if (w.horizontal) line(w.x - half, w.y, w.x + half, w.y, 'WINDOWS');
    else line(w.x, w.y - half, w.x, w.y + half, 'WINDOWS');
  }

  return [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$INSUNITS', '70', '6', // meters
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    ...e,
    '0', 'ENDSEC',
    '0', 'EOF',
  ].join('\n');
}

export function exportDxf(plan: FloorPlan, name: string) {
  const blob = new Blob([planToDxf(plan)], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.dxf`;
  a.click();
  URL.revokeObjectURL(url);
}
