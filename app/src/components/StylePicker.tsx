import { Leaf, Palette } from 'lucide-react'
import { getMaterial, type MaterialAssignment, type Surface } from '@/materials/catalog'
import { STYLES } from '@/materials/styles'
import { cn } from '@/lib/utils'

interface Props {
  assignment: MaterialAssignment
  onApply: (assignment: MaterialAssignment) => void
}

const PREVIEW_SURFACES: Surface[] = ['exteriorWalls', 'walls', 'flooring', 'ceiling', 'doors', 'windows']

function sameAssignment(a: MaterialAssignment, b: MaterialAssignment): boolean {
  return PREVIEW_SURFACES.every((s) => a[s] === b[s])
}

/** Style gallery: one click applies a coherent palette to all six surfaces. */
export function StylePicker({ assignment, onApply }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Palette className="size-4 text-terra" aria-hidden />
        Stili completi
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Un click applica tutte e sei le superfici insieme.
      </p>
      <div className="flex flex-col gap-2">
        {STYLES.map((style) => {
          const active = sameAssignment(style.assignment, assignment)
          return (
            <button
              key={style.id}
              onClick={() => onApply({ ...style.assignment })}
              aria-label={`Applica stile ${style.nome}`}
              aria-pressed={active}
              className={cn(
                'group flex flex-col gap-1.5 rounded-lg border bg-card p-2.5 text-left transition-all hover:shadow-soft',
                active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-salvia-300',
              )}
            >
              <div className="flex items-center gap-2">
                <div className="flex overflow-hidden rounded-md border">
                  {PREVIEW_SURFACES.map((s) => (
                    <span
                      key={s}
                      className="h-6 w-5"
                      style={{ backgroundColor: getMaterial(style.assignment[s])?.pbr.color }}
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold">{style.nome}</span>
                {style.inEvidenza && (
                  <span className="ml-auto flex size-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Leaf className="size-2.5" aria-hidden />
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">{style.descrizione}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
