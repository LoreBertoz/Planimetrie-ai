import { useEffect, useRef } from 'react'
import type { Plan } from '../types'
import { Viewer3D } from '@/engine/Viewer3D'
import type { MaterialAssignment } from '@/materials/catalog'
import { cn } from '@/lib/utils'

interface Props {
  plan: Plan | null
  assignment: MaterialAssignment
  /** Bump to force a rebuild after in-place edits (2D editor). */
  version?: number
  onViewer?: (viewer: Viewer3D | null) => void
  onTourChange?: (touring: boolean) => void
  className?: string
}

/** React wrapper around the Three.js engine: mounts, builds, cleans up. */
export function Viewer3DCanvas({
  plan,
  assignment,
  version = 0,
  onViewer,
  onTourChange,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer3D | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const viewer = new Viewer3D(containerRef.current)
    viewerRef.current = viewer
    onViewer?.(viewer)
    return () => {
      onViewer?.(null)
      viewer.dispose()
      viewerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (viewerRef.current && onTourChange) viewerRef.current.onTourChange = onTourChange
  }, [onTourChange])

  useEffect(() => {
    if (viewerRef.current && plan && plan.walls.length > 0) {
      viewerRef.current.build(plan, assignment)
    }
  }, [plan, assignment, version])

  return <div ref={containerRef} className={cn('h-full w-full overflow-hidden', className)} />
}
