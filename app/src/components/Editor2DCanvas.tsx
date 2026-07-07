import { useEffect, useRef } from 'react'
import type { Plan, Point } from '../types'
import { Editor2D, type Tool } from '@/engine/Editor2D'

interface Props {
  plan: Plan
  tool: Tool
  onChange: () => void
  onRequestLabel: (at: Point) => void
  onEditor?: (editor: Editor2D | null) => void
}

/** React wrapper around the canvas 2D editor. The editor mutates the plan
 *  object in place; the host bumps a version counter on change. */
export function Editor2DCanvas({ plan, tool, onChange, onRequestLabel, onEditor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const editorRef = useRef<Editor2D | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const editor = new Editor2D(canvasRef.current, plan)
    editorRef.current = editor
    onEditor?.(editor)
    return () => {
      onEditor?.(null)
      editor.destroy()
      editorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    editorRef.current?.setTool(tool)
  }, [tool])

  useEffect(() => {
    const editor = editorRef.current
    if (editor && editor.plan !== plan) editor.setPlan(plan)
  }, [plan])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.onChange = onChange
    editor.onRequestLabel = onRequestLabel
  }, [onChange, onRequestLabel])

  return <canvas ref={canvasRef} className="h-full w-full cursor-crosshair" />
}
