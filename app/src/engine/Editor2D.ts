// Canvas-based 2D floor plan editor (ported from prototype P1): draw walls,
// place doors/windows, select/delete, pan/zoom, grid snap, live measurements.
// Fase 10 adds furniture: place, drag, rotate (R), delete.
// Operates on the wall-based Plan; the host is notified via onChange.

import type { FurnitureItem, Opening, Plan, Point, Wall } from '../types';
import { DEFAULTS, distToWall, pointOnWall, uid, wallDir, wallLength } from '../lib/model';
import { getFurniture } from '../materials/furnitureCatalog';

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'label';

export interface EditorSelection {
  wallId: string | null;
  openingId: string | null;
  furnitureId: string | null;
}

const GRID = 0.1; // snap step, meters
const MAJOR_GRID = 1; // meters

// Palette aligned with the app design tokens.
const COLORS = {
  bg: '#faf9f4',
  grid: '#e7e4da',
  wall: '#3c4237',
  accent: '#b3592c', // terra
  primary: '#4d6b52', // salvia
  text: '#6b7263',
};

export class Editor2D {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  plan: Plan;
  tool: Tool = 'select';
  onChange: () => void = () => {};
  /** Host shows its own dialog and calls addLabel() with the result. */
  onRequestLabel: (at: Point) => void = () => {};
  /** Host reacts to selection (wall properties panel, furniture actions). */
  onSelectionChange: (sel: EditorSelection) => void = () => {};

  private scale = 60; // px per meter
  private origin: Point = { x: 80, y: 80 };

  private drawingFrom: Point | null = null;
  private mouseWorld: Point = { x: 0, y: 0 };
  private panning = false;
  private panStart: Point = { x: 0, y: 0 };
  private originStart: Point = { x: 0, y: 0 };
  selectedWallId: string | null = null;
  selectedOpeningId: string | null = null;
  selectedFurnitureId: string | null = null;
  private draggingFurniture = false;
  private dragOffset: Point = { x: 0, y: 0 };

  private ac = new AbortController();

  constructor(canvas: HTMLCanvasElement, plan: Plan) {
    this.canvas = canvas;
    this.plan = plan;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;

    const { signal } = this.ac;
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e), { signal });
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e), { signal });
    canvas.addEventListener('mouseup', () => this.onMouseUp(), { signal });
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false, signal });
    canvas.addEventListener('dblclick', () => this.onDblClick(), { signal });
    window.addEventListener('keydown', (e) => this.onKey(e), { signal });
    window.addEventListener('resize', () => this.resize(), { signal });

    this.resize();
    this.fitView();
    this.render();
  }

  destroy(): void {
    this.ac.abort();
  }

  setPlan(plan: Plan): void {
    this.plan = plan;
    this.selectedWallId = null;
    this.selectedOpeningId = null;
    this.selectedFurnitureId = null;
    this.drawingFrom = null;
    this.notifySelection();
    this.fitView();
    this.render();
  }

  private notifySelection(): void {
    this.onSelectionChange({
      wallId: this.selectedWallId,
      openingId: this.selectedOpeningId,
      furnitureId: this.selectedFurnitureId,
    });
  }

  /** Place a catalog piece at a point (default: center of the current view). */
  placeFurniture(catalogId: string, at?: Point): void {
    const def = getFurniture(catalogId);
    if (!def) return;
    const rect = this.canvas.getBoundingClientRect();
    const p = at ?? this.toWorld(rect.width / 2, rect.height / 2);
    const item: FurnitureItem = {
      id: uid('f'),
      catalogId,
      x: Math.round(p.x * 20) / 20,
      y: Math.round(p.y * 20) / 20,
      rotation: 0,
    };
    if (!this.plan.furniture) this.plan.furniture = [];
    this.plan.furniture.push(item);
    this.selectedFurnitureId = item.id;
    this.selectedWallId = null;
    this.selectedOpeningId = null;
    this.notifySelection();
    this.changed();
  }

  /** Rotate the selected piece by 90°. */
  rotateSelectedFurniture(): void {
    const item = this.plan.furniture?.find((f) => f.id === this.selectedFurnitureId);
    if (!item) return;
    item.rotation = (item.rotation + Math.PI / 2) % (Math.PI * 2);
    this.changed();
  }

  private hitFurniture(p: Point): FurnitureItem | null {
    const items = this.plan.furniture ?? [];
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const def = getFurniture(item.catalogId);
      if (!def) continue;
      // Transform to the piece's local frame (inverse of the 3D rotation.y).
      const dx = p.x - item.x;
      const dy = p.y - item.y;
      const cos = Math.cos(item.rotation);
      const sin = Math.sin(item.rotation);
      const lx = dx * cos - dy * sin;
      const lz = dx * sin + dy * cos;
      if (Math.abs(lx) <= def.footprint.w / 2 && Math.abs(lz) <= def.footprint.d / 2) return item;
    }
    return null;
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    this.drawingFrom = null;
    this.render();
  }

  addLabel(at: Point, name: string): void {
    this.plan.labels.push({ id: uid('l'), name, at });
    this.changed();
  }

  fitView(): void {
    if (this.plan.walls.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const w of this.plan.walls) {
      for (const p of [w.a, w.b]) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
    const pad = 60;
    const rect = this.canvas.getBoundingClientRect();
    const sx = (rect.width - pad * 2) / Math.max(0.1, maxX - minX);
    const sy = (rect.height - pad * 2) / Math.max(0.1, maxY - minY);
    this.scale = Math.max(10, Math.min(200, Math.min(sx, sy)));
    this.origin = {
      x: rect.width / 2 - ((minX + maxX) / 2) * this.scale,
      y: rect.height / 2 - ((minY + maxY) / 2) * this.scale,
    };
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  private toWorld(sx: number, sy: number): Point {
    return { x: (sx - this.origin.x) / this.scale, y: (sy - this.origin.y) / this.scale };
  }

  private toScreen(p: Point): Point {
    return { x: this.origin.x + p.x * this.scale, y: this.origin.y + p.y * this.scale };
  }

  private snap(p: Point): Point {
    for (const w of this.plan.walls) {
      for (const end of [w.a, w.b]) {
        if (Math.hypot(p.x - end.x, p.y - end.y) < 8 / this.scale) return { ...end };
      }
    }
    return { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID };
  }

  private eventWorld(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return this.toWorld(e.clientX - rect.left, e.clientY - rect.top);
  }

  private hitWall(p: Point): { wall: Wall; offset: number } | null {
    let best: { wall: Wall; offset: number; dist: number } | null = null;
    for (const w of this.plan.walls) {
      const { dist, offset } = distToWall(w, p);
      if (dist < 12 / this.scale && (!best || dist < best.dist)) {
        best = { wall: w, offset, dist };
      }
    }
    return best ? { wall: best.wall, offset: best.offset } : null;
  }

  private hitOpening(p: Point): { wall: Wall; opening: Opening } | null {
    const hit = this.hitWall(p);
    if (!hit) return null;
    for (const o of hit.wall.openings) {
      if (Math.abs(o.offset - hit.offset) < o.width / 2 + 0.1)
        return { wall: hit.wall, opening: o };
    }
    return null;
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
      this.panning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.originStart = { ...this.origin };
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    const world = this.eventWorld(e);

    if (this.tool === 'wall') {
      const snapped = this.snap(world);
      if (!this.drawingFrom) {
        this.drawingFrom = snapped;
      } else {
        this.commitWall(this.drawingFrom, this.axisSnap(this.drawingFrom, snapped));
        this.drawingFrom = snapped;
      }
    } else if (this.tool === 'door' || this.tool === 'window') {
      const hit = this.hitWall(world);
      if (hit) {
        const def = this.tool === 'door' ? DEFAULTS.door : DEFAULTS.window;
        const len = wallLength(hit.wall);
        const offset = Math.max(
          def.width / 2 + 0.05,
          Math.min(len - def.width / 2 - 0.05, hit.offset),
        );
        if (len >= def.width + 0.1) {
          hit.wall.openings.push({
            id: uid('o'),
            type: this.tool,
            offset,
            width: def.width,
            height: def.height,
            sill: def.sill,
          });
          this.changed();
        }
      }
    } else if (this.tool === 'label') {
      this.onRequestLabel(world);
    } else if (this.tool === 'select') {
      const furn = this.hitFurniture(world);
      if (furn) {
        this.selectedFurnitureId = furn.id;
        this.selectedWallId = null;
        this.selectedOpeningId = null;
        this.draggingFurniture = true;
        this.dragOffset = { x: world.x - furn.x, y: world.y - furn.y };
      } else {
        this.selectedFurnitureId = null;
        const op = this.hitOpening(world);
        if (op) {
          this.selectedOpeningId = op.opening.id;
          this.selectedWallId = op.wall.id;
        } else {
          const hit = this.hitWall(world);
          this.selectedWallId = hit ? hit.wall.id : null;
          this.selectedOpeningId = null;
        }
      }
      this.notifySelection();
      this.render();
    }
  }

  /** Hold near-axis lines to exact horizontal/vertical. */
  private axisSnap(from: Point, to: Point): Point {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    if (dx > dy * 4) return { x: to.x, y: from.y };
    if (dy > dx * 4) return { x: from.x, y: to.y };
    return to;
  }

  private commitWall(a: Point, b: Point): void {
    if (Math.hypot(b.x - a.x, b.y - a.y) < GRID / 2) return;
    this.plan.walls.push({
      id: uid('w'),
      a,
      b,
      thickness: DEFAULTS.wallThicknessInt,
      height: DEFAULTS.wallHeight,
      openings: [],
    });
    this.changed();
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.panning) {
      this.origin = {
        x: this.originStart.x + (e.clientX - this.panStart.x),
        y: this.originStart.y + (e.clientY - this.panStart.y),
      };
      this.render();
      return;
    }
    this.mouseWorld = this.eventWorld(e);
    if (this.draggingFurniture && this.selectedFurnitureId) {
      const item = this.plan.furniture?.find((f) => f.id === this.selectedFurnitureId);
      if (item) {
        item.x = Math.round((this.mouseWorld.x - this.dragOffset.x) * 20) / 20;
        item.y = Math.round((this.mouseWorld.y - this.dragOffset.y) * 20) / 20;
      }
    }
    this.render();
  }

  private onMouseUp(): void {
    this.panning = false;
    if (this.draggingFurniture) {
      this.draggingFurniture = false;
      this.onChange(); // commit the drag to the host (3D rebuild)
    }
  }

  private onDblClick(): void {
    // Double click ends the current polyline.
    this.drawingFrom = null;
    this.render();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const before = this.toWorld(mx, my);
    const factor = Math.exp(-e.deltaY * 0.0015);
    this.scale = Math.max(5, Math.min(400, this.scale * factor));
    this.origin = { x: mx - before.x * this.scale, y: my - before.y * this.scale };
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.drawingFrom = null;
      this.selectedWallId = null;
      this.selectedOpeningId = null;
      this.selectedFurnitureId = null;
      this.notifySelection();
      this.render();
    }
    if ((e.key === 'r' || e.key === 'R') && document.activeElement === document.body) {
      this.rotateSelectedFurniture();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === document.body) {
      if (this.selectedFurnitureId && this.plan.furniture) {
        this.plan.furniture = this.plan.furniture.filter(
          (f) => f.id !== this.selectedFurnitureId,
        );
        this.selectedFurnitureId = null;
        this.notifySelection();
        this.changed();
      } else if (this.selectedOpeningId && this.selectedWallId) {
        const wall = this.plan.walls.find((w) => w.id === this.selectedWallId);
        if (wall) {
          wall.openings = wall.openings.filter((o) => o.id !== this.selectedOpeningId);
          this.selectedOpeningId = null;
          this.notifySelection();
          this.changed();
        }
      } else if (this.selectedWallId) {
        this.plan.walls = this.plan.walls.filter((w) => w.id !== this.selectedWallId);
        this.selectedWallId = null;
        this.notifySelection();
        this.changed();
      }
    }
  }

  private changed(): void {
    this.onChange();
    this.render();
  }

  render(): void {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, rect.width, rect.height);

    this.drawGrid(rect.width, rect.height);

    for (const w of this.plan.walls) this.drawWall(w);
    for (const f of this.plan.furniture ?? []) this.drawFurniture(f);
    for (const label of this.plan.labels) {
      const s = this.toScreen(label.at);
      ctx.fillStyle = COLORS.text;
      ctx.font = '13px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label.name, s.x, s.y);
    }

    if (this.tool === 'wall' && this.drawingFrom) {
      const to = this.axisSnap(this.drawingFrom, this.snap(this.mouseWorld));
      const a = this.toScreen(this.drawingFrom);
      const b = this.toScreen(to);
      ctx.strokeStyle = COLORS.primary;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const len = Math.hypot(to.x - this.drawingFrom.x, to.y - this.drawingFrom.y);
      ctx.fillStyle = COLORS.primary;
      ctx.font = '12px Inter Variable, system-ui, sans-serif';
      ctx.fillText(`${len.toFixed(2)} m`, (a.x + b.x) / 2 + 8, (a.y + b.y) / 2 - 8);
    }

    if (this.tool === 'wall') {
      const sp = this.toScreen(this.snap(this.mouseWorld));
      ctx.strokeStyle = COLORS.primary;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Furniture footprint: rotated rect + short name; selection highlighted. */
  private drawFurniture(item: FurnitureItem): void {
    const def = getFurniture(item.catalogId);
    if (!def) return;
    const ctx = this.ctx;
    const s = this.toScreen({ x: item.x, y: item.y });
    const selected = item.id === this.selectedFurnitureId;
    ctx.save();
    ctx.translate(s.x, s.y);
    // Canvas rotation matching the 3D rotation.y (plan y = world z).
    ctx.rotate(-item.rotation);
    const w = def.footprint.w * this.scale;
    const d = def.footprint.d * this.scale;
    ctx.fillStyle = selected ? 'rgba(179, 89, 44, 0.14)' : 'rgba(77, 107, 82, 0.10)';
    ctx.strokeStyle = selected ? COLORS.accent : COLORS.primary;
    ctx.lineWidth = selected ? 2 : 1.2;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -d / 2, w, d, Math.min(6, w / 6));
    ctx.fill();
    ctx.stroke();
    // Facing tick on the front side (+z local).
    ctx.beginPath();
    ctx.moveTo(0, d / 2);
    ctx.lineTo(0, d / 2 - Math.min(10, d / 3));
    ctx.stroke();
    ctx.restore();
    if (this.scale > 20) {
      ctx.fillStyle = selected ? COLORS.accent : COLORS.text;
      ctx.font = '10px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(def.nome.split(' ')[0], s.x, s.y + 3);
    }
  }

  private drawGrid(w: number, h: number): void {
    const ctx = this.ctx;
    const step = MAJOR_GRID * this.scale;
    if (step < 8) return;
    const x0 = ((this.origin.x % step) + step) % step;
    const y0 = ((this.origin.y % step) + step) % step;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x < w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = y0; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  private drawWall(w: Wall): void {
    const ctx = this.ctx;
    const a = this.toScreen(w.a);
    const b = this.toScreen(w.b);
    const selected = w.id === this.selectedWallId;

    ctx.strokeStyle = selected ? COLORS.accent : COLORS.wall;
    ctx.lineWidth = Math.max(3, w.thickness * this.scale);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    const len = wallLength(w);
    if (len > 0.5 && this.scale > 25) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const d = wallDir(w);
      ctx.fillStyle = COLORS.text;
      ctx.font = '11px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${len.toFixed(2)}`, mid.x - d.y * 14, mid.y + d.x * 14);
    }

    for (const o of w.openings) {
      const c = pointOnWall(w, o.offset);
      const d = wallDir(w);
      const half = o.width / 2;
      const p1 = this.toScreen({ x: c.x - d.x * half, y: c.y - d.y * half });
      const p2 = this.toScreen({ x: c.x + d.x * half, y: c.y + d.y * half });
      const isSel = o.id === this.selectedOpeningId;
      // Cut the wall visually
      ctx.strokeStyle = COLORS.bg;
      ctx.lineWidth = Math.max(3, w.thickness * this.scale) + 2;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      if (o.type === 'door') {
        const s1 = this.toScreen({ x: c.x - d.x * half, y: c.y - d.y * half });
        ctx.strokeStyle = isSel ? COLORS.accent : '#7a5c2e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const angle = Math.atan2(d.y, d.x);
        ctx.arc(s1.x, s1.y, o.width * this.scale, angle, angle + Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(
          s1.x + Math.cos(angle + Math.PI / 2) * o.width * this.scale,
          s1.y + Math.sin(angle + Math.PI / 2) * o.width * this.scale,
        );
        ctx.stroke();
      } else {
        ctx.strokeStyle = isSel ? COLORS.accent : COLORS.primary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath();
        const nx = -d.y * 3;
        const ny = d.x * 3;
        ctx.moveTo(p1.x + nx, p1.y + ny);
        ctx.lineTo(p2.x + nx, p2.y + ny);
        ctx.moveTo(p1.x - nx, p1.y - ny);
        ctx.lineTo(p2.x - nx, p2.y - ny);
        ctx.stroke();
      }
    }
  }
}
