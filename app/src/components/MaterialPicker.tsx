import { useState } from 'react'
import { Leaf } from 'lucide-react'
import {
  CATEGORIA_LABEL,
  MATERIALS,
  getMaterial,
  type MaterialAssignment,
} from '@/materials/catalog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Surface = keyof MaterialAssignment

const SURFACE_LABEL: Record<Surface, string> = {
  esterno: 'Muri esterni',
  interno: 'Muri interni',
  pavimento: 'Pavimento',
}

interface Props {
  assignment: MaterialAssignment
  onChange: (assignment: MaterialAssignment) => void
}

/** Visual natural-material library; hemp entries are featured first. */
export function MaterialPicker({ assignment, onChange }: Props) {
  const [surface, setSurface] = useState<Surface>('esterno')
  const current = getMaterial(assignment[surface])

  // Hemp first — it's the product's signature.
  const ordered = [...MATERIALS].sort(
    (a, b) => Number(b.inEvidenza ?? false) - Number(a.inEvidenza ?? false),
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Leaf className="size-4 text-salvia-600" aria-hidden />
        Materiali naturali
      </div>

      <Tabs value={surface} onValueChange={(v) => setSurface(v as Surface)}>
        <TabsList className="w-full">
          {(Object.keys(SURFACE_LABEL) as Surface[]).map((s) => (
            <TabsTrigger key={s} value={s} className="flex-1 text-xs">
              {SURFACE_LABEL[s]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 gap-2">
        {ordered.map((m) => {
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
