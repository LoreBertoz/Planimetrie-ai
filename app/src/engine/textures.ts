// Shared PBR texture loading (Fase 12). One cached THREE.Texture per
// (file, colorspace, repeat) — geometry carries meter-scaled UVs, so a single
// texture instance tiles correctly on every mesh with no per-mesh clones.
// Cached textures are flagged userData.shared and must NEVER be disposed by
// scene teardown (see disposeSubtree in Viewer3D).

import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

function load(path: string, srgb: boolean, repeat: number): THREE.Texture {
  const key = `${path}|${srgb ? 's' : 'l'}|${repeat.toFixed(5)}`;
  let tex = cache.get(key);
  if (!tex) {
    tex = loader.load(path);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = 4; // good glancing-angle quality at low GPU cost
    tex.userData.shared = true;
    cache.set(key, tex);
  }
  return tex;
}

/** Attach a downloaded PBR set (color/normal/roughness) to a material.
 *  `size` = meters covered by one texture tile; UVs must be in meters. */
export function applyTextureSet(
  mat: THREE.MeshStandardMaterial,
  set: string,
  size: number,
  tint?: string,
): void {
  const base = `/textures/${set}`;
  const rep = 1 / size;
  mat.map = load(`${base}/color.jpg`, true, rep);
  mat.normalMap = load(`${base}/normal.jpg`, false, rep);
  mat.roughnessMap = load(`${base}/roughness.jpg`, false, rep);
  // With a photo albedo the flat color becomes a tint (white = neutral).
  mat.color = new THREE.Color(tint ?? '#ffffff');
  mat.needsUpdate = true;
}

/* --------------------- meter-scaled UV helpers --------------------------- */

/** Rescale BoxGeometry UVs from 0..1 to meters. Face order is fixed in
 *  three.js: [+x, -x, +y, -y, +z, -z], 4 vertices each. `offsetU` shifts the
 *  U of the length-facing faces so adjacent wall segments continue the
 *  pattern instead of restarting at every opening. */
export function boxUVsToMeters(
  geo: THREE.BoxGeometry,
  w: number,
  h: number,
  d: number,
  offsetU = 0,
  offsetV = 0,
): void {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  // Per-face [uSpan, vSpan, uOffset, vOffset]
  const spans: [number, number, number, number][] = [
    [d, h, 0, offsetV],
    [d, h, 0, offsetV],
    [w, d, offsetU, 0],
    [w, d, offsetU, 0],
    [w, h, offsetU, offsetV],
    [w, h, offsetU, offsetV],
  ];
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4);
    const [su, sv, ou, ov] = spans[Math.min(face, 5)];
    uv.setXY(i, uv.getX(i) * su + ou, uv.getY(i) * sv + ov);
  }
  uv.needsUpdate = true;
}

/** Rescale PlaneGeometry UVs from 0..1 to meters (w × h). */
export function planeUVsToMeters(geo: THREE.PlaneGeometry, w: number, h: number): void {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  }
  uv.needsUpdate = true;
}

/** Generate meter-scaled UVs for a non-indexed triangle soup (the roof):
 *  near-horizontal faces project top-down (x,z); near-vertical faces project
 *  onto their wall plane (x|z, y). Slope foreshortening at ~30% pitch is
 *  ≈4% — invisible on tiles. */
export function generateWorldUVs(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const count = pos.count;
  const uvs = new Float32Array(count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let t = 0; t < count; t += 3) {
    a.fromBufferAttribute(pos, t);
    b.fromBufferAttribute(pos, t + 1);
    c.fromBufferAttribute(pos, t + 2);
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize();
    for (let k = 0; k < 3; k++) {
      const v = [a, b, c][k];
      let u: number;
      let w: number;
      if (Math.abs(n.y) > 0.5) {
        u = v.x;
        w = v.z;
      } else if (Math.abs(n.x) > Math.abs(n.z)) {
        u = v.z;
        w = v.y;
      } else {
        u = v.x;
        w = v.y;
      }
      uvs[(t + k) * 2] = u;
      uvs[(t + k) * 2 + 1] = w;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}
