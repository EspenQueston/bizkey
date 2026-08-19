import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, LogIn, UserPlus, Sparkles, ArrowLeft, Check, ShieldCheck, Mail, KeyRound, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FormProgress } from '@/components/ui/form-progress'
import { Logo } from '@/components/Logo'
import { OtpCodeStep } from '@/components/auth/OtpCodeStep'
import { useAuth } from '@/contexts/AuthContext'
import { mapAuthError } from '@/lib/authErrors'
import { toast } from 'sonner'

type View = 'login' | 'register' | 'mfa' | 'confirm-signup' | 'forgot-request' | 'forgot-reset'

const RESEND_COOLDOWN_SECONDS = 30

export default function LoginPage() {
  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const {
    signIn, signUp, verifyMfaCode,
    verifySignupCode, resendSignupCode,
    requestPasswordReset, verifyPasswordResetCode, updatePassword,
  } = useAuth()
  const navigate = useNavigate()
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const passwordValid = password.length >= 8
  const registerChecks = [name.trim().length > 0, emailValid, passwordValid]
  const registerProgress = (registerChecks.filter(Boolean).length / registerChecks.length) * 100
  const newPasswordValid = newPassword.length >= 8
  const newPasswordsMatch = newPassword.length > 0 && newPassword === confirmNewPassword

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }, [])

  function startResendCooldown() {
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function resetMessages() { setError(''); setSuccess('') }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      await verifyMfaCode(mfaCode)
      toast.success('Connexion réussie — bienvenue sur BizKey !')
      navigate('/app')
    } catch (err) {
      const message = mapAuthError(err)
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)

    try {
      if (view === 'login') {
        const needsMfa = await signIn(email, password)
        if (needsMfa) {
          setView('mfa')
          return
        }
        toast.success('Connexion réussie — bienvenue sur BizKey !')
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
        const needsConfirmation = await signUp(email, password, name)
        if (needsConfirmation) {
          setView('confirm-signup')
          startResendCooldown()
          toast.success('Compte créé — un code de confirmation a été envoyé par email.')
        } else {
          toast.success('Compte créé — bienvenue sur BizKey !')
          navigate('/app')
        }
      }
    } catch (err) {
      const message = mapAuthError(err)
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmSignup(code: string) {
    resetMessages()
    setLoading(true)
    try {
      await verifySignupCode(email, code)
      toast.success('Compte confirmé — bienvenue sur BizKey !')
      navigate('/app')
    } catch (err) {
      const message = mapAuthError(err)
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResendSignupCode() {
    resetMessages()
    setLoading(true)
    try {
      await resendSignupCode(email)
      startResendCooldown()
      setSuccess('Un nouveau code a été envoyé.')
      toast.success('Nouveau code envoyé par email.')
    } catch (err) {
      const message = mapAuthError(err)
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotRequest(e: React.FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setView('forgot-reset')
      startResendCooldown()
      toast.success('Code de réinitialisation envoyé par email.')
    } catch (err) {
      const message = mapAuthError(err)
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResendResetCode() {
    resetMessages()
    setLoading(true)
    try {
      await requestPasswordReset(email)
      startResendCooldown()
      setSuccess('Un nouveau code a été envoyé.')
      toast.success('Nouveau code envoyé par email.')
    } catch (err) {
      const message = mapAuthError(err)
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotReset(e: React.FormEvent) {
    e.preventDefault()
    resetMessages()
    const code = (e.target as HTMLFormElement).resetCode.value.trim()
    if (code.length !== 6) { setError('Entrez le code à 6 chiffres reçu par email'); return }
    if (!newPasswordValid) { setError('Le mot de passe doit contenir au moins 8 caractères'); return }
    if (!newPasswordsMatch) { setError('Les mots de passe ne correspondent pas'); return }
    setLoading(true)
    try {
      await verifyPasswordResetCode(email, code)
      await updatePassword(newPassword)
      setView('login')
      setPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setSuccess('Mot de passe mis à jour — connectez-vous avec votre nouveau mot de passe.')
      toast.success('Mot de passe mis à jour avec succès.')
    } catch (err) {
      const message = mapAuthError(err)
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  function switchView(next: View) {
    setView(next)
    resetMessages()
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

        {view === 'mfa' ? (
          <Card key={view} className="border-2 border-border shadow-2xl shadow-primary/5 py-6">
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
                  onClick={() => { switchView('login'); setMfaCode('') }}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Utiliser un autre compte
                </button>
              </form>
            </CardContent>
          </Card>
        ) : view === 'confirm-signup' ? (
          <Card key={view} className="border-2 border-border shadow-2xl shadow-primary/5 py-6">
            <CardContent>
              <OtpCodeStep
                email={email}
                icon={Mail}
                title="Confirmez votre compte"
                description="Entrez le code à 6 chiffres envoyé à"
                verifyLabel="Confirmer et continuer"
                error={error}
                success={success}
                loading={loading}
                resendCooldown={resendCooldown}
                onVerify={handleConfirmSignup}
                onResend={handleResendSignupCode}
                onBack={() => switchView('register')}
                backLabel="Modifier l'email"
              />
            </CardContent>
          </Card>
        ) : view === 'forgot-request' ? (
          <Card key={view} className="border-2 border-border shadow-2xl shadow-primary/5 py-6">
            <CardContent className="space-y-5">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center mx-auto">
                  <KeyRound className="h-6 w-6 text-primary" />
                </div>
                <h2 className="font-serif text-lg font-semibold">Mot de passe oublié</h2>
                <p className="text-sm text-muted-foreground">
                  Entrez votre email — si un compte BizKey existe, un code de réinitialisation vous sera envoyé.
                </p>
              </div>

              <form onSubmit={handleForgotRequest} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    autoFocus
                    placeholder="vous@exemple.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 rounded-full" disabled={loading || !emailValid}>
                  {loading
                    ? <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    : <Mail className="h-4 w-4" />}
                  {loading ? 'Envoi en cours...' : 'Envoyer le code'}
                </Button>
                {loading && (
                  <p className="text-center text-xs text-muted-foreground -mt-2">
                    L'envoi de l'email peut prendre quelques secondes.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => switchView('login')}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Retour à la connexion
                </button>
              </form>
            </CardContent>
          </Card>
        ) : view === 'forgot-reset' ? (
          <Card key={view} className="border-2 border-border shadow-2xl shadow-primary/5 py-6">
            <CardContent className="space-y-5">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center mx-auto">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <h2 className="font-serif text-lg font-semibold">Nouveau mot de passe</h2>
                <p className="text-sm text-muted-foreground">
                  Code envoyé à <span className="font-medium text-foreground">{email}</span> — entrez-le avec votre nouveau mot de passe.
                </p>
              </div>

              <form onSubmit={handleForgotReset} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="resetCode">Code de vérification</Label>
                  <Input
                    id="resetCode"
                    name="resetCode"
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    className="h-12 text-center text-xl tracking-[0.4em] font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 caractères"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPassword.length > 0 && (
                    <p className={`text-xs flex items-center gap-1.5 transition-colors ${newPasswordValid ? 'text-primary' : 'text-muted-foreground'}`}>
                      {newPasswordValid ? <Check className="h-3 w-3" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                      Au moins 8 caractères
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmNewPassword">Confirmer le mot de passe</Label>
                  <Input
                    id="confirmNewPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    required
                    className="h-11"
                  />
                  {confirmNewPassword.length > 0 && (
                    <p className={`text-xs flex items-center gap-1.5 transition-colors ${newPasswordsMatch ? 'text-primary' : 'text-destructive'}`}>
                      {newPasswordsMatch ? <Check className="h-3 w-3" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                      {newPasswordsMatch ? 'Les mots de passe correspondent' : 'Les mots de passe ne correspondent pas'}
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
                  {loading
                    ? <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    : <Lock className="h-4 w-4" />}
                  Réinitialiser le mot de passe
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => switchView('forgot-request')} className="text-muted-foreground hover:text-foreground transition">
                    Modifier l'email
                  </button>
                  <button
                    type="button"
                    onClick={handleResendResetCode}
                    disabled={resendCooldown > 0 || loading}
                    className="text-primary hover:underline font-medium disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : 'Renvoyer le code'}
                  </button>
                </div>
                <p className="text-center text-xs text-muted-foreground/70">L'envoi d'un code peut prendre quelques secondes.</p>
              </form>
            </CardContent>
          </Card>
        ) : (
        <Card key={view} className="border-2 border-border shadow-2xl shadow-primary/5 py-5 gap-4">
          <CardHeader className="pb-3">
            <div className="flex gap-1 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => switchView('login')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === 'login'
                    ? 'bg-card shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LogIn className="h-4 w-4 inline mr-2" />
                Connexion
              </button>
              <button
                type="button"
                onClick={() => switchView('register')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === 'register'
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
            {view === 'register' && (
              <div className="mb-3">
                <FormProgress percent={registerProgress} label="Votre compte" />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {view === 'register' && (
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  {view === 'login' && (
                    <button
                      type="button"
                      onClick={() => { switchView('forgot-request') }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={view === 'register' ? 'Minimum 8 caractères' : '••••••••'}
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
                {view === 'register' && password.length > 0 && (
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
                    {view === 'login' ? 'Connexion...' : 'Création...'}
                  </span>
                ) : view === 'login' ? (
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

              {view === 'register' && (
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  En créant un compte, vous acceptez nos{' '}
                  <a href="#" className="underline hover:text-foreground">Conditions d'utilisation</a>
                  {' '}et notre{' '}
                  <a href="#" className="underline hover:text-foreground">Politique de confidentialité</a>
                </p>
              )}
            </form>

            {view === 'login' ? (
              <p className="mt-4 pt-4 border-t border-border text-center text-sm text-muted-foreground">
                Nouveau sur BizKey ?{' '}
                <button
                  type="button"
                  onClick={() => switchView('register')}
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
