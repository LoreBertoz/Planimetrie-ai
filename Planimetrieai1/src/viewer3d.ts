// 3D viewer: extrudes the 2D plan into walls with real door/window openings,
// floor slab, orbit controls, and glTF export.
// Plan (x, y) maps to world (x, z); height is world y.

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import type { Plan, Wall } from './model'
import { wallLength } from './model'

const WALL_COLOR = 0xf2efe8
const FLOOR_COLOR = 0xd8cdb8
const GLASS_COLOR = 0x9fc8e8

export class Viewer3D {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private buildingGroup: THREE.Group

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xeef2f5)

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500)
    this.camera.position.set(12, 12, 12)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true

    const ambient = new THREE.HemisphereLight(0xffffff, 0x9a8f7a, 0.9)
    this.scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.6)
    sun.position.set(20, 30, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -25
    sun.shadow.camera.right = 25
    sun.shadow.camera.top = 25
    sun.shadow.camera.bottom = -25
    this.scene.add(sun)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0xb9c4a8, roughness: 1 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.06
    ground.receiveShadow = true
    this.scene.add(ground)

    this.buildingGroup = new THREE.Group()
    this.buildingGroup.name = 'building'
    this.scene.add(this.buildingGroup)

    const resize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      this.renderer.setSize(w, h)
      this.renderer.setPixelRatio(window.devicePixelRatio)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
    new ResizeObserver(resize).observe(container)
    resize()

    this.renderer.setAnimationLoop(() => {
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    })
  }

  build(plan: Plan): void {
    this.buildingGroup.clear()

    const wallMat = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.9 })
    const glassMat = new THREE.MeshStandardMaterial({
      color: GLASS_COLOR,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.45,
    })

    for (const wall of plan.walls) {
      const group = this.buildWall(wall, wallMat, glassMat)
      this.buildingGroup.add(group)
    }

    // Floor slab under the bounding box of all walls.
    if (plan.walls.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const w of plan.walls) {
        for (const p of [w.a, w.b]) {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
        }
      }
      const t = 0.1
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(maxX - minX + 0.4, t, maxY - minY + 0.4),
        new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.8 })
      )
      floor.position.set((minX + maxX) / 2, -t / 2 + 0.01, (minY + maxY) / 2)
      floor.receiveShadow = true
      floor.name = 'floor'
      this.buildingGroup.add(floor)

      // Frame the camera on the building.
      const cx = (minX + maxX) / 2
      const cz = (minY + maxY) / 2
      const span = Math.max(maxX - minX, maxY - minY)
      this.controls.target.set(cx, 1, cz)
      this.camera.position.set(cx + span * 0.9, span * 0.8, cz + span * 1.1)
    }
  }

  /** Wall as boxes: solid segments between openings, lintels above, sills below windows. */
  private buildWall(wall: Wall, wallMat: THREE.Material, glassMat: THREE.Material): THREE.Group {
    const group = new THREE.Group()
    group.name = wall.id
    const len = wallLength(wall)
    const t = wall.thickness
    const h = wall.height

    const addBox = (x0: number, x1: number, y0: number, y1: number, mat: THREE.Material) => {
      const w = x1 - x0
      const hh = y1 - y0
      if (w <= 0.001 || hh <= 0.001) return
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hh, t), mat)
      mesh.position.set(x0 + w / 2, y0 + hh / 2, 0)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
    }

    const openings = [...wall.openings]
      .sort((a, b) => a.offset - b.offset)
      .map((o) => ({
        ...o,
        start: Math.max(0, o.offset - o.width / 2),
        end: Math.min(len, o.offset + o.width / 2),
      }))
      .filter((o) => o.end > o.start)

    let cursor = 0
    for (const o of openings) {
      if (o.start < cursor) continue // overlapping opening: skip
      addBox(cursor, o.start, 0, h, wallMat) // solid segment before opening
      if (o.sill > 0) addBox(o.start, o.end, 0, o.sill, wallMat) // below window
      const top = o.sill + o.height
      if (top < h) addBox(o.start, o.end, top, h, wallMat) // lintel
      if (o.type === 'window') {
        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(o.end - o.start, o.height, 0.04),
          glassMat
        )
        glass.position.set((o.start + o.end) / 2, o.sill + o.height / 2, 0)
        group.add(glass)
      }
      cursor = o.end
    }
    addBox(cursor, len, 0, h, wallMat) // remaining solid segment

    // Place in world: rotate around Y, plan y -> world z.
    const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x)
    group.rotation.y = -angle
    group.position.set(wall.a.x, 0, wall.a.y)
    return group
  }

  async exportGLB(name: string): Promise<void> {
    const exporter = new GLTFExporter()
    const result = await exporter.parseAsync(this.buildingGroup, { binary: true })
    const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${name}.glb`
    a.click()
    URL.revokeObjectURL(a.href)
  }
}
