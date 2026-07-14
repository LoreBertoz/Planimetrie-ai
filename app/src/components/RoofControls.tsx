import { Eye, EyeOff } from 'lucide-react'
import type { RoofOptions, RoofType } from '../types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ROOF_LABEL: Record<RoofType, string> = {
  flat: 'Piano con parapetto',
  gable: 'A capanna',
  hip: 'A padiglione',
}

interface Props {
  roof: RoofOptions
  onChange: (roof: RoofOptions) => void
}

/** Roof type + slope + show/hide (Fase 8). */
export function RoofControls({ roof, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label className="text-xs">Tetto</Label>
      <Select
        value={roof.type}
        onValueChange={(v) => onChange({ ...roof, type: v as RoofType })}
      >
        <SelectTrigger size="sm" className="text-xs" aria-label="Tipo di tetto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(ROOF_LABEL) as RoofType[]).map((t) => (
            <SelectItem key={t} value={t} className="text-xs">
              {ROOF_LABEL[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {roof.type !== 'flat' && (
        <div className="flex w-36 items-center gap-2">
          <Slider
            aria-label="Pendenza del tetto"
            min={10}
            max={60}
            step={5}
            value={[Math.round(roof.slope * 100)]}
            onValueChange={([v]) => onChange({ ...roof, slope: v / 100 })}
          />
          <span className="w-8 text-xs text-muted-foreground">{Math.round(roof.slope * 100)}%</span>
        </div>
      )}
      <Button
        variant={roof.visible ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => onChange({ ...roof, visible: !roof.visible })}
        aria-pressed={roof.visible}
      >
        {roof.visible ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
        {roof.visible ? 'Tetto visibile' : 'Tetto nascosto'}
      </Button>
    </div>
  )
}
