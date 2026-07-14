import { useState } from 'react'
import { Leaf } from 'lucide-react'
import {
  CATEGORIA_LABEL,
  getMaterial,
  materialsForSurface,
  type MaterialAssignment,
  type Surface,
} from '@/materials/catalog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export const SURFACE_LABEL: Record<Surface, string> = {
  flooring: 'Pavimento',
  walls: 'Muri interni',
  ceiling: 'Soffitto',
  doors: 'Porte',
  windows: 'Finestre',
  exteriorWalls: 'Muri esterni',
}

const SURFACES: Surface[] = ['flooring', 'walls', 'ceiling', 'doors', 'windows', 'exteriorWalls']

interface Props {
  assignment: MaterialAssignment
  onChange: (assignment: MaterialAssignment) => void
}

/** Visual natural-material library over the six independent surfaces;
 *  hemp entries are featured first. */
export function MaterialPicker({ assignment, onChange }: Props) {
  const [surface, setSurface] = useState<Surface>('flooring')
  const current = getMaterial(assignment[surface])
  const materials = materialsForSurface(surface)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Leaf className="size-4 text-salvia-600" aria-hidden />
        Materiali naturali
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="tablist">
        {SURFACES.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={surface === s}
            onClick={() => setSurface(s)}
            className={cn(
              'rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors',
              surface === s
                ? 'bg-card text-foreground shadow-soft'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {SURFACE_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {materials.map((m) => {
          const active = assignment[surface] === m.id
          return (
            <button
              key={m.id}
              onClick={() => onChange({ ...assignment, [surface]: m.id })}
              aria-label={`Applica ${m.nome} a ${SURFACE_LABEL[surface]}`}
              aria-pressed={active}
              className={cn(
                'group flex flex-col gap-1.5 rounded-lg border bg-card p-2 text-left transition-all hover:shadow-soft',
                active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-salvia-300',
              )}
            >
              <div
                className="relative h-10 w-full rounded-md border"
                style={{ backgroundColor: m.pbr.color }}
              >
                {m.inEvidenza && (
                  <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft">
                    <Leaf className="size-3" aria-hidden />
                  </span>
                )}
              </div>
              <div className="text-xs leading-tight font-medium">{m.nome}</div>
              <Badge
                variant="outline"
                className={cn(
                  'px-1.5 py-0 text-[10px]',
                  m.inEvidenza && 'border-salvia-200 bg-salvia-50 text-salvia-700',
                )}
              >
                {CATEGORIA_LABEL[m.categoria]}
              </Badge>
            </button>
          )
        })}
      </div>

      {current && (
        <p className="rounded-lg bg-salvia-50 p-2.5 text-xs leading-relaxed text-salvia-800">
          <span className="font-semibold">{current.nome}.</span> {current.descrizione}
        </p>
      )}
    </div>
  )
}
