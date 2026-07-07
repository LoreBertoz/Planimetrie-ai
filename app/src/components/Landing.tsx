import { ArrowRight, Box, Footprints, Leaf, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  onStart: () => void
}

const FEATURES = [
  {
    icon: <Wand2 className="size-5" aria-hidden />,
    title: 'Dal brief alla planimetria',
    text: 'Descrivi la casa in una frase: il motore esplora centinaia di layout e propone le varianti migliori.',
  },
  {
    icon: <Box className="size-5" aria-hidden />,
    title: '3D immediato',
    text: 'Muri, porte e finestre estrusi in tempo reale. Esporta .glb e rifinisci nei tuoi strumenti CAD.',
  },
  {
    icon: <Leaf className="size-5" aria-hidden />,
    title: 'Materiali naturali, focus canapa',
    text: 'Calce-canapa, legno, sughero e terra cruda applicati al modello con un clic: il pitch della casa sana.',
  },
  {
    icon: <Footprints className="size-5" aria-hidden />,
    title: 'Tour in prima persona',
    text: 'Fai camminare il cliente dentro la casa prima ancora del progetto esecutivo.',
  },
]

/** Pitch-oriented landing shown on first visit. */
export function Landing({ onStart }: Props) {
  return (
    <div className="flex min-h-dvh flex-col items-center overflow-y-auto bg-background px-6 py-14">
      <div className="flex max-w-3xl flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-panel">
            <Leaf className="size-6" aria-hidden />
          </div>
          <span className="text-2xl font-semibold tracking-tight">
            Planimetrie<span className="text-terra">AI</span>
          </span>
        </div>

        <Badge
          variant="outline"
          className="gap-1.5 border-salvia-200 bg-salvia-50 px-3 py-1 text-salvia-700"
        >
          <Sparkles className="size-3.5" aria-hidden />
          Per architetti, geometri e progettisti
        </Badge>

        <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance md:text-5xl">
          L'idea di casa, presentata al cliente{' '}
          <span className="text-primary">in un minuto</span>
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
          Planimetrie 2D, modello 3D navigabile e tour della casa con materiali naturali — a
          partire da una descrizione o da una foto. Presentativo, veloce, bello da vedere.
        </p>

        <Button size="lg" className="px-8 text-base" onClick={onStart}>
          Inizia a progettare <ArrowRight aria-hidden />
        </Button>
        <p className="text-xs text-muted-foreground">
          Nessuna installazione. I tuoi export (.glb, DXF, JSON) restano tuoi.
        </p>
      </div>

      <div className="mt-14 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Card key={f.title} className="shadow-soft">
            <CardContent className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-salvia-100 text-salvia-700">
                {f.icon}
              </div>
              <div>
                <h2 className="font-semibold tracking-tight">{f.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        PlanimetrieAI è uno strumento di presentazione commerciale, non di progettazione esecutiva.
      </p>
    </div>
  )
}
