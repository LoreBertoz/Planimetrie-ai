// 3D engine (ported from prototype P1): extrudes the wall-based Plan into
// walls with real door/window openings, floor slab, orbit controls, glTF
// export. Adds: natural-material rendering from the catalog and a first-person
// walk mode (pointer lock + WASD) for the house tour.
// Plan (x, y) maps to world (x, z); height is world y.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import type { Plan, Wall } from '../types';
import { wallLength, distToWall } from '../lib/model';
import {
  DEFAULT_ASSIGNMENT,
  getMaterial,
  type MaterialAssignment,
} from '../materials/catalog';

const GLASS_COLOR = 0xaecfc2;
const EYE_HEIGHT = 1.6;
const WALK_SPEED = 2.6; // m/s
const BODY_RADIUS = 0.22;

function toStandard(defId: string, fallback: number): THREE.MeshStandardMaterial {
  const def = getMaterial(defId);
  if (!def) return new THREE.MeshStandardMaterial({ color: fallback, roughness: 0.9 });
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(def.pbr.color),
    roughness: def.pbr.roughness,
    metalness: def.pbr.metalness,
  });
}

export class Viewer3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private buildingGroup: THREE.Group;
  private resizeObserver: ResizeObserver;
  private container: HTMLElement;

  private plan: Plan | null = null;
  private assignment: MaterialAssignment = DEFAULT_ASSIGNMENT;

  // Tour state
  private touring = false;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private lastTime = performance.now();
  private savedCamera: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  onTourChange: (touring: boolean) => void = () => {};

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    // Esc exits the tour even when pointer lock was unavailable (drag-look).
    if (e.code === 'Escape' && this.touring) this.stopTour();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onPointerLockChange = () => {
    if (document.pointerLockElement !== this.renderer.domElement && this.touring) {
      this.stopTour();
    }
  };
  private dragLook = false;
  private dragging = false;

  private onMouseMove = (e: MouseEvent) => {
    if (!this.touring) return;
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (!locked && !(this.dragLook && this.dragging)) return;
    this.yaw -= e.movementX * 0.0022;
    this.pitch -= e.movementY * 0.0022;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
  };

  // Drag-look fallback (pointer lock denied, touch devices).
  private onPointerDown = () => {
    if (this.touring && this.dragLook) this.dragging = true;
  };
  private onPointerUp = () => {
    this.dragging = false;
  };

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf3f0e8);
    this.scene.fog = new THREE.Fog(0xf3f0e8, 60, 160);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    this.camera.position.set(12, 12, 12);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    const ambient = new THREE.HemisphereLight(0xffffff, 0x9a8f7a, 0.9);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({ color: 0xb9c4a8, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.buildingGroup = new THREE.Group();
    this.buildingGroup.name = 'building';
    this.scene.add(this.buildingGroup);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(container);
    resize();

    if (import.meta.env.DEV) {
      (window as unknown as { __pai3d?: Viewer3D }).__pai3d = this;
    }
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);

    this.renderer.setAnimationLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      if (this.touring) {
        this.updateWalk(dt);
      } else {
        this.controls.update();
      }
      this.renderer.render(this.scene, this.camera);
    });
  }

  build(plan: Plan, assignment?: MaterialAssignment): void {
    this.plan = plan;
    if (assignment) this.assignment = assignment;
    this.buildingGroup.clear();

    const extMat = toStandard(this.assignment.esterno, 0xf2efe8);
    const intMat = toStandard(this.assignment.interno, 0xf2efe8);
    const glassMat = new THREE.MeshStandardMaterial({
      color: GLASS_COLOR,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.45,
    });

    for (const wall of plan.walls) {
      const mat = wall.materialId
        ? toStandard(wall.materialId, 0xf2efe8)
        : wall.exterior
          ? extMat
          : intMat;
      const group = this.buildWall(wall, mat, glassMat);
      this.buildingGroup.add(group);
    }

    // Floor slab under the bounding box of all walls.
    if (plan.walls.length > 0) {
      const { minX, minY, maxX, maxY } = this.bounds(plan);
      const t = 0.1;
      const floorMat = toStandard(plan.floorMaterialId ?? this.assignment.pavimento, 0xd8cdb8);
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(maxX - minX + 0.4, t, maxY - minY + 0.4),
        floorMat,
      );
      floor.position.set((minX + maxX) / 2, -t / 2 + 0.01, (minY + maxY) / 2);
      floor.receiveShadow = true;
      floor.name = 'floor';
      this.buildingGroup.add(floor);

      if (!this.touring) {
        // Frame the camera on the building.
        const cx = (minX + maxX) / 2;
        const cz = (minY + maxY) / 2;
        const span = Math.max(maxX - minX, maxY - minY);
        this.controls.target.set(cx, 1, cz);
        this.camera.position.set(cx + span * 0.9, span * 0.8, cz + span * 1.1);
      }
    }
  }

  setMaterials(assignment: MaterialAssignment): void {
    this.assignment = assignment;
    if (this.plan) this.build(this.plan, assignment);
  }

  private bounds(plan: Plan) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const w of plan.walls) {
      for (const p of [w.a, w.b]) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
    return { minX, minY, maxX, maxY };
  }

  /** Wall as boxes: solid segments between openings, lintels above, sills below windows. */
  private buildWall(wall: Wall, wallMat: THREE.Material, glassMat: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    group.name = wall.id;
    const len = wallLength(wall);
    const t = wall.thickness;
    const h = wall.height;

    const addBox = (x0: number, x1: number, y0: number, y1: number, mat: THREE.Material) => {
      const w = x1 - x0;
      const hh = y1 - y0;
      if (w <= 0.001 || hh <= 0.001) return;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hh, t), mat);
      mesh.position.set(x0 + w / 2, y0 + hh / 2, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };

    const openings = [...wall.openings]
      .sort((a, b) => a.offset - b.offset)
      .map((o) => ({
        ...o,
        start: Math.max(0, o.offset - o.width / 2),
        end: Math.min(len, o.offset + o.width / 2),
      }))
      .filter((o) => o.end > o.start);

    let cursor = 0;
    for (const o of openings) {
      if (o.start < cursor) continue; // overlapping opening: skip
      addBox(cursor, o.start, 0, h, wallMat); // solid segment before opening
      if (o.sill > 0) addBox(o.start, o.end, 0, o.sill, wallMat); // below window
      const top = o.sill + o.height;
      if (top < h) addBox(o.start, o.end, top, h, wallMat); // lintel
      if (o.type === 'window') {
        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(o.end - o.start, o.height, 0.04),
          glassMat,
        );
        glass.position.set((o.start + o.end) / 2, o.sill + o.height / 2, 0);
        group.add(glass);
      }
      cursor = o.end;
    }
    addBox(cursor, len, 0, h, wallMat); // remaining solid segment

    // Place in world: rotate around Y, plan y -> world z.
    const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
    group.rotation.y = -angle;
    group.position.set(wall.a.x, 0, wall.a.y);
    return group;
  }

  /* ------------------------------ Tour mode ------------------------------ */

  startTour(): void {
    if (!this.plan || this.plan.walls.length === 0) return;
    this.savedCamera = {
      pos: this.camera.position.clone(),
      target: this.controls.target.clone(),
    };
    // Start at the center of the plan, eye height, looking along -z.
    const { minX, minY, maxX, maxY } = this.bounds(this.plan);
    this.camera.position.set((minX + maxX) / 2, EYE_HEIGHT, (minY + maxY) / 2);
    this.yaw = 0;
    this.pitch = 0;
    this.touring = true;
    this.controls.enabled = false;
    this.dragLook = false;
    this.onTourChange(true);
    // Pointer lock needs a trusted user gesture and may be denied: fall back
    // to drag-look so the tour still works (also covers touch devices).
    try {
      const req = this.renderer.domElement.requestPointerLock() as unknown;
      if (req instanceof Promise) req.catch(() => (this.dragLook = true));
    } catch {
      this.dragLook = true;
    }
  }

  stopTour(): void {
    if (!this.touring) return;
    this.touring = false;
    this.controls.enabled = true;
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    if (this.savedCamera) {
      this.camera.position.copy(this.savedCamera.pos);
      this.controls.target.copy(this.savedCamera.target);
    }
    this.onTourChange(false);
  }

  get isTouring(): boolean {
    return this.touring;
  }

  private updateWalk(dt: number): void {
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);

    const forward =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const strafe =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    if (forward === 0 && strafe === 0) return;

    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * -forward + Math.cos(this.yaw) * strafe,
      0,
      Math.cos(this.yaw) * -forward - Math.sin(this.yaw) * strafe,
    );
    if (dir.lengthSq() > 1) dir.normalize();
    const step = dir.multiplyScalar(WALK_SPEED * dt);

    // Axis-separated collision so we slide along walls.
    const pos = this.camera.position;
    const tryMove = (dx: number, dz: number) => {
      const next = { x: pos.x + dx, y: pos.z + dz };
      if (!this.collides(next.x, next.y)) {
        pos.x += dx;
        pos.z += dz;
      }
    };
    tryMove(step.x, 0);
    tryMove(0, step.z);
    pos.y = EYE_HEIGHT;
  }

  /** Circle-vs-walls collision; door openings let you through. */
  private collides(x: number, y: number): boolean {
    if (!this.plan) return false;
    for (const w of this.plan.walls) {
      const { dist, offset } = distToWall(w, { x, y });
      const clearance = w.thickness / 2 + BODY_RADIUS;
      if (dist >= clearance) continue;
      // Inside a door opening? Then passage is allowed.
      const inDoor = w.openings.some(
        (o) =>
          o.type === 'door' &&
          offset > o.offset - o.width / 2 + 0.05 &&
          offset < o.offset + o.width / 2 - 0.05,
      );
      if (!inDoor) return true;
    }
    return false;
  }

  /* ------------------------------- Export -------------------------------- */

  async exportGLB(name: string): Promise<void> {
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(this.buildingGroup, { binary: true });
    const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.glb`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  dispose(): void {
    this.stopTour();
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
