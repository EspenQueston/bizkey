import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, LogIn, UserPlus, Sparkles, ArrowLeft, Check, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FormProgress } from '@/components/ui/form-progress'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const { signIn, signUp, verifyMfaCode } = useAuth()
  const navigate = useNavigate()

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const passwordValid = password.length >= 8
  const registerChecks = [name.trim().length > 0, emailValid, passwordValid]
  const registerProgress = (registerChecks.filter(Boolean).length / registerChecks.length) * 100

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await verifyMfaCode(mfaCode)
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const needsMfa = await signIn(email, password)
        if (needsMfa) {
          setMfaRequired(true)
          return
        }
        navigate('/app')
      } else {
        if (!name.trim()) {
          setError('Le nom est requis')
          return
        }
        if (password.length < 8) {
          setError('Le mot de passe doit contenir au moins 8 caractères')
          return
        }
        await signUp(email, password, name)
        setSuccess('Compte créé ! Vérifiez votre email pour confirmer votre compte.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
      if (msg.includes('Invalid login credentials')) setError('Email ou mot de passe incorrect')
      else if (msg.includes('already registered')) setError('Cet email est déjà utilisé')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen bg-background flex items-center justify-center p-4 relative overflow-x-hidden overflow-y-auto">
      {/* Animated background */}
      <div className="aurora-bg opacity-60 dark:opacity-80"><div className="aurora-blob-3" /></div>
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />

      <Link
        to="/"
        className="absolute top-4 left-4 sm:top-6 sm:left-6 inline-flex items-center justify-center h-9 w-9 rounded-full border border-border bg-card/80 backdrop-blur text-muted-foreground hover:text-foreground transition z-10"
        aria-label="Retour à l'accueil"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        <div className="mb-5 flex items-center justify-center gap-2">
          <Logo variant="lockup-tagline" size="lg" asLink={false} />
          <Badge variant="secondary" className="rounded-full px-3 py-0.5 ml-1 text-xs hidden sm:inline-flex">
            <Sparkles className="h-3 w-3 text-primary" />
            Import/export
          </Badge>
        </div>

        {mfaRequired ? (
          <Card className="border-2 border-border shadow-2xl shadow-primary/5 py-6">
            <CardContent className="space-y-5">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center mx-auto">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <h2 className="font-serif text-lg font-semibold">Vérification en deux étapes</h2>
                <p className="text-sm text-muted-foreground">
                  Entrez le code à 6 chiffres de votre application d'authentification.
                </p>
              </div>

              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <Input
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="h-12 text-center text-xl tracking-[0.4em] font-mono"
                />

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 rounded-full" disabled={loading || mfaCode.length < 6}>
                  {loading
                    ? <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    : <ShieldCheck className="h-4 w-4" />}
                  Vérifier
                </Button>

                <button
                  type="button"
                  onClick={() => { setMfaRequired(false); setMfaCode(''); setError('') }}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Utiliser un autre compte
                </button>
              </form>
            </CardContent>
          </Card>
        ) : (
        <Card className="border-2 border-border shadow-2xl shadow-primary/5 py-5 gap-4">
          <CardHeader className="pb-3">
            <div className="flex gap-1 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'login'
                    ? 'bg-card shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LogIn className="h-4 w-4 inline mr-2" />
                Connexion
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setSuccess('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'register'
                    ? 'bg-card shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <UserPlus className="h-4 w-4 inline mr-2" />
                Créer un compte
              </button>
            </div>
          </CardHeader>

          <CardContent>
            {mode === 'register' && (
              <div className="mb-3">
                <FormProgress percent={registerProgress} label="Votre compte" />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nom complet</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jean Dupont"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={mode === 'register' ? 'Minimum 8 caractères' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === 'register' && password.length > 0 && (
                  <p className={`text-xs flex items-center gap-1.5 transition-colors ${passwordValid ? 'text-primary' : 'text-muted-foreground'}`}>
                    {passwordValid ? <Check className="h-3 w-3" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                    Au moins 8 caractères
                  </p>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">
                  {success}
                </div>
              )}

              <Button type="submit" className="w-full h-11 rounded-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    {mode === 'login' ? 'Connexion...' : 'Création...'}
                  </span>
                ) : mode === 'login' ? (
                  <>
                    <LogIn className="h-4 w-4" />
                    Se connecter
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Créer mon compte
                  </>
                )}
              </Button>

              {mode === 'register' && (
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  En créant un compte, vous acceptez nos{' '}
                  <a href="#" className="underline hover:text-foreground">Conditions d'utilisation</a>
                  {' '}et notre{' '}
                  <a href="#" className="underline hover:text-foreground">Politique de confidentialité</a>
                </p>
              )}
            </form>

            {mode === 'login' ? (
              <p className="mt-4 pt-4 border-t border-border text-center text-sm text-muted-foreground">
                Nouveau sur BizKey ?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-primary hover:underline font-medium"
                >
                  Créez votre compte gratuit
                </button>
              </p>
            ) : (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                ✨ Plan Gratuit — 3 analyses offertes, sans carte bancaire
              </p>
            )}
          </CardContent>
        </Card>
        )}
      </motion.div>
    </div>
  )
}
