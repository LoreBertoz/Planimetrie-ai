import { useEffect, useState } from 'react'
import { Crown, FolderOpen, Loader2, LogOut, Save, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import {
  ApiError,
  deleteProject,
  listProjects,
  loadProject,
  login,
  logout,
  me,
  register,
  saveProject,
  upgradePlan,
  type ProjectData,
  type ProjectSummary,
  type User,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  getProjectData: () => ProjectData
  onProjectLoaded: (name: string, data: ProjectData) => void
}

/** Account + saved projects: login/register, save/load, subscription gate. */
export function AccountMenu({ getProjectData, onProjectLoaded }: Props) {
  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectName, setProjectName] = useState('')

  useEffect(() => {
    me().then(setUser).catch(() => {})
  }, [])

  useEffect(() => {
    if (open && user) {
      listProjects().then(setProjects).catch(() => {})
    }
  }, [open, user])

  const submitAuth = async (mode: 'login' | 'register') => {
    setBusy(true)
    try {
      const u = mode === 'login' ? await login(email, password) : await register(email, password)
      setUser(u)
      setPassword('')
      toast.success(mode === 'login' ? 'Bentornato!' : 'Account creato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operazione non riuscita', {
        description:
          err instanceof ApiError && err.status === 503
            ? 'Il server backend non è attivo.'
            : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const onSave = async () => {
    if (!projectName.trim()) return
    setBusy(true)
    try {
      await saveProject(projectName.trim(), getProjectData())
      setProjectName('')
      setProjects(await listProjects())
      toast.success('Progetto salvato')
    } catch (err) {
      if (err instanceof ApiError && err.upgrade) {
        toast.error(err.message, { description: 'Usa "Passa a Pro" qui sotto.' })
      } else {
        toast.error(err instanceof Error ? err.message : 'Salvataggio non riuscito')
      }
    } finally {
      setBusy(false)
    }
  }

  const onLoad = async (id: string) => {
    setBusy(true)
    try {
      const p = await loadProject(id)
      onProjectLoaded(p.name, p.data)
      setOpen(false)
      toast.success(`Progetto "${p.name}" caricato`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Caricamento non riuscito')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (id: string) => {
    try {
      await deleteProject(id)
      setProjects(await listProjects())
      toast.success('Progetto eliminato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Eliminazione non riuscita')
    }
  }

  const onUpgrade = async () => {
    setBusy(true)
    try {
      const u = await upgradePlan()
      setUser(u)
      toast.success('Piano Pro attivo', {
        description: 'Demo: il pagamento verrà collegato nella versione commerciale.',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upgrade non riuscito')
    } finally {
      setBusy(false)
    }
  }

  const onLogout = async () => {
    await logout().catch(() => {})
    setUser(null)
    toast.success('Disconnesso')
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserRound aria-hidden />
        {user ? user.email.split('@')[0] : 'Accedi'}
        {user?.plan === 'pro' && <Crown className="size-3.5 text-terra" aria-hidden />}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {!user ? (
            <>
              <DialogHeader>
                <DialogTitle>Il tuo account</DialogTitle>
                <DialogDescription>
                  Salva i progetti nel cloud e ritrovali su ogni dispositivo.
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="login">
                <TabsList className="w-full">
                  <TabsTrigger value="login" className="flex-1">
                    Accedi
                  </TabsTrigger>
                  <TabsTrigger value="register" className="flex-1">
                    Registrati
                  </TabsTrigger>
                </TabsList>
                {(['login', 'register'] as const).map((mode) => (
                  <TabsContent key={mode} value={mode} className="mt-3 flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${mode}-email`}>Email</Label>
                      <Input
                        id={`${mode}-email`}
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nome@studio.it"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${mode}-password`}>Password</Label>
                      <Input
                        id={`${mode}-password`}
                        type="password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'register' ? 'Minimo 8 caratteri' : '••••••••'}
                        onKeyDown={(e) => e.key === 'Enter' && submitAuth(mode)}
                      />
                    </div>
                    <Button onClick={() => submitAuth(mode)} disabled={busy || !email || !password}>
                      {busy && <Loader2 className="animate-spin" aria-hidden />}
                      {mode === 'login' ? 'Accedi' : 'Crea account'}
                    </Button>
                  </TabsContent>
                ))}
              </Tabs>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {user.email}
                  <Badge
                    className={
                      user.plan === 'pro'
                        ? 'bg-terra text-terra-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }
                  >
                    {user.plan === 'pro' ? 'Pro' : 'Free'}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {user.plan === 'free'
                    ? 'Piano gratuito: fino a 3 progetti salvati.'
                    : 'Piano Pro: progetti illimitati.'}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-2">
                <Label htmlFor="project-name" className="text-sm font-semibold">
                  <Save className="size-4" aria-hidden /> Salva progetto corrente
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Es. Villa cliente Rossi"
                    onKeyDown={(e) => e.key === 'Enter' && onSave()}
                  />
                  <Button onClick={onSave} disabled={busy || !projectName.trim()}>
                    Salva
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <FolderOpen className="size-4" aria-hidden /> I tuoi progetti
                </span>
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun progetto salvato.</p>
                ) : (
                  <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                    {projects.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                        <button
                          className="flex-1 truncate text-left text-sm hover:text-primary"
                          onClick={() => onLoad(p.id)}
                        >
                          {p.name}
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.updatedAt).toLocaleDateString('it-IT')}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          aria-label={`Elimina ${p.name}`}
                          onClick={() => onDelete(p.id)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-2">
                {user.plan === 'free' ? (
                  <Button variant="default" size="sm" onClick={onUpgrade} disabled={busy}>
                    <Crown aria-hidden /> Passa a Pro
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Grazie per il supporto!</span>
                )}
                <Button variant="outline" size="sm" onClick={onLogout}>
                  <LogOut aria-hidden /> Esci
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
