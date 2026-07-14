import { useState } from 'react'
import { Armchair, Sparkles } from 'lucide-react'
import type { PlacedRoom } from '../types'
import {
  FURNITURE,
  FURNITURE_CATEGORIA_LABEL,
  ROOM_FURNISH_SETS,
  type FurnitureCategory,
} from '@/materials/furnitureCatalog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  rooms: PlacedRoom[]
  onPlace: (catalogId: string) => void
  onFurnishRoom: (room: PlacedRoom) => void
}

const CATEGORIES = Object.keys(FURNITURE_CATEGORIA_LABEL) as FurnitureCategory[]

/** Editor toolbar block: two-level furniture menu (category → piece) and the
 *  one-click "Arreda stanza" action (Fase 10). */
export function FurnitureMenu({ rooms, onPlace, onFurnishRoom }: Props) {
  const [roomId, setRoomId] = useState<string>('')
  const room = rooms.find((r) => r.id === roomId)
  const canFurnish = room && (ROOM_FURNISH_SETS[room.type]?.length ?? 0) > 0

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select value="" onValueChange={onPlace}>
        <SelectTrigger size="sm" className="text-xs" aria-label="Aggiungi arredo">
          <Armchair className="size-3.5" aria-hidden />
          <SelectValue placeholder="Arredi" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((cat) => (
            <SelectGroup key={cat}>
              <SelectLabel className="text-[11px]">{FURNITURE_CATEGORIA_LABEL[cat]}</SelectLabel>
              {FURNITURE.filter((f) => f.categoria === cat).map((f) => (
                <SelectItem key={f.id} value={f.id} className="text-xs">
                  {f.nome}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {rooms.length > 0 && (
        <>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger size="sm" className="max-w-40 text-xs" aria-label="Stanza da arredare">
              <SelectValue placeholder="Stanza…" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canFurnish}
            onClick={() => room && onFurnishRoom(room)}
          >
            <Sparkles aria-hidden /> Arreda stanza
          </Button>
        </>
      )}
    </div>
  )
}
