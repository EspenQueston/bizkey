import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, ShieldOff, Loader2, Copy, CheckCheck, Smartphone, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Factor {
  id: string
  friendly_name?: string
  status: string
}

interface EnrollData {
  factorId: string
  qrSvg: string
  secret: string
}

export function TwoFactorSettings() {
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [enroll, setEnroll] = useState<EnrollData | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadFactors = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) {
      console.warn('listFactors error:', error.message)
      setFactors([])
    } else {
      setFactors((data?.totp ?? []) as Factor[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadFactors() }, [loadFactors])

  const verified = factors.filter(f => f.status === 'verified')
  const isEnabled = verified.length > 0

  async function startEnroll() {
    setBusy(true)
    try {
      // Clean up any half-finished (unverified) factor first, otherwise repeat
      // attempts pile up against the max_enrolled_factors limit.
      for (const stale of factors.filter(f => f.status !== 'verified')) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id })
      }

      // friendlyName must be unique per user — Supabase returns a 422
      // "mfa_factor_name_conflict" otherwise, so include a timestamp rather
      // than just the date.
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${Date.now()}`,
      })
      if (error) throw error
      setEnroll({
        factorId: data.id,
        qrSvg: data.totp.qr_code,
        secret: data.totp.secret,
      })
      setCode('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de démarrer l'activation")
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnroll() {
    if (!enroll || code.trim().length < 6) return
    setBusy(true)
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enroll.factorId })
      if (cErr) throw cErr

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      })
      if (vErr) throw vErr

      toast.success('Double authentification activée')
      setEnroll(null)
      setCode('')
      await loadFactors()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Code invalide — réessayez')
    } finally {
      setBusy(false)
    }
  }

  async function cancelEnroll() {
    if (enroll) {
      await supabase.auth.mfa.unenroll({ factorId: enroll.factorId }).catch(() => {})
    }
    setEnroll(null)
    setCode('')
    loadFactors()
  }

  async function disable(factorId: string) {
    setBusy(true)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error
      toast.success('Double authentification désactivée')
      await loadFactors()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  async function copySecret() {
    if (!enroll) return
    await navigator.clipboard.writeText(enroll.secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {isEnabled
                ? <ShieldCheck className="h-4 w-4 text-primary" />
                : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
              Double authentification (2FA)
            </CardTitle>
            <CardDescription>
              Protégez votre compte avec un code temporaire généré par votre téléphone.
            </CardDescription>
          </div>
          <Badge
            variant={isEnabled ? 'default' : 'secondary'}
            className="rounded-full shrink-0"
          >
            {isEnabled ? 'Activée' : 'Désactivée'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        ) : enroll ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/40 p-4">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                1. Scannez ce QR code
              </p>
              <div
                className="bg-white rounded-lg p-3 w-fit mx-auto [&_svg]:h-40 [&_svg]:w-40"
                // Supabase returns the QR as an inline SVG string it generated
                // itself — not user-supplied content.
                dangerouslySetInnerHTML={{ __html: enroll.qrSvg }}
              />
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Google Authenticator, Authy, 1Password, Microsoft Authenticator…
              </p>

              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1.5">
                  Impossible de scanner ? Saisissez cette clé manuellement :
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-background border border-border rounded-lg px-2.5 py-2 break-all">
                    {enroll.secret}
                  </code>
                  <Button size="sm" variant="outline" className="rounded-lg shrink-0 h-9" onClick={copySecret}>
                    {copied ? <CheckCheck className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="totp-code">2. Entrez le code à 6 chiffres affiché</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                className="h-11 text-center text-lg tracking-[0.4em] font-mono"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-full" onClick={cancelEnroll} disabled={busy}>
                Annuler
              </Button>
              <Button className="flex-1 rounded-full" onClick={confirmEnroll} disabled={busy || code.length < 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Activer
              </Button>
            </div>
          </div>
        ) : isEnabled ? (
          <div className="space-y-3">
            {verified.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                    <Smartphone className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{f.friendly_name ?? 'Application d\'authentification'}</p>
                    <p className="text-xs text-muted-foreground">Vérifiée et active</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => disable(f.id)}
                  disabled={busy}
                >
                  Désactiver
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-yellow-600" />
              Gardez votre application d'authentification accessible : sans elle, vous ne pourrez plus vous connecter.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Une fois activée, un code à 6 chiffres vous sera demandé à chaque connexion, en plus de votre mot de passe.
            </p>
            <Button onClick={startEnroll} disabled={busy} className="rounded-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Activer la 2FA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
