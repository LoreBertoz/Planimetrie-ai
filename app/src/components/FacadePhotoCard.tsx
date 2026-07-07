import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { facadeToPlan, ApiError, type CloudPlanRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  onResult: (plan: CloudPlanRequest) => void
}

/** Experimental: facade photo → estimated room program via cloud vision. */
export function FacadePhotoCard({ onResult }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Immagine troppo grande (max 15 MB)')
      return
    }
    setBusy(true)
    try {
      const plan = await facadeToPlan(file)
      onResult(plan)
      toast.success('Foto analizzata: stanze stimate', {
        description: plan.note ?? 'Controlla e correggi le stanze proposte, poi genera.',
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        toast.error('AI cloud non attiva', {
          description: 'Avvia il server backend con una chiave API per usare la foto facciata.',
        })
      } else {
        toast.error('Analisi della foto non riuscita', {
          description: err instanceof Error ? err.message : undefined,
        })
      }
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Camera className="size-4 text-terra" aria-hidden />
        Foto facciata
        <Badge className="bg-terra text-terra-foreground">beta</Badge>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Carica la foto di una facciata: l'AI stima proporzioni e stanze come punto di partenza.
        Funzione sperimentale — verifica sempre il risultato.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
        {busy ? 'Analisi in corso…' : 'Carica foto'}
      </Button>
    </div>
  )
}
