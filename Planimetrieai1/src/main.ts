import './style.css'
import { Editor2D } from './editor2d'
import type { Tool } from './editor2d'
import { generatePlan } from './generator'
import type { RoomSpec } from './generator'
import {
  deserializePlan,
  emptyPlan,
  loadFromLocalStorage,
  saveToLocalStorage,
  serializePlan,
} from './model'
import { Viewer3D } from './viewer3d'

const canvas = document.getElementById('plan-canvas') as HTMLCanvasElement
const viewer3dEl = document.getElementById('view3d') as HTMLElement
const view2dEl = document.getElementById('view2d') as HTMLElement

const plan = loadFromLocalStorage() ?? emptyPlan()
const editor = new Editor2D(canvas, plan)
const viewer = new Viewer3D(viewer3dEl)

editor.onChange = () => {
  saveToLocalStorage(editor.plan)
}

// --- Tabs 2D / 3D ---
const tab2d = document.getElementById('tab-2d') as HTMLButtonElement
const tab3d = document.getElementById('tab-3d') as HTMLButtonElement

function show2D(): void {
  view2dEl.style.display = 'block'
  viewer3dEl.style.display = 'none'
  tab2d.classList.add('active')
  tab3d.classList.remove('active')
  editor.resize()
}

function show3D(): void {
  view2dEl.style.display = 'none'
  viewer3dEl.style.display = 'block'
  tab3d.classList.add('active')
  tab2d.classList.remove('active')
  viewer.build(editor.plan)
}

tab2d.addEventListener('click', show2D)
tab3d.addEventListener('click', show3D)

// --- Tools ---
const toolButtons = document.querySelectorAll<HTMLButtonElement>('[data-tool]')
toolButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    editor.tool = btn.dataset.tool as Tool
    toolButtons.forEach((b) => b.classList.toggle('active', b === btn))
    editor.render()
  })
})

// --- Generator dialog ---
const genDialog = document.getElementById('gen-dialog') as HTMLDialogElement
const genOpen = document.getElementById('btn-generate') as HTMLButtonElement
const genRun = document.getElementById('gen-run') as HTMLButtonElement
const genVariant = document.getElementById('gen-variant') as HTMLButtonElement
let genSeed = 1

genOpen.addEventListener('click', () => genDialog.showModal())

function readSpecAndGenerate(seed: number): void {
  const width = parseFloat((document.getElementById('gen-width') as HTMLInputElement).value)
  const depth = parseFloat((document.getElementById('gen-depth') as HTMLInputElement).value)
  const roomsRaw = (document.getElementById('gen-rooms') as HTMLTextAreaElement).value
  const rooms: RoomSpec[] = roomsRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, area] = line.split(':').map((s) => s.trim())
      return { name, area: parseFloat(area) || 10 }
    })
  if (!Number.isFinite(width) || !Number.isFinite(depth) || rooms.length === 0) {
    alert('Inserisci larghezza, profondità e almeno una stanza (nome: m²)')
    return
  }
  const generated = generatePlan({ width, depth, rooms }, seed)
  editor.setPlan(generated)
  saveToLocalStorage(editor.plan)
  genDialog.close()
  show2D()
}

genRun.addEventListener('click', (e) => {
  e.preventDefault()
  genSeed = 1
  readSpecAndGenerate(genSeed)
})
genVariant.addEventListener('click', (e) => {
  e.preventDefault()
  genSeed += 1
  readSpecAndGenerate(genSeed)
})

// --- File actions ---
document.getElementById('btn-new')!.addEventListener('click', () => {
  if (confirm('Nuova planimetria? Quella corrente sarà cancellata.')) {
    editor.setPlan(emptyPlan())
    saveToLocalStorage(editor.plan)
  }
})

document.getElementById('btn-save')!.addEventListener('click', () => {
  const blob = new Blob([serializePlan(editor.plan)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${editor.plan.name}.json`
  a.click()
  URL.revokeObjectURL(a.href)
})

const fileInput = document.getElementById('file-input') as HTMLInputElement
document.getElementById('btn-load')!.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]
  if (!file) return
  try {
    const loaded = deserializePlan(await file.text())
    editor.setPlan(loaded)
    saveToLocalStorage(editor.plan)
  } catch (err) {
    alert(`File non valido: ${err}`)
  }
  fileInput.value = ''
})

document.getElementById('btn-export-glb')!.addEventListener('click', () => {
  viewer.build(editor.plan)
  viewer.exportGLB(editor.plan.name)
})

document.getElementById('btn-fit')!.addEventListener('click', () => {
  editor.fitView()
  editor.render()
})

show2D()
editor.render()
