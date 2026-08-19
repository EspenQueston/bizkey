import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ShieldCheck, ArrowLeft, Check, Mail, KeyRound, Lock, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/contexts/AuthContext'
import { mapAuthError } from '@/lib/authErrors'
import { isCurrentUserAdmin } from '@/lib/db'
import { toast } from 'sonner'

type View = 'login' | 'mfa' | 'forgot-request' | 'forgot-reset'

const RESEND_COOLDOWN_SECONDS = 30

export default function AdminLoginPage() {
  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    signIn, signOut, verifyMfaCode,
    requestPasswordReset, verifyPasswordResetCode, updatePassword,
  } = useAuth()
  const navigate = useNavigate()
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  /** Rejects any session that isn't actually an admin — a customer account has no business establishing a session on this form at all. */
  async function rejectIfNotAdmin(): Promise<boolean> {
    if (await isCurrentUserAdmin()) return false
    await signOut()
    const message = "Ce compte n'a pas les droits administrateur."
    setError(message)
    toast.error(message)
    return true
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      await verifyMfaCode(mfaCode)
      if (await rejectIfNotAdmin()) { setView('login'); return }
      toast.success('Connexion administrateur réussie.')
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
      const needsMfa = await signIn(email, password)
      if (needsMfa) { setView('mfa'); return }
      if (await rejectIfNotAdmin()) return
      toast.success('Connexion administrateur réussie.')
      navigate('/app')
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
      if (await rejectIfNotAdmin()) { setView('login'); setNewPassword(''); setConfirmNewPassword(''); return }
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
    <div className="h-screen bg-[#0a1220] text-slate-100 flex items-center justify-center p-4 relative overflow-x-hidden overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(227,184,62,0.08),_transparent_60%)]" />
      <div className="absolute inset-0 bg-grid opacity-[0.06]" />

      <Link
        to="/"
        className="absolute top-4 left-4 sm:top-6 sm:left-6 inline-flex items-center justify-center h-9 w-9 rounded-full border border-white/10 bg-white/5 backdrop-blur text-slate-400 hover:text-slate-100 transition z-10"
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
        <div className="mb-5 flex flex-col items-center justify-center gap-2.5">
          <Logo variant="lockup-tagline" size="lg" asLink={false} />
          <Badge className="rounded-full px-3 py-0.5 text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Espace administrateur — accès réservé
          </Badge>
        </div>

        {view === 'mfa' ? (
          <Card key={view} className="border border-white/10 bg-white/[0.03] backdrop-blur shadow-2xl py-6">
            <CardContent className="space-y-5">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 grid place-items-center mx-auto">
                  <ShieldCheck className="h-6 w-6 text-amber-400" />
                </div>
                <h2 className="font-serif text-lg font-semibold text-white">Vérification en deux étapes</h2>
                <p className="text-sm text-slate-400">
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
                  className="h-12 text-center text-xl tracking-[0.4em] font-mono bg-white/5 border-white/10 text-white"
                />

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 rounded-full bg-amber-500 hover:bg-amber-400 text-[#0a1220] font-semibold" disabled={loading || mfaCode.length < 6}>
                  {loading
                    ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : <ShieldCheck className="h-4 w-4" />}
                  Vérifier
                </Button>

                <button
                  type="button"
                  onClick={() => { switchView('login'); setMfaCode('') }}
                  className="w-full text-center text-sm text-slate-400 hover:text-slate-200 transition"
                >
                  Utiliser un autre compte
                </button>
              </form>
            </CardContent>
          </Card>
        ) : view === 'forgot-request' ? (
          <Card key={view} className="border border-white/10 bg-white/[0.03] backdrop-blur shadow-2xl py-6">
            <CardContent className="space-y-5">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 grid place-items-center mx-auto">
                  <KeyRound className="h-6 w-6 text-amber-400" />
                </div>
                <h2 className="font-serif text-lg font-semibold text-white">Mot de passe oublié</h2>
                <p className="text-sm text-slate-400">
                  Entrez votre email administrateur — si un compte existe, un code de réinitialisation vous sera envoyé.
                </p>
              </div>

              <form onSubmit={handleForgotRequest} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email" className="text-slate-300">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    autoFocus
                    placeholder="admin@bizkey.local"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 rounded-full bg-amber-500 hover:bg-amber-400 text-[#0a1220] font-semibold" disabled={loading || !email.trim()}>
                  {loading
                    ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : <Mail className="h-4 w-4" />}
                  {loading ? 'Envoi en cours...' : 'Envoyer le code'}
                </Button>
                {loading && (
                  <p className="text-center text-xs text-slate-500 -mt-2">
                    L'envoi de l'email peut prendre quelques secondes.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => switchView('login')}
                  className="w-full text-center text-sm text-slate-400 hover:text-slate-200 transition"
                >
                  Retour à la connexion
                </button>
              </form>
            </CardContent>
          </Card>
        ) : view === 'forgot-reset' ? (
          <Card key={view} className="border border-white/10 bg-white/[0.03] backdrop-blur shadow-2xl py-6">
            <CardContent className="space-y-5">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 grid place-items-center mx-auto">
                  <Lock className="h-6 w-6 text-amber-400" />
                </div>
                <h2 className="font-serif text-lg font-semibold text-white">Nouveau mot de passe</h2>
                <p className="text-sm text-slate-400">
                  Code envoyé à <span className="font-medium text-slate-200">{email}</span> — entrez-le avec votre nouveau mot de passe.
                </p>
              </div>

              <form onSubmit={handleForgotReset} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="resetCode" className="text-slate-300">Code de vérification</Label>
                  <Input
                    id="resetCode"
                    name="resetCode"
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    className="h-12 text-center text-xl tracking-[0.4em] font-mono bg-white/5 border-white/10 text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-slate-300">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 caractères"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      className="h-11 pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPassword.length > 0 && (
                    <p className={`text-xs flex items-center gap-1.5 transition-colors ${newPasswordValid ? 'text-amber-400' : 'text-slate-500'}`}>
                      {newPasswordValid ? <Check className="h-3 w-3" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                      Au moins 8 caractères
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmNewPassword" className="text-slate-300">Confirmer le mot de passe</Label>
                  <Input
                    id="confirmNewPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    required
                    className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                  {confirmNewPassword.length > 0 && (
                    <p className={`text-xs flex items-center gap-1.5 transition-colors ${newPasswordsMatch ? 'text-amber-400' : 'text-red-400'}`}>
                      {newPasswordsMatch ? <Check className="h-3 w-3" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                      {newPasswordsMatch ? 'Les mots de passe correspondent' : 'Les mots de passe ne correspondent pas'}
                    </p>
                  )}
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                    {success}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 rounded-full bg-amber-500 hover:bg-amber-400 text-[#0a1220] font-semibold" disabled={loading}>
                  {loading
                    ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : <Lock className="h-4 w-4" />}
                  Réinitialiser le mot de passe
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => switchView('forgot-request')} className="text-slate-400 hover:text-slate-200 transition">
                    Modifier l'email
                  </button>
                  <button
                    type="button"
                    onClick={handleResendResetCode}
                    disabled={resendCooldown > 0 || loading}
                    className="text-amber-400 hover:underline font-medium disabled:text-slate-600 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : 'Renvoyer le code'}
                  </button>
                </div>
                <p className="text-center text-xs text-slate-600">L'envoi d'un code peut prendre quelques secondes.</p>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card key={view} className="border border-white/10 bg-white/[0.03] backdrop-blur shadow-2xl py-6">
            <CardContent className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="font-serif text-lg font-semibold text-white">Connexion administrateur</h2>
                <p className="text-sm text-slate-400">Réservé au personnel autorisé de BizKey.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-email" className="text-slate-300">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@bizkey.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="admin-password" className="text-slate-300">Mot de passe</Label>
                    <button
                      type="button"
                      onClick={() => switchView('forgot-request')}
                      className="text-xs text-amber-400 hover:underline font-medium"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                    {success}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 rounded-full bg-amber-500 hover:bg-amber-400 text-[#0a1220] font-semibold" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Connexion...
                    </span>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Se connecter
                    </>
                  )}
                </Button>
              </form>

              <p className="pt-2 border-t border-white/10 text-center text-xs text-slate-500">
                Vous n'êtes pas membre de l'équipe ?{' '}
                <Link to="/login" className="text-amber-400 hover:underline font-medium">Espace client</Link>
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  )
}
