import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database, AssistantClient, AssistantMemberRole } from '@/lib/supabase'
import { syncSubscriptionStatus, getMyAssistantMembership } from '@/lib/db'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** The caller's own BizKey WhatsApp Assistant subscription, if they have one — null for everyone else, including admins (admin access doesn't depend on this). Resolved via team membership, so it's populated for an invited manager/viewer too, not just the original owner. Single fetch shared by route guards and nav visibility. */
  assistantClient: AssistantClient | null
  /** The caller's role on assistantClient's business — null when assistantClient is null. */
  assistantRole: AssistantMemberRole | null
  loading: boolean
  /** Resolves `true` when the account has 2FA and still needs a TOTP code. */
  signIn: (email: string, password: string) => Promise<boolean>
  /** Resolves `true` when the new account must confirm its email (a 6-digit code) before it can sign in — true whenever email confirmation is enabled, since signUp then returns no session. */
  signUp: (email: string, password: string, name: string, country?: string) => Promise<boolean>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  /** Completes a pending 2FA challenge with the user's 6-digit code. */
  verifyMfaCode: (code: string) => Promise<void>
  /** Confirms a fresh signup with the 6-digit code emailed to them — establishes a real session on success. */
  verifySignupCode: (email: string, code: string) => Promise<void>
  /** Resends the signup confirmation code — same underlying call as signUp with no password change, which is how Supabase Auth resends without creating a duplicate account. */
  resendSignupCode: (email: string) => Promise<void>
  /** Always resolves silently, whether or not the email belongs to an account — resetPasswordForEmail itself never reveals account existence, so neither should the UI built on top of it. */
  requestPasswordReset: (email: string) => Promise<void>
  /** Verifies the 6-digit recovery code and establishes a temporary session that updatePassword can then act on. */
  verifyPasswordResetCode: (email: string, code: string) => Promise<void>
  /** Only valid right after verifyPasswordResetCode (or while otherwise signed in, e.g. from Settings) — sets a new password on the current session. */
  updatePassword: (newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [assistantClient, setAssistantClient] = useState<AssistantClient | null>(null)
  const [assistantRole, setAssistantRole] = useState<AssistantMemberRole | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  // Load profile with timeout and error resilience
  const loadProfile = useCallback(async (userId: string) => {
    try {
      const profilePromise = supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      const result = await Promise.race([profilePromise, timeoutPromise])

      if (mountedRef.current) {
        if (result && 'data' in result && !result.error) {
          setProfile(result.data)
        } else {
          setProfile(null)
        }
      }
    } catch {
      if (mountedRef.current) setProfile(null)
    }
  }, [])

  // Not every account belongs to an Assistant business — a membership row
  // that resolves to nothing is the common case, not an error path. Goes
  // through membership (not a raw profile_id match on assistant_clients)
  // so an invited manager/viewer resolves here too, not just the owner.
  const loadAssistantClient = useCallback(async (userId: string) => {
    try {
      const membership = await getMyAssistantMembership(userId)
      if (mountedRef.current) {
        setAssistantClient(membership?.client ?? null)
        setAssistantRole(membership?.role ?? null)
      }
    } catch {
      if (mountedRef.current) {
        setAssistantClient(null)
        setAssistantRole(null)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let ignore = false

    // Initialize session with a safety timeout
    const initAuth = async () => {
      try {
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 6000)
        )
        const { data: { session: initialSession } } = await Promise.race([sessionPromise, timeoutPromise]) as any

        if (ignore) return

        setSession(initialSession)
        setUser(initialSession?.user ?? null)

        if (initialSession?.user) {
          // Best-effort — a returning user whose subscription/assistant
          // period lapsed while they were away gets that corrected before
          // profile/assistantClient load, so the sidebar badge and status
          // fields they're about to see aren't reading stale data. Never
          // blocks sign-in if it fails; the hourly cron sweep and the
          // Assistant route guards' own time check are the real backstops.
          try {
            await syncSubscriptionStatus(initialSession.user.id)
          } catch (err) {
            console.warn('syncSubscriptionStatus failed:', err)
          }

          // Both must resolve before `loading` flips to false — route guards
          // key off assistantClient too, and a premature false would redirect
          // a real business owner away before their subscription loads.
          await Promise.all([
            loadProfile(initialSession.user.id),
            loadAssistantClient(initialSession.user.id),
          ])
        }
      } catch (err) {
        console.error('Auth init error:', err)
        // Don't block the app — allow it to render without auth
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (ignore) return

        setSession(newSession)
        setUser(newSession?.user ?? null)

        if (newSession?.user) {
          // Load profile in background — don't block navigation
          syncSubscriptionStatus(newSession.user.id).catch(err => console.warn('syncSubscriptionStatus failed:', err))
          loadProfile(newSession.user.id)
          loadAssistantClient(newSession.user.id)
        } else {
          setProfile(null)
          setAssistantClient(null)
          setAssistantRole(null)
        }

        // On sign out, clear everything immediately
        if (event === 'SIGNED_OUT') {
          setProfile(null)
          setAssistantClient(null)
          setAssistantRole(null)
          setSession(null)
          setUser(null)
        }
      }
    )

    return () => {
      ignore = true
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [loadProfile, loadAssistantClient])

  async function signIn(email: string, password: string): Promise<boolean> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    // Password alone gets the session to AAL1. If the account has a verified
    // TOTP factor, Supabase reports nextLevel 'aal2' and the session stays
    // unprivileged until the code is verified.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    return aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2'
  }

  async function verifyMfaCode(code: string) {
    const { data: factorList, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) throw listError

    const factor = factorList?.totp?.find(f => f.status === 'verified')
    if (!factor) throw new Error('Aucun facteur 2FA actif sur ce compte')

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (challengeError) throw challengeError

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: code.trim(),
    })
    if (verifyError) throw verifyError
  }

  async function signUp(email: string, password: string, name: string, country?: string): Promise<boolean> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, country: country ?? '' } },
    })
    if (error) throw error
    // If trigger didn't fire yet, upsert profile with country
    if (data.user && country) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        name,
        country,
      }, { onConflict: 'id' })
    }
    // With email confirmations enabled, a brand-new signup gets a user but
    // no session — the account can't sign in until verifySignupCode succeeds.
    return !data.session
  }

  async function resendSignupCode(email: string) {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) throw error
  }

  async function verifySignupCode(email: string, code: string) {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' })
    if (error) throw error
  }

  async function requestPasswordReset(email: string) {
    // Supabase itself never reveals whether the email is registered — it
    // returns success either way, by design, so this can't leak that either.
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }

  async function verifyPasswordResetCode(email: string, code: string) {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })
    if (error) throw error
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  async function signOut() {
    // Immediately clear state so UI unblocks
    setProfile(null)
    setAssistantClient(null)
    setAssistantRole(null)
    setSession(null)
    setUser(null)
    try {
      await supabase.auth.signOut()
    } catch {
      // Even if signOut fails server-side, we've cleared local state
    }
  }

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id)
      // So the Assistant nav appears immediately after a successful
      // subscription payment, without a full page reload.
      loadAssistantClient(user.id)
    }
  }, [user, loadProfile, loadAssistantClient])

  return (
    <AuthContext.Provider value={{
      session, user, profile, assistantClient, assistantRole, loading,
      signIn, signUp, signOut, refreshProfile, verifyMfaCode,
      verifySignupCode, resendSignupCode, requestPasswordReset, verifyPasswordResetCode, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
