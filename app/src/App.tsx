import { useCallback, useRef, useState } from 'react'
import {
  Box,
  Download,
  DoorOpen,
  Footprints,
  LayoutGrid,
  MousePointer2,
  Pencil,
  RectangleHorizontal,
  RefreshCw,
  Sparkles,
  Tag,
  Video,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { FloorPlan, LotSpec, Plan, Point, RoomSpec } from './types'
import { defaultRooms, generateVariants } from './lib/generator'
import { parsePromptHeuristic, parsePromptOllama } from './lib/prompt'
import { exportJson, exportPng, exportSvg } from './lib/export'
import { exportDxf } from './lib/dxf'
import { floorplanToWalls } from './lib/floorplanToWalls'
import { promptToPlanCloud, type CloudPlanRequest, type ProjectData } from '@/lib/api'
import type { Viewer3D } from '@/engine/Viewer3D'
import type { Tool } from '@/engine/Editor2D'
import { DEFAULT_ASSIGNMENT, type MaterialAssignment } from '@/materials/catalog'
import { PlanSvg } from '@/components/PlanSvg'
import { RoomForm } from '@/components/RoomForm'
import { AppShell } from '@/components/AppShell'
import { Viewer3DCanvas } from '@/components/Viewer3DCanvas'
import { Editor2DCanvas } from '@/components/Editor2DCanvas'
import { MaterialPicker } from '@/components/MaterialPicker'
import { FacadePhotoCard } from '@/components/FacadePhotoCard'
import { AccountMenu } from '@/components/AccountMenu'
import { Landing } from '@/components/Landing'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const VARIANTS = 4

const EDITOR_TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Seleziona', icon: <MousePointer2 aria-hidden /> },
  { id: 'wall', label: 'Muro', icon: <Pencil aria-hidden /> },
  { id: 'door', label: 'Porta', icon: <DoorOpen aria-hidden /> },
  { id: 'window', label: 'Finestra', icon: <RectangleHorizontal aria-hidden /> },
  { id: 'label', label: 'Etichetta', icon: <Tag aria-hidden /> },
]

export default function App() {
  const [entered, setEntered] = useState(
    () => localStorage.getItem('planimetrieai.visited') === '1',
  )
  const [lot, setLot] = useState<LotSpec>({ width: 12, depth: 9 })
  const [rooms, setRooms] = useState<RoomSpec[]>(defaultRooms())
  const [prompt, setPrompt] = useState('')
  const [parsing, setParsing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [plans, setPlans] = useState<FloorPlan[]>([])
  const [selected, setSelected] = useState(0)
  const [generation, setGeneration] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)

  // Unified wall plan shared by editor and 3D. The editor mutates it in
  // place; wallsVersion bumps to trigger 3D rebuilds.
  const [wallPlan, setWallPlan] = useState<Plan | null>(null)
  const [wallsVersion, setWallsVersion] = useState(0)
  const [assignment, setAssignment] = useState<MaterialAssignment>(DEFAULT_ASSIGNMENT)

  const [viewer, setViewer] = useState<Viewer3D | null>(null)
  const [touring, setTouring] = useState(false)
  const [editorTool, setEditorTool] = useState<Tool>('select')
  const [labelAt, setLabelAt] = useState<Point | null>(null)
  const [labelName, setLabelName] = useState('')

  const selectVariant = (plan: FloorPlan, index: number) => {
    setSelected(index)
    setWallPlan(floorplanToWalls(plan))
    setWallsVersion((v) => v + 1)
  }

  const onGenerate = () => {
    if (rooms.length === 0) return
    const gen = generation + 1
    setGeneration(gen)
    setGenerating(true)
    // let the skeletons paint before the synchronous search runs
    setTimeout(() => {
      const baseSeed = 1000003 * gen
      const variants = generateVariants({ lot, rooms }, VARIANTS, baseSeed)
      setPlans(variants)
      setSelected(0)
      if (variants.length > 0) {
        setWallPlan(floorplanToWalls(variants[0]))
        setWallsVersion((v) => v + 1)
      }
      setGenerating(false)
      toast.success(`${VARIANTS} varianti generate`, {
        description: 'Ordinate per proporzioni, adiacenze e luce naturale.',
      })
    }, 50)
  }

  const applyCloudPlan = (cloudPlan: CloudPlanRequest) => {
    setLot(cloudPlan.lot)
    setRooms(cloudPlan.rooms)
  }

  const onParsePrompt = async () => {
    if (!prompt.trim()) return
    setParsing(true)
    try {
      // cloud AI first, then local LLM (Ollama), then built-in parser
      const viaCloud = await promptToPlanCloud(prompt).catch(() => null)
      if (viaCloud && viaCloud.rooms.length) {
        applyCloudPlan(viaCloud)
        toast.success('Brief interpretato dall’AI cloud', { description: viaCloud.note })
        return
      }
      const viaLlm = await parsePromptOllama(prompt)
      const parsed = viaLlm ?? parsePromptHeuristic(prompt)
      if (parsed.length) {
        setRooms(parsed)
        toast.success('Stanze compilate dalla descrizione')
      } else {
        toast.error('Non ho riconosciuto stanze nella descrizione', {
          description: 'Prova ad esempio: "3 camere, 2 bagni, cucina con zona pranzo".',
        })
      }
    } finally {
      setParsing(false)
    }
  }

  const getProjectData = (): ProjectData => ({
    lot,
    rooms,
    floorPlan: plans[selected] ?? null,
    wallPlan,
    assignment,
  })

  const onProjectLoaded = (_name: string, data: ProjectData) => {
    setLot(data.lot)
    setRooms(data.rooms)
    const fp = (data.floorPlan ?? null) as FloorPlan | null
    if (fp) {
      setPlans([fp])
      setSelected(0)
      setWallPlan((data.wallPlan as Plan | undefined) ?? floorplanToWalls(fp))
    } else {
      setPlans([])
      setWallPlan((data.wallPlan as Plan | undefined) ?? null)
    }
    if (data.assignment) setAssignment(data.assignment as MaterialAssignment)
    setWallsVersion((v) => v + 1)
  }

  const doExport = (kind: 'SVG' | 'PNG' | 'DXF' | 'JSON') => {
    const plan = plans[selected]
    if (!plan) return
    if (kind === 'SVG' && svgRef.current) exportSvg(svgRef.current, 'planimetria')
    if (kind === 'PNG' && svgRef.current) exportPng(svgRef.current, 'planimetria')
    if (kind === 'DXF') exportDxf(plan, 'planimetria')
    if (kind === 'JSON') exportJson(plan, 'planimetria')
    toast.success(`Export ${kind} avviato`)
  }

  const onWallsEdited = useCallback(() => setWallsVersion((v) => v + 1), [])
  const onRequestLabel = useCallback((at: Point) => {
    setLabelName('')
    setLabelAt(at)
  }, [])

  const editorRef = useRef<import('@/engine/Editor2D').Editor2D | null>(null)

  const confirmLabel = () => {
    if (labelAt && labelName.trim() && editorRef.current) {
      editorRef.current.addLabel(labelAt, labelName.trim())
    }
    setLabelAt(null)
  }

  const plan = plans[selected]
  const hasModel = wallPlan !== null && wallPlan.walls.length > 0

  const sidebar = (
    <>
      <Card className="shadow-soft">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-terra" aria-hidden />
            Descrivi la casa
          </div>
          <Textarea
            aria-label="Descrizione della casa"
            placeholder={'Es. "3 camere, 2 bagni, cucina con zona pranzo"'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={onParsePrompt}
            disabled={parsing || !prompt.trim()}
          >
            <Wand2 aria-hidden />
            {parsing ? 'Interpretazione…' : 'Compila stanze dalla descrizione'}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Con il server attivo il brief passa dall'AI cloud; altrimenti parser locale.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent>
          <FacadePhotoCard onResult={applyCloudPlan} />
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent>
          <RoomForm lot={lot} rooms={rooms} onLotChange={setLot} onRoomsChange={setRooms} />
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full"
        onClick={onGenerate}
        disabled={rooms.length === 0 || generating}
      >
        {plans.length > 0 ? <RefreshCw aria-hidden /> : <Sparkles aria-hidden />}
        {generating ? 'Generazione…' : plans.length ? 'Rigenera proposte' : 'Genera proposte'}
      </Button>

      <Card className="shadow-soft">
        <CardContent>
          <MaterialPicker assignment={assignment} onChange={setAssignment} />
        </CardContent>
      </Card>
    </>
  )

  if (!entered) {
    return (
      <Landing
        onStart={() => {
          localStorage.setItem('planimetrieai.visited', '1')
          setEntered(true)
        }}
      />
    )
  }

  return (
    <AppShell
      sidebar={sidebar}
      topbarActions={
        <AccountMenu getProjectData={getProjectData} onProjectLoaded={onProjectLoaded} />
      }
    >
      <Tabs defaultValue="2d" className="h-full gap-4">
        <div className="flex items-center justify-center">
          <TabsList id="view-tabs">
            <TabsTrigger value="2d">
              <LayoutGrid aria-hidden /> 2D
            </TabsTrigger>
            <TabsTrigger value="editor">
              <Pencil aria-hidden /> Editor
            </TabsTrigger>
            <TabsTrigger value="3d">
              <Box aria-hidden /> 3D
            </TabsTrigger>
            <TabsTrigger value="tour">
              <Footprints aria-hidden /> Tour
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ------------------------------- 2D ------------------------------- */}
        <TabsContent value="2d" className="min-h-0 flex-1">
          {generating ? (
            <GeneratingSkeleton />
          ) : plans.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex h-full flex-col gap-4">
              <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
                {plans.map((p, i) => (
                  <button
                    key={p.seed}
                    onClick={() => selectVariant(p, i)}
                    aria-label={`Variante ${i + 1}, punteggio ${p.score.toFixed(1)}`}
                    className={cn(
                      'group relative overflow-hidden rounded-lg border bg-card p-1.5 text-left shadow-soft transition-all hover:shadow-panel',
                      i === selected
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'hover:border-salvia-300',
                    )}
                  >
                    <div className="aspect-[4/3]">
                      <PlanSvg plan={p} showLabels={false} showDimensions={false} />
                    </div>
                    <div className="flex items-center justify-between px-1 pt-1 text-xs">
                      <span className="font-medium">Variante {i + 1}</span>
                      <span className="text-muted-foreground">score {p.score.toFixed(1)}</span>
                    </div>
                  </button>
                ))}
              </div>

              {plan && (
                <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0 shadow-panel">
                  <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
                    <span className="text-sm font-semibold">Variante {selected + 1}</span>
                    <Badge variant="secondary">{plan.rooms.length} stanze</Badge>
                    <Badge variant="secondary">{(lot.width * lot.depth).toFixed(0)} m²</Badge>
                    <div className="ml-auto flex items-center gap-1.5">
                      {(['SVG', 'PNG', 'DXF', 'JSON'] as const).map((kind) => (
                        <Button
                          key={kind}
                          variant="outline"
                          size="sm"
                          onClick={() => doExport(kind)}
                        >
                          <Download aria-hidden /> {kind}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 bg-white p-4">
                    <PlanSvg ref={svgRef} plan={plan} />
                  </div>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ----------------------------- Editor ----------------------------- */}
        <TabsContent value="editor" className="min-h-0 flex-1">
          {!hasModel ? (
            <NeedPlanState label="L'editor lavora sulla variante selezionata: genera prima una proposta." />
          ) : (
            <Card className="flex h-full flex-col gap-0 overflow-hidden py-0 shadow-panel">
              <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
                <div className="flex items-center gap-1">
                  {EDITOR_TOOLS.map((t) => (
                    <Button
                      key={t.id}
                      variant={editorTool === t.id ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setEditorTool(t.id)}
                      aria-pressed={editorTool === t.id}
                    >
                      {t.icon} {t.label}
                    </Button>
                  ))}
                </div>
                <p className="ml-auto hidden text-xs text-muted-foreground lg:block">
                  Rotella: zoom · Shift+trascina: sposta · Canc: elimina selezione · Esc: annulla
                </p>
              </div>
              <div className="min-h-0 flex-1">
                <Editor2DCanvas
                  plan={wallPlan}
                  tool={editorTool}
                  onChange={onWallsEdited}
                  onRequestLabel={onRequestLabel}
                  onEditor={(e) => {
                    editorRef.current = e
                  }}
                />
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ------------------------------- 3D ------------------------------- */}
        <TabsContent value="3d" className="min-h-0 flex-1">
          {!hasModel ? (
            <NeedPlanState label="Genera una proposta per vedere il modello 3D navigabile." />
          ) : (
            <Card className="flex h-full flex-col gap-0 overflow-hidden py-0 shadow-panel">
              <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
                <span className="text-sm font-semibold">Modello 3D</span>
                <p className="hidden text-xs text-muted-foreground md:block">
                  Trascina per orbitare · rotella per zoom
                </p>
                <div className="ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      viewer?.exportGLB('planimetria')
                      toast.success('Export .glb avviato')
                    }}
                    disabled={!viewer}
                  >
                    <Download aria-hidden /> Esporta .glb
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <Viewer3DCanvas
                  plan={wallPlan}
                  assignment={assignment}
                  version={wallsVersion}
                  onViewer={setViewer}
                />
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ------------------------------ Tour ------------------------------ */}
        <TabsContent value="tour" className="min-h-0 flex-1">
          {!hasModel ? (
            <NeedPlanState label="Genera una proposta per camminare dentro la casa." />
          ) : (
            <Card className="relative flex h-full flex-col gap-0 overflow-hidden py-0 shadow-panel">
              <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
                <span className="text-sm font-semibold">Tour della casa</span>
                <Badge className="bg-terra text-terra-foreground">prima persona</Badge>
                <div className="ml-auto">
                  <Button variant="outline" size="sm" disabled>
                    <Video aria-hidden /> Esporta video tour — prossimamente
                  </Button>
                </div>
              </div>
              <div className="relative min-h-0 flex-1">
                <Viewer3DCanvas
                  plan={wallPlan}
                  assignment={assignment}
                  version={wallsVersion}
                  onViewer={setViewer}
                  onTourChange={setTouring}
                />
                {!touring && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/20 backdrop-blur-[2px]">
                    <Card className="max-w-sm shadow-panel">
                      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-salvia-100 text-salvia-700">
                          <Footprints className="size-6" aria-hidden />
                        </div>
                        <h2 className="font-semibold tracking-tight">Cammina dentro la casa</h2>
                        <p className="text-sm text-muted-foreground">
                          <kbd className="rounded border bg-muted px-1">W</kbd>{' '}
                          <kbd className="rounded border bg-muted px-1">A</kbd>{' '}
                          <kbd className="rounded border bg-muted px-1">S</kbd>{' '}
                          <kbd className="rounded border bg-muted px-1">D</kbd> per muoverti, mouse
                          per guardare, <kbd className="rounded border bg-muted px-1">Esc</kbd> per
                          uscire.
                        </p>
                        <Button onClick={() => viewer?.startTour()} disabled={!viewer}>
                          <Footprints aria-hidden /> Entra nel tour
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
                {touring && (
                  <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground/70 px-3 py-1 text-xs text-background">
                    WASD muoviti · mouse guarda · Esc esci
                  </div>
                )}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Label dialog for the 2D editor */}
      <Dialog open={labelAt !== null} onOpenChange={(open) => !open && setLabelAt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nome etichetta</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="label-name">Testo da mostrare sulla planimetria</Label>
            <Input
              id="label-name"
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              placeholder="Es. Zona pranzo"
              onKeyDown={(e) => e.key === 'Enter' && confirmLabel()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelAt(null)}>
              Annulla
            </Button>
            <Button onClick={confirmLabel} disabled={!labelName.trim()}>
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <Card className="max-w-md shadow-soft">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-salvia-100 text-salvia-700">
            <LayoutGrid className="size-7" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Progetta la prima proposta</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Imposta lotto e stanze nel pannello a sinistra, poi premi{' '}
            <span className="font-medium text-foreground">Genera proposte</span>. Il motore esplora
            centinaia di layout e ti restituisce le {VARIANTS} migliori varianti.
          </p>
          <Separator className="my-1" />
          <p className="text-xs text-muted-foreground">
            Punteggio basato su proporzioni delle stanze, adiacenze e luce naturale.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function NeedPlanState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <Card className="max-w-md shadow-soft">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-salvia-100 text-salvia-700">
            <Sparkles className="size-7" aria-hidden />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function GeneratingSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: VARIANTS }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
        ))}
      </div>
      <Skeleton className="min-h-0 flex-1 rounded-xl" />
    </div>
  )
}
