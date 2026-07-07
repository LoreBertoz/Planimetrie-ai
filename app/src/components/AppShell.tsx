import type { ReactNode } from 'react'
import { Leaf, LandPlot } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Props {
  sidebar: ReactNode
  children: ReactNode
  topbarActions?: ReactNode
}

/** App shell: top-bar + left input panel + large central viewport. */
export function AppShell({ sidebar, children, topbarActions }: Props) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
            <LandPlot className="size-4.5" aria-hidden />
          </div>
          <div className="text-[15px] font-semibold tracking-tight">
            Planimetrie<span className="text-terra">AI</span>
          </div>
        </div>
        <Badge
          variant="outline"
          className="hidden gap-1.5 border-salvia-200 bg-salvia-50 text-salvia-700 sm:inline-flex"
        >
          <Leaf className="size-3" aria-hidden />
          Materiali naturali · focus canapa
        </Badge>
        <div className="ml-auto flex items-center gap-2">{topbarActions}</div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[340px] shrink-0 flex-col gap-4 overflow-y-auto border-r bg-card p-4 max-md:w-[300px]">
          {sidebar}
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
