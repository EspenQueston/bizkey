import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  /** Resolves `true` when the account has 2FA and still needs a TOTP code. */
  signIn: (email: string, password: string) => Promise<boolean>
  signUp: (email: string, password: string, name: string, country?: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  /** Completes a pending 2FA challenge with the user's 6-digit code. */
  verifyMfaCode: (code: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
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
          await loadProfile(initialSession.user.id)
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
          loadProfile(newSession.user.id)
        } else {
          setProfile(null)
        }

        // On sign out, clear everything immediately
        if (event === 'SIGNED_OUT') {
          setProfile(null)
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
  }, [loadProfile])

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

  async function signUp(email: string, password: string, name: string, country?: string) {
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
  }

  async function signOut() {
    // Immediately clear state so UI unblocks
    setProfile(null)
    setSession(null)
    setUser(null)
    try {
      await supabase.auth.signOut()
    } catch {
      // Even if signOut fails server-side, we've cleared local state
    }
  }

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id)
  }, [user, loadProfile])

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile, verifyMfaCode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
