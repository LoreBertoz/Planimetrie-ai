// 3D engine (ported from prototype P1): extrudes the wall-based Plan into
// walls with real door/window openings, floor slab, orbit controls, glTF
// export. Adds: natural-material rendering from the catalog (6 surfaces),
// procedural roof + ceiling, image-based lighting, per-room lights, furniture
// and a first-person walk mode (pointer lock + WASD) for the house tour.
// Plan (x, y) maps to world (x, z); height is world y.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Plan, Point, RoofOptions, Wall } from '../types';
import { DEFAULT_ROOF } from '../types';
import { wallLength, distToWall } from '../lib/model';
import {
  DEFAULT_ASSIGNMENT,
  getMaterial,
  type MaterialAssignment,
} from '../materials/catalog';
import { getFurniture } from '../materials/furnitureCatalog';
import { buildRoofGroup } from './roof';
import { applyTextureSet, boxUVsToMeters, planeUVsToMeters } from './textures';

const GLASS_COLOR = 0xaecfc2;
const EYE_HEIGHT = 1.6;
const WALK_SPEED = 2.6; // m/s
const BODY_RADIUS = 0.22;
const MAX_ROOM_LIGHTS = 12;

function toStandard(defId: string | undefined, fallback: number): THREE.MeshStandardMaterial {
  const def = getMaterial(defId);
  if (!def) return new THREE.MeshStandardMaterial({ color: fallback, roughness: 0.9 });
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(def.pbr.color),
    roughness: def.pbr.roughness,
    metalness: def.pbr.metalness,
  });
  // Real PBR texture set when the catalog provides one (Fase 12).
  if (def.pbr.textureSet) {
    applyTextureSet(mat, def.pbr.textureSet, def.pbr.textureSize ?? 2, def.pbr.tint);
  }
  return mat;
}

/** Recursively free GPU resources of a subtree (three.js disposal pattern).
 *  Prevents leaks/flicker after repeated regenerations in one session.
 *  Textures flagged userData.shared belong to the global cache and are
 *  reused across rebuilds — never dispose those. */
function disposeSubtree(root: THREE.Object3D): void {
  const freeTex = (t: THREE.Texture | null | undefined) => {
    if (t && !t.userData.shared) t.dispose();
  };
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      const sm = m as THREE.MeshStandardMaterial;
      freeTex(sm.map);
      freeTex(sm.normalMap);
      freeTex(sm.roughnessMap);
      m.dispose();
    }
  });
}

interface Collider {
  x: number;
  y: number;
  r: number;
}

export class Viewer3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private composer: EffectComposer;
  private gtaoPass: GTAOPass;
  private sun: THREE.DirectionalLight;
  private buildingGroup: THREE.Group;
  private roofGroup: THREE.Group | null = null;
  private ceiling: THREE.Mesh | null = null;
  private roomLights: THREE.Group;
  private pmrem: THREE.PMREMGenerator;
  private envTexture: THREE.Texture;
  private resizeObserver: ResizeObserver;
  private container: HTMLElement;

  private plan: Plan | null = null;
  private assignment: MaterialAssignment = DEFAULT_ASSIGNMENT;
  private roof: RoofOptions = { ...DEFAULT_ROOF };
  private furnitureColliders: Collider[] = [];

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
    // Cinematic response curve (Fase 13): filmic highlights, no clipping.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdfe8ef);
    this.scene.fog = new THREE.Fog(0xdfe8ef, 60, 160);

    // Image-based lighting from three's procedural RoomEnvironment: HDRI-like
    // reflections and soft fill with zero external assets to load.
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    this.camera.position.set(12, 12, 12);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    const ambient = new THREE.HemisphereLight(0xffffff, 0x9a8f7a, 0.5);
    this.scene.add(ambient);
    // 2048px shadow map with a frustum fitted to the plan in build():
    // sharper shadows than a fixed 4096 wide frustum, at 1/4 the memory.
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.bias = -0.0002;
    this.sun = sun;
    this.scene.add(sun);

    // Real grass PBR set on a meter-scaled plane (Fase 12).
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    planeUVsToMeters(groundGeo, 400, 400);
    const groundMat = new THREE.MeshStandardMaterial({ roughness: 1 });
    applyTextureSet(groundMat, 'grass', 2.5, '#dfe3d0'); // soften the green
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.buildingGroup = new THREE.Group();
    this.buildingGroup.name = 'building';
    this.scene.add(this.buildingGroup);

    this.roomLights = new THREE.Group();
    this.roomLights.name = 'roomLights';
    this.scene.add(this.roomLights);

    // Ambient occlusion (contact shading) — used in orbit view only; the
    // first-person tour renders directly to keep the framerate high.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.gtaoPass = new GTAOPass(this.scene, this.camera);
    this.gtaoPass.output = GTAOPass.OUTPUT.Default;
    this.composer.addPass(this.gtaoPass);
    this.composer.addPass(new OutputPass());

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      const ratio = Math.min(window.devicePixelRatio, 2); // cap for perf
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(ratio);
      this.composer.setSize(w, h);
      this.composer.setPixelRatio(ratio);
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
        // Direct render in walk mode: no AO cost, max framerate.
        this.renderer.render(this.scene, this.camera);
      } else {
        this.controls.update();
        this.composer.render();
      }
    });
  }

  build(plan: Plan, assignment?: MaterialAssignment, roof?: RoofOptions): void {
    this.plan = plan;
    if (assignment) this.assignment = assignment;
    if (roof) this.roof = roof;
    // Free GPU resources of the previous build before replacing it.
    disposeSubtree(this.buildingGroup);
    this.buildingGroup.clear();
    this.roofGroup = null;
    this.ceiling = null;
    this.roomLights.clear();
    this.furnitureColliders = [];

    const extMat = toStandard(this.assignment.exteriorWalls, 0xf2efe8);
    const intMat = toStandard(this.assignment.walls, 0xf2efe8);
    const doorMat = toStandard(this.assignment.doors, 0xb08d5f);
    const frameMat = toStandard(this.assignment.windows, 0x9a7a4f);
    const glassMat = new THREE.MeshStandardMaterial({
      color: GLASS_COLOR,
      roughness: 0.05,
      metalness: 0.3,
      transparent: true,
      opacity: 0.4,
      envMapIntensity: 1.5, // sharper IBL reflections on glazing
    });

    // Shared trim materials (Fase 13): skirting boards + stone window sills.
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.55 });
    const sillMat = toStandard('pietra-chiara', 0xd5d0c4);

    for (const wall of plan.walls) {
      const override = wall.materialId ? toStandard(wall.materialId, 0xf2efe8) : null;
      const group = this.buildWall(
        wall,
        override ?? intMat,
        override ?? (wall.exterior ? extMat : intMat),
        glassMat,
        doorMat,
        frameMat,
        skirtMat,
        sillMat,
      );
      this.buildingGroup.add(group);
    }

    if (plan.walls.length > 0) {
      const { minX, minY, maxX, maxY } = this.bounds(plan);
      const wallHeight = plan.walls[0]?.height ?? 2.7;

      // Fit the sun shadow frustum to the plan: sharper shadows from a
      // smaller map than a fixed oversized box.
      const cx0 = (minX + maxX) / 2;
      const cz0 = (minY + maxY) / 2;
      const radius = Math.max(maxX - minX, maxY - minY) / 2 + 6;
      this.sun.position.set(cx0 + 14, 22, cz0 + 8);
      this.sun.target.position.set(cx0, 0, cz0);
      this.sun.target.updateMatrixWorld();
      const sc = this.sun.shadow.camera;
      sc.left = -radius;
      sc.right = radius;
      sc.top = radius;
      sc.bottom = -radius;
      sc.updateProjectionMatrix();

      // Floor slab under the bounding box of all walls.
      const t = 0.1;
      const floorMat = toStandard(plan.floorMaterialId ?? this.assignment.flooring, 0xd8cdb8);
      const floorGeo = new THREE.BoxGeometry(maxX - minX + 0.4, t, maxY - minY + 0.4);
      boxUVsToMeters(floorGeo, maxX - minX + 0.4, t, maxY - minY + 0.4);
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.position.set((minX + maxX) / 2, -t / 2 + 0.01, (minY + maxY) / 2);
      floor.receiveShadow = true;
      floor.name = 'floor';
      this.buildingGroup.add(floor);

      // Ceiling slab at wall height (Fase 8), textured via assignment.ceiling.
      const ceilMat = toStandard(this.assignment.ceiling, 0xf2efe7);
      const ceilGeo = new THREE.BoxGeometry(maxX - minX + 0.1, 0.08, maxY - minY + 0.1);
      boxUVsToMeters(ceilGeo, maxX - minX + 0.1, 0.08, maxY - minY + 0.1);
      const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
      ceiling.position.set((minX + maxX) / 2, wallHeight + 0.04, (minY + maxY) / 2);
      ceiling.receiveShadow = true;
      ceiling.name = 'ceiling';
      ceiling.visible = this.roof.visible;
      this.ceiling = ceiling;
      this.buildingGroup.add(ceiling);

      // Procedural roof (Fase 8) over the room footprint (bbox fallback).
      const rects =
        plan.rooms && plan.rooms.length > 0
          ? plan.rooms
          : [{ x: minX, y: minY, w: maxX - minX, h: maxY - minY }];
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0xa1583f, // coppi fallback
        roughness: 0.9,
        metalness: 0,
        side: THREE.DoubleSide,
      });
      applyTextureSet(roofMat, 'roof-tiles', 2); // clay tiles (RoofingTiles014A)
      const gableMat = toStandard(this.assignment.exteriorWalls, 0xf2efe8);
      gableMat.side = THREE.DoubleSide;
      const exteriorWalls = plan.walls.filter((w) => w.exterior);
      this.roofGroup = buildRoofGroup(rects, exteriorWalls, wallHeight, this.roof, roofMat, gableMat);
      this.roofGroup.visible = this.roof.visible;
      this.buildingGroup.add(this.roofGroup);

      // One warm light per room, auto-placed at its center below the ceiling,
      // plus a small emissive ceiling lamp so the light source reads as real.
      if (plan.rooms) {
        const lampShade = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.6 });
        const lampBulb = new THREE.MeshStandardMaterial({
          color: 0xfff4dd,
          emissive: 0xffe9c0,
          emissiveIntensity: 2.2,
        });
        const shadeGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.1, 16);
        const bulbGeo = new THREE.SphereGeometry(0.05, 10, 8);
        for (const room of plan.rooms.slice(0, MAX_ROOM_LIGHTS)) {
          const cxr = room.x + room.w / 2;
          const czr = room.y + room.h / 2;
          const light = new THREE.PointLight(0xffe9c9, 4, 7, 1.8);
          light.position.set(cxr, wallHeight - 0.35, czr);
          this.roomLights.add(light);
          const shade = new THREE.Mesh(shadeGeo, lampShade);
          shade.position.set(cxr, wallHeight - 0.09, czr);
          this.buildingGroup.add(shade);
          const bulb = new THREE.Mesh(bulbGeo, lampBulb);
          bulb.position.set(cxr, wallHeight - 0.17, czr);
          this.buildingGroup.add(bulb);
        }
      }

      this.buildExterior(plan, minX, minY, maxX, maxY);

      // Furniture (Fase 10): procedural pieces from the catalog.
      for (const item of plan.furniture ?? []) {
        const def = getFurniture(item.catalogId);
        if (!def) continue;
        const piece = def.build();
        piece.name = item.id;
        piece.position.set(item.x, 0, item.y);
        piece.rotation.y = item.rotation;
        this.buildingGroup.add(piece);
        // Coarse collision only for bulky pieces so the walk doesn't clip
        // through them; small items (wc, lavabo) stay walkable-around.
        const maxDim = Math.max(def.footprint.w, def.footprint.d);
        if (maxDim >= 0.8) {
          this.furnitureColliders.push({ x: item.x, y: item.y, r: maxDim * 0.38 });
        }
      }

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

  /** Change roof type/slope/visibility. Visibility flips without a rebuild. */
  setRoof(roof: RoofOptions): void {
    const needsRebuild =
      roof.type !== this.roof.type || Math.abs(roof.slope - this.roof.slope) > 1e-3;
    this.roof = roof;
    if (needsRebuild && this.plan) {
      this.build(this.plan);
      return;
    }
    if (this.roofGroup) this.roofGroup.visible = roof.visible;
    if (this.ceiling) this.ceiling.visible = roof.visible;
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

  /** True if the plan point lies inside one of the plan's rooms. */
  private insideRoom(p: Point): boolean {
    const rooms = this.plan?.rooms;
    if (!rooms) return false;
    return rooms.some((r) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h);
  }

  /** Entrance path + low-poly greenery (Fase 13). Deterministic positions
   *  derived from the plan bounds — same plan, same garden. Everything goes
   *  into buildingGroup so the .glb export includes it. */
  private buildExterior(
    plan: Plan,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): void {
    // Stone path out of the first exterior door.
    const doorWall = plan.walls.find(
      (w) => w.exterior && w.openings.some((o) => o.type === 'door'),
    );
    if (doorWall) {
      const opening = doorWall.openings.find((o) => o.type === 'door')!;
      const angle = Math.atan2(doorWall.b.y - doorWall.a.y, doorWall.b.x - doorWall.a.x);
      const px = doorWall.a.x + Math.cos(angle) * opening.offset;
      const py = doorWall.a.y + Math.sin(angle) * opening.offset;
      // Outward normal: probe which side is outside the rooms.
      let nx = -Math.sin(angle);
      let ny = Math.cos(angle);
      const probe = doorWall.thickness / 2 + 0.1;
      if (this.insideRoom({ x: px + nx * probe, y: py + ny * probe })) {
        nx = -nx;
        ny = -ny;
      }
      const slabMat = toStandard('pietra-chiara', 0xd5d0c4);
      const slabGeo = new THREE.BoxGeometry(0.8, 0.05, 0.55);
      boxUVsToMeters(slabGeo, 0.8, 0.05, 0.55);
      for (let i = 0; i < 4; i++) {
        const d = doorWall.thickness / 2 + 0.45 + i * 0.72;
        const slab = new THREE.Mesh(slabGeo, slabMat);
        slab.position.set(px + nx * d, 0.02, py + ny * d);
        slab.rotation.y = -angle;
        slab.receiveShadow = true;
        this.buildingGroup.add(slab);
      }
    }

    // Bushes at the corners and two trees: cheap icosphere foliage.
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f7a4d, roughness: 1 });
    const leafDarkMat = new THREE.MeshStandardMaterial({ color: 0x4d6640, roughness: 1 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6f5138, roughness: 0.9 });
    const bushGeo = new THREE.IcosahedronGeometry(0.5, 1);
    const bushAt = (x: number, z: number, s: number, dark = false) => {
      const bush = new THREE.Mesh(bushGeo, dark ? leafDarkMat : leafMat);
      bush.position.set(x, 0.32 * s, z);
      bush.scale.set(s, s * 0.75, s);
      bush.castShadow = true;
      this.buildingGroup.add(bush);
    };
    bushAt(minX - 1.3, minY - 1.1, 1);
    bushAt(maxX + 1.4, minY - 1.6, 1.3, true);
    bushAt(maxX + 1.8, maxY + 1.2, 0.9);
    bushAt(minX - 1.7, maxY + 1.6, 1.15, true);
    const treeAt = (x: number, z: number, s: number) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.15 * s, 1.9 * s, 8), trunkMat);
      trunk.position.set(x, 0.95 * s, z);
      trunk.castShadow = true;
      this.buildingGroup.add(trunk);
      const crown = new THREE.Mesh(bushGeo, leafMat);
      crown.position.set(x, 2.35 * s, z);
      crown.scale.set(2.4 * s, 2 * s, 2.4 * s);
      crown.castShadow = true;
      this.buildingGroup.add(crown);
      const crown2 = new THREE.Mesh(bushGeo, leafDarkMat);
      crown2.position.set(x + 0.5 * s, 1.9 * s, z + 0.3 * s);
      crown2.scale.set(1.5 * s, 1.3 * s, 1.5 * s);
      this.buildingGroup.add(crown2);
    };
    treeAt(minX - 3.6, (minY + maxY) / 2 + 1, 1);
    treeAt(maxX + 4.2, minY - 2.2, 1.25);
  }

  /** Wall as boxes: solid segments between openings, lintels above, sills
   *  below windows, door leaves and window frames from the assignment.
   *  Exterior walls get the facade material on the outside face only. */
  private buildWall(
    wall: Wall,
    innerMat: THREE.Material,
    outerMat: THREE.Material,
    glassMat: THREE.Material,
    doorMat: THREE.Material,
    frameMat: THREE.Material,
    skirtMat: THREE.Material,
    sillMat: THREE.Material,
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = wall.id;
    const len = wallLength(wall);
    const t = wall.thickness;
    const h = wall.height;
    const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);

    // Which local side (+z or -z) faces outside? Probe the plan normal.
    // Local +z maps to plan normal (-sinA, cosA).
    let outsideOnPz = false;
    if (wall.exterior) {
      const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
      const probe = t / 2 + 0.08;
      const pz = { x: mid.x - Math.sin(angle) * probe, y: mid.y + Math.cos(angle) * probe };
      outsideOnPz = !this.insideRoom(pz);
    }
    // BoxGeometry face order: [+x, -x, +y, -y, +z, -z].
    const faceMats: THREE.Material[] = wall.exterior
      ? [
          outerMat,
          outerMat,
          outerMat,
          outerMat,
          outsideOnPz ? outerMat : innerMat,
          outsideOnPz ? innerMat : outerMat,
        ]
      : [innerMat, innerMat, innerMat, innerMat, innerMat, innerMat];

    const addBox = (x0: number, x1: number, y0: number, y1: number) => {
      const w = x1 - x0;
      const hh = y1 - y0;
      if (w <= 0.001 || hh <= 0.001) return;
      const geo = new THREE.BoxGeometry(w, hh, t);
      // Meter-scaled UVs with offsets so segments/lintels continue the
      // pattern along the wall instead of restarting at every opening.
      boxUVsToMeters(geo, w, hh, t, x0, y0);
      const mesh = new THREE.Mesh(geo, faceMats);
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
      addBox(cursor, o.start, 0, h); // solid segment before opening
      if (o.sill > 0) addBox(o.start, o.end, 0, o.sill); // below window
      const top = o.sill + o.height;
      if (top < h) addBox(o.start, o.end, top, h); // lintel
      const ow = o.end - o.start;
      const oc = (o.start + o.end) / 2;
      if (o.type === 'window') {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(ow, o.height, 0.04), glassMat);
        glass.position.set(oc, o.sill + o.height / 2, 0);
        group.add(glass);
        // Protruding stone sill (Fase 13).
        const sill = new THREE.Mesh(new THREE.BoxGeometry(ow + 0.12, 0.045, t + 0.14), sillMat);
        sill.position.set(oc, o.sill - 0.0225, 0);
        sill.castShadow = true;
        group.add(sill);
        // Frame from the windows material: two jambs + head + sill piece.
        const ft = 0.07;
        const fd = Math.min(t * 0.7, 0.12);
        const frame = (fw: number, fh: number, fx: number, fy: number) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), frameMat);
          m.position.set(fx, fy, 0);
          m.castShadow = true;
          group.add(m);
        };
        frame(ft, o.height, o.start + ft / 2, o.sill + o.height / 2);
        frame(ft, o.height, o.end - ft / 2, o.sill + o.height / 2);
        frame(ow, ft, oc, o.sill + o.height - ft / 2);
        frame(ow, ft, oc, o.sill + ft / 2);
      } else {
        // Door leaf from the doors material, ajar-looking: slightly inset,
        // leaves a visible gap so the tour can still pass through.
        const leafGeo = new THREE.BoxGeometry(Math.max(0.05, ow - 0.06), o.height - 0.04, 0.045);
        boxUVsToMeters(leafGeo, Math.max(0.05, ow - 0.06), o.height - 0.04, 0.045);
        const leaf = new THREE.Mesh(leafGeo, doorMat);
        leaf.position.set(oc - ow * 0.32, (o.height - 0.04) / 2, t / 2 + 0.03);
        leaf.rotation.y = -1.15; // opened leaf, hinged look
        leaf.castShadow = true;
        group.add(leaf);
        // Door frame jambs.
        const jt = 0.06;
        for (const fx of [o.start + jt / 2, o.end - jt / 2]) {
          const jamb = new THREE.Mesh(new THREE.BoxGeometry(jt, o.height, t + 0.02), doorMat);
          jamb.position.set(fx, o.height / 2, 0);
          group.add(jamb);
        }
      }
      cursor = o.end;
    }
    addBox(cursor, len, 0, h); // remaining solid segment

    // Skirting board / zoccolo (Fase 13): thin base strip along the wall,
    // interrupted only at door openings (windows have wall below the sill).
    const SKIRT_H = 0.08;
    const doorSpans = openings
      .filter((o) => o.type === 'door')
      .map((o) => [o.start, o.end] as const);
    let sx = 0;
    const skirtRuns: [number, number][] = [];
    for (const [ds, de] of doorSpans) {
      if (ds - sx > 0.05) skirtRuns.push([sx, ds]);
      sx = Math.max(sx, de);
    }
    if (len - sx > 0.05) skirtRuns.push([sx, len]);
    for (const [s0, s1] of skirtRuns) {
      const skirt = new THREE.Mesh(
        new THREE.BoxGeometry(s1 - s0, SKIRT_H, t + 0.03),
        skirtMat,
      );
      skirt.position.set((s0 + s1) / 2, SKIRT_H / 2, 0);
      group.add(skirt);
    }

    // Place in world: rotate around Y, plan y -> world z.
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

  /** Circle-vs-walls collision; door openings let you through. Bulky
   *  furniture pieces are coarse circle colliders (Fase 10). */
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
    for (const c of this.furnitureColliders) {
      if (Math.hypot(x - c.x, y - c.y) < c.r + BODY_RADIUS * 0.6) return true;
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
    disposeSubtree(this.scene);
    this.envTexture.dispose();
    this.pmrem.dispose();
    this.composer.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
