import { Plus, X } from 'lucide-react'
import type { LotSpec, RoomSpec, RoomType } from '../types'
import { ROOM_META } from '../types'
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface Props {
  lot: LotSpec
  rooms: RoomSpec[]
  onLotChange: (lot: LotSpec) => void
  onRoomsChange: (rooms: RoomSpec[]) => void
}

let uid = 100

const ADJ_AUTO = '__auto__'

export function RoomForm({ lot, rooms, onLotChange, onRoomsChange }: Props) {
  const update = (id: string, patch: Partial<RoomSpec>) => {
    onRoomsChange(rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const addRoom = () => {
    onRoomsChange([
      ...rooms,
      {
        id: `u${uid++}`,
        type: 'bedroom',
        label: `Stanza ${rooms.length + 1}`,
        targetArea: ROOM_META.bedroom.defaultArea,
      },
    ])
  }

  const removeRoom = (id: string) => {
    onRoomsChange(
      rooms
        .filter((r) => r.id !== id)
        .map((r) => (r.adjacentTo === id ? { ...r, adjacentTo: undefined } : r)),
    )
  }

  const totalRooms = rooms.reduce((s, r) => s + r.targetArea, 0)
  const lotArea = lot.width * lot.depth

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Lotto</span>
        <Badge variant="secondary">{lotArea.toFixed(0)} m²</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lot-width" className="text-xs text-muted-foreground">
            Larghezza (m)
          </Label>
          <Input
            id="lot-width"
            type="number"
            min={4}
            max={60}
            step={0.5}
            value={lot.width}
            onChange={(e) => onLotChange({ ...lot, width: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lot-depth" className="text-xs text-muted-foreground">
            Profondità (m)
          </Label>
          <Input
            id="lot-depth"
            type="number"
            min={4}
            max={60}
            step={0.5}
            value={lot.depth}
            onChange={(e) => onLotChange({ ...lot, depth: Number(e.target.value) })}
          />
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Stanze</span>
        <Button variant="outline" size="sm" onClick={addRoom}>
          <Plus aria-hidden /> Aggiungi
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {rooms.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2.5">
            <div className="flex items-center gap-2">
              <Input
                aria-label="Nome stanza"
                className="h-8 flex-1 text-sm"
                value={r.label}
                onChange={(e) => update(r.id, { label: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Rimuovi ${r.label}`}
                onClick={() => removeRoom(r.id)}
              >
                <X aria-hidden />
              </Button>
            </div>
            <div className="grid grid-cols-[1fr_76px] gap-2">
              <Select
                value={r.type}
                onValueChange={(v) => update(r.id, { type: v as RoomType })}
              >
                <SelectTrigger size="sm" aria-label="Tipo stanza" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROOM_META) as RoomType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {ROOM_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Input
                  aria-label="Superficie target in metri quadri"
                  className="h-8 pr-7 text-sm"
                  type="number"
                  min={2}
                  max={100}
                  step={1}
                  value={r.targetArea}
                  onChange={(e) => update(r.id, { targetArea: Number(e.target.value) })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                  m²
                </span>
              </div>
            </div>
            <Select
              value={r.adjacentTo ?? ADJ_AUTO}
              onValueChange={(v) => update(r.id, { adjacentTo: v === ADJ_AUTO ? undefined : v })}
            >
              <SelectTrigger size="sm" aria-label="Adiacenza richiesta" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ADJ_AUTO}>Adiacenza: automatica</SelectItem>
                {rooms
                  .filter((o) => o.id !== r.id)
                  .map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      Accanto a {o.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <p
        className={cn(
          'text-xs',
          totalRooms > lotArea ? 'font-medium text-terra-600' : 'text-muted-foreground',
        )}
      >
        Stanze: {totalRooms.toFixed(0)} m² su {lotArea.toFixed(0)} m² di lotto
        {totalRooms > lotArea && ' — verranno riscalate per rientrare'}
      </p>
    </div>
  )
}
