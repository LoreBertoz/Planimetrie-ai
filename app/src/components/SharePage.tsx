import { useEffect, useState } from 'react'
import { Box, Footprints, LayoutGrid, Leaf } from 'lucide-react'
import type { FloorPlan, Plan } from '../types'
import { DEFAULT_ROOF } from '../types'
import { loadSharedProject, type SharedProject } from '@/lib/api'
import { floorplanToWalls } from '@/lib/floorplanToWalls'
import { migrateAssignment, type MaterialAssignment } from '@/materials/catalog'
import type { Viewer3D } from '@/engine/Viewer3D'
import { PlanSvg } from '@/components/PlanSvg'
import { Viewer3DCanvas } from '@/components/Viewer3DCanvas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Props {
  shareToken: string
}

/** Public read-only view of a shared project (Fase 11): the client opens the
 *  link without an account and sees 2D, 3D and the walk-through. No editing. */
export function SharePage({ shareToken }: Props) {
  const [shared, setShared] = useState<SharedProject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<Viewer3D | null>(null)
  const [touring, setTouring] = useState(false)

  useEffect(() => {
    loadSharedProject(shareToken)
      .then(setShared)
      .catch((err) => setError(err instanceof Error ? err.message : 'Link non valido'))
  }, [shareToken])

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background p-6">
        <Card className="max-w-md shadow-panel">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-salvia-100 text-salvia-700">
              <Leaf className="size-6" aria-hidden />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Link non disponibile</h1>
            <p className="text-sm text-muted-foreground">
              {error}. Chiedi al tuo progettista un nuovo link di condivisione.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!shared) {
    return (
      <div className="flex h-dvh flex-col gap-4 bg-background p-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="min-h-0 flex-1 rounded-xl" />
      </div>
    )
  }

  const floorPlan = (shared.data.floorPlan ?? null) as FloorPlan | null
  const wallPlan: Plan | null =
    (shared.data.wallPlan as Plan | undefined) ?? (floorPlan ? floorplanToWalls(floorPlan) : null)
  const assignment: MaterialAssignment = migrateAssignment(shared.data.assignment)
  const has3d = wallPlan !== null && wallPlan.walls.length > 0

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-5 py-3">
        {shared.studioLogo ? (
          <img src={shared.studioLogo} alt="" className="h-9 w-auto rounded" />
        ) : (
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Leaf className="size-5" aria-hidden />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight">{shared.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {shared.studioName || 'Proposta di progetto'} · visualizzazione condivisa
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          sola lettura
        </Badge>
      </header>

      <main className="min-h-0 flex-1 p-4">
        <Tabs defaultValue={has3d ? '3d' : '2d'} className="h-full gap-3">
          <div className="flex items-center justify-center">
            <TabsList>
              <TabsTrigger value="2d" disabled={!floorPlan}>
                <LayoutGrid aria-hidden /> Planimetria
              </TabsTrigger>
              <TabsTrigger value="3d" disabled={!has3d}>
                <Box aria-hidden /> 3D
              </TabsTrigger>
              <TabsTrigger value="tour" disabled={!has3d}>
                <Footprints aria-hidden /> Tour
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="2d" className="min-h-0 flex-1">
            {floorPlan && (
              <Card className="h-full overflow-hidden py-0 shadow-panel">
                <div className="h-full bg-white p-4">
                  <PlanSvg plan={floorPlan} />
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="3d" className="min-h-0 flex-1">
            {has3d && (
              <Card className="h-full overflow-hidden py-0 shadow-panel">
                <Viewer3DCanvas plan={wallPlan} assignment={assignment} roof={DEFAULT_ROOF} />
              </Card>
            )}
          </TabsContent>

          <TabsContent value="tour" className="min-h-0 flex-1">
            {has3d && (
              <Card className="relative h-full overflow-hidden py-0 shadow-panel">
                <Viewer3DCanvas
                  plan={wallPlan}
                  assignment={assignment}
                  roof={DEFAULT_ROOF}
                  onViewer={setViewer}
                  onTourChange={setTouring}
                />
                {!touring && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/20 backdrop-blur-[2px]">
                    <Card className="max-w-sm shadow-panel">
                      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
                        <Footprints className="size-6 text-salvia-700" aria-hidden />
                        <p className="text-sm text-muted-foreground">
                          <kbd className="rounded border bg-muted px-1">W</kbd>{' '}
                          <kbd className="rounded border bg-muted px-1">A</kbd>{' '}
                          <kbd className="rounded border bg-muted px-1">S</kbd>{' '}
                          <kbd className="rounded border bg-muted px-1">D</kbd> per muoverti, mouse per
                          guardare, <kbd className="rounded border bg-muted px-1">Esc</kbd> per uscire.
                        </p>
                        <Button onClick={() => viewer?.startTour()} disabled={!viewer}>
                          <Footprints aria-hidden /> Entra nel tour
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
