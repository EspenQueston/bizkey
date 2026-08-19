import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Shared 6-digit email-code entry step — signup confirmation and password
 * reset both need the identical shape (code input, verify button, resend
 * with cooldown, error/success slots), so this is the one place that shape
 * lives rather than three near-copies drifting apart.
 */
export function OtpCodeStep({
  email, icon: Icon = Mail, title, description, verifyLabel, error, success, loading, resendCooldown,
  onVerify, onResend, onBack, backLabel = 'Utiliser un autre email',
}: {
  email: string
  icon?: typeof Mail
  title: string
  description: string
  verifyLabel: string
  error?: string
  success?: string
  loading: boolean
  /** Seconds remaining before "Renvoyer le code" is clickable again — 0 means ready. */
  resendCooldown: number
  onVerify: (code: string) => void
  onResend: () => void
  onBack: () => void
  backLabel?: string
}) {
  const [code, setCode] = useState('')

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center mx-auto">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {description} <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <form onSubmit={e => { e.preventDefault(); if (code.length === 6) onVerify(code) }} className="space-y-4">
        <Input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="h-12 text-center text-xl tracking-[0.4em] font-mono"
        />

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

        <Button type="submit" className="w-full h-11 rounded-full" disabled={loading || code.length < 6}>
          {loading
            ? <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            : <Icon className="h-4 w-4" />}
          {verifyLabel}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground transition">
            {backLabel}
          </button>
          <button
            type="button"
            onClick={onResend}
            disabled={resendCooldown > 0 || loading}
            className="text-primary hover:underline font-medium disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
          >
            {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : 'Renvoyer le code'}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground/70">L'envoi d'un code peut prendre quelques secondes.</p>
      </form>
    </div>
  )
}
