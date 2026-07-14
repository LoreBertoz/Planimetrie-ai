import { useState } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import type { Wall, WallLayer } from '../types'
import { MATERIALS, getMaterial } from '@/materials/catalog'
import {
  LAYER_FUNCTION_LABEL,
  WALL_ASSEMBLIES,
  getAssembly,
  layersThickness,
  wallLayers,
} from '@/materials/wallAssemblies'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const FUNCTIONS = Object.keys(LAYER_FUNCTION_LABEL) as WallLayer['function'][]

interface Props {
  wall: Wall
  /** Called after the wall object has been mutated in place. */
  onChange: () => void
}

/** Selected-wall properties: real wall assembly presets with computed total
 *  thickness, custom stratigraphy editor, per-wall material override. */
export function WallPanel({ wall, onChange }: Props) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<WallLayer[]>([])

  const assembly = getAssembly(wall.assemblyId)
  const isCustom = wall.assemblyId === 'custom' && (wall.layers?.length ?? 0) > 0
  const selectValue = isCustom ? 'custom' : (assembly?.id ?? 'libero')
  const cm = (m: number) => `${Math.round(m * 100)} cm`

  const applyAssembly = (id: string) => {
    if (id === 'libero') {
      wall.assemblyId = undefined
      wall.layers = undefined
    } else if (id === 'custom') {
      openEditor()
      return
    } else {
      const a = getAssembly(id)
      if (!a) return
      wall.assemblyId = a.id
      wall.layers = undefined
      wall.thickness = a.thickness
    }
    onChange()
  }

  const openEditor = () => {
    const base = wallLayers(wall)
    setDraft(
      base
        ? base.map((l) => ({ ...l }))
        : [{ materialId: 'calce-rasata', thickness: wall.thickness, function: 'struttura' }],
    )
    setEditorOpen(true)
  }

  const saveLayers = () => {
    const cleaned = draft.filter((l) => l.thickness > 0.001)
    if (cleaned.length === 0) return
    wall.layers = cleaned
    wall.assemblyId = 'custom'
    wall.thickness = layersThickness(cleaned)
    setEditorOpen(false)
    onChange()
  }

  const setDraftLayer = (i: number, patch: Partial<WallLayer>) => {
    setDraft((d) => d.map((l, k) => (k === i ? { ...l, ...patch } : l)))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs whitespace-nowrap">Tipo di parete</Label>
        <Select value={selectValue} onValueChange={applyAssembly}>
          <SelectTrigger size="sm" className="max-w-64 text-xs" aria-label="Tipo di parete">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WALL_ASSEMBLIES.map((a) => (
              <SelectItem key={a.id} value={a.id} className="text-xs">
                {a.nome}
                <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
                  {cm(a.thickness)}
                </Badge>
              </SelectItem>
            ))}
            <SelectItem value="libero" className="text-xs">
              Spessore libero
            </SelectItem>
            {isCustom && (
              <SelectItem value="custom" className="text-xs">
                Stratigrafia personalizzata
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <Badge variant="outline" className="text-[11px]">
        totale {cm(wall.thickness)}
      </Badge>

      <Button variant="ghost" size="sm" onClick={openEditor}>
        <Layers aria-hidden /> Personalizza stratigrafia
      </Button>

      <div className="flex items-center gap-1.5">
        <Label className="text-xs whitespace-nowrap">Materiale muro</Label>
        <Select
          value={wall.materialId ?? 'default'}
          onValueChange={(v) => {
            wall.materialId = v === 'default' ? undefined : v
            onChange()
          }}
        >
          <SelectTrigger size="sm" className="max-w-48 text-xs" aria-label="Materiale del muro selezionato">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default" className="text-xs">
              Come da superficie
            </SelectItem>
            {MATERIALS.filter(
              (m) => !m.superfici || m.superfici.includes(wall.exterior ? 'exteriorWalls' : 'walls'),
            ).map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                {m.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectValue === 'libero' && (
        <div className="flex items-center gap-1.5">
          <Label htmlFor="wall-thickness" className="text-xs">
            Spessore (cm)
          </Label>
          <Input
            id="wall-thickness"
            type="number"
            min={4}
            max={80}
            className="h-8 w-18 text-xs"
            value={Math.round(wall.thickness * 100)}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v >= 4 && v <= 80) {
                wall.thickness = v / 100
                onChange()
              }
            }}
          />
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Stratigrafia della parete</DialogTitle>
            <DialogDescription>
              Strati dall’interno verso l’esterno. Lo spessore totale è calcolato automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            {draft.map((layer, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-lg border p-2">
                <span
                  className="size-6 shrink-0 rounded border"
                  style={{ backgroundColor: getMaterial(layer.materialId)?.pbr.color }}
                  aria-hidden
                />
                <Select
                  value={layer.materialId}
                  onValueChange={(v) => setDraftLayer(i, { materialId: v })}
                >
                  <SelectTrigger size="sm" className="flex-1 text-xs" aria-label={`Materiale strato ${i + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIALS.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={layer.function}
                  onValueChange={(v) => setDraftLayer(i, { function: v as WallLayer['function'] })}
                >
                  <SelectTrigger size="sm" className="w-32 text-xs" aria-label={`Funzione strato ${i + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNCTIONS.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">
                        {LAYER_FUNCTION_LABEL[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0.5}
                  max={50}
                  step={0.5}
                  className="h-8 w-16 text-xs"
                  aria-label={`Spessore strato ${i + 1} in centimetri`}
                  value={Math.round(layer.thickness * 200) / 2}
                  onChange={(e) => setDraftLayer(i, { thickness: Number(e.target.value) / 100 })}
                />
                <span className="text-[10px] text-muted-foreground">cm</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  aria-label={`Rimuovi strato ${i + 1}`}
                  onClick={() => setDraft((d) => d.filter((_, k) => k !== i))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDraft((d) => [
                  ...d,
                  { materialId: 'pannello-canapa', thickness: 0.06, function: 'isolante' },
                ])
              }
            >
              <Plus aria-hidden /> Aggiungi strato
            </Button>
          </div>
          <DialogFooter className="items-center">
            <Badge variant="secondary" className="mr-auto">
              Spessore totale: {cm(layersThickness(draft))}
            </Badge>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Annulla
            </Button>
            <Button onClick={saveLayers} disabled={draft.length === 0}>
              Applica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
