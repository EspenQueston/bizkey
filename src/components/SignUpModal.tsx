import { useState } from 'react'
import { Loader2, Sparkles, LogIn, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormProgress } from '@/components/ui/form-progress'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const COUNTRIES = [
  'Bénin', 'Togo', 'Sénégal', 'Côte d\'Ivoire', 'Cameroun', 'Mali', 'Guinée',
  'RD Congo', 'Niger', 'Burkina Faso', 'Autre',
]

interface Props {
  open: boolean
  onSuccess: () => void
  onClose: () => void
}

export function SignUpModal({ open, onSuccess, onClose }: Props) {
  const { signUp, signIn } = useAuth()
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    country: '',
  })

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  const passwordValid = form.password.length >= 6
  const signupChecks = [form.name.trim().length > 0, emailValid, passwordValid, form.country.length > 0]
  const signupProgress = (signupChecks.filter(Boolean).length / signupChecks.length) * 100

  async function handleGoogleSignIn() {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      })
      if (error) throw error
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur Google')
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'signup') {
        await signUp(form.email, form.password, form.name, form.country)
        toast.success('Compte créé ! Vérifiez votre email puis revenez.')
        onSuccess()
      } else {
        await signIn(form.email, form.password)
        onSuccess()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border-border/70 relative">
        {/* Subtle animated background, consistent with the rest of the platform */}
        <div className="aurora-bg opacity-40 dark:opacity-60 -z-10"><div className="aurora-blob-3" /></div>
        <div className="noise-overlay -z-10" />

        <DialogHeader>
          <DialogTitle className="font-serif text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            {mode === 'signup'
              ? 'Continuez avec votre compte gratuit'
              : 'Connectez-vous pour continuer'}
          </DialogTitle>
          {mode === 'signup' && (
            <p className="text-sm text-muted-foreground">
              2 analyses gratuites de plus vous attendent — 30 secondes, sans carte bancaire.
            </p>
          )}
        </DialogHeader>

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continuer avec Google
        </Button>

        <div className="flex items-center gap-3 -my-1">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {mode === 'signup' && <FormProgress percent={signupProgress} label="Création du compte" />}

        <form onSubmit={handleSubmit} className="space-y-2.5">
          {mode === 'signup' && (
            <div className="space-y-1">
              <Label>Prénom</Label>
              <Input value={form.name} onChange={update('name')} placeholder="Votre prénom" required />
            </div>
          )}
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={update('email')} placeholder="vous@email.com" required />
          </div>
          <div className="space-y-1">
            <Label>Mot de passe</Label>
            <Input type="password" value={form.password} onChange={update('password')} placeholder="••••••••" required minLength={6} />
            {mode === 'signup' && form.password.length > 0 && (
              <p className={`text-xs flex items-center gap-1.5 ${passwordValid ? 'text-primary' : 'text-muted-foreground'}`}>
                {passwordValid ? <Check className="h-3 w-3" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                Au moins 6 caractères
              </p>
            )}
          </div>
          {mode === 'signup' && (
            <div className="space-y-1">
              <Label>Pays</Label>
              <select
                value={form.country}
                onChange={update('country')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                required
              >
                <option value="">Sélectionner votre pays</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : mode === 'signup'
              ? 'Créer mon compte et continuer l\'analyse →'
              : <><LogIn className="h-4 w-4 mr-1" />Se connecter et continuer</>
            }
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-1">
          {mode === 'signup' ? (
            <>Déjà un compte ?{' '}
              <button onClick={() => setMode('login')} className="text-primary hover:underline font-medium">
                Se connecter
              </button>
            </>
          ) : (
            <>Pas encore de compte ?{' '}
              <button onClick={() => setMode('signup')} className="text-primary hover:underline font-medium">
                Créer un compte
              </button>
            </>
          )}
        </p>
      </DialogContent>
    </Dialog>
  )
}
