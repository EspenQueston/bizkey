/**
 * Maps a raw Supabase Auth error into a message that actually explains what
 * went wrong, in French — used by Login.tsx, SignUpModal.tsx, and
 * Settings.tsx's password-change form, so all three fail the same way for
 * the same underlying error rather than three near-copies drifting apart.
 *
 * The one deliberate exception is login's own "wrong password" case, which
 * stays generic on purpose: distinguishing "wrong password" from "no such
 * account" on a LOGIN attempt is a classic user-enumeration hole (an
 * attacker could otherwise probe which emails have accounts), so that one
 * case trades a bit of specificity for not leaking account existence. Every
 * other case here — confirmation pending, expired code, duplicate email,
 * rate limiting — isn't an enumeration risk and gets a real explanation.
 */
export function mapAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
  if (/invalid login credentials/i.test(msg)) return 'Email ou mot de passe incorrect'
  if (/email not confirmed/i.test(msg)) return "Ce compte n'est pas encore confirmé — vérifiez votre email ou demandez un nouveau code"
  if (/already registered|user already exists/i.test(msg)) return 'Un compte existe déjà avec cet email — connectez-vous plutôt'
  if (/token has expired|otp.*(expired|invalid)|invalid.*(otp|token)/i.test(msg)) return 'Code invalide ou expiré — demandez un nouveau code'
  if (/new password should be different/i.test(msg)) return "Le nouveau mot de passe doit être différent de l'ancien"
  if (/password.*(least|character)/i.test(msg) || /at least \d+ characters/i.test(msg)) return 'Le mot de passe doit contenir au moins 8 caractères'
  if (/rate limit|too many requests|429|after \d+ seconds/i.test(msg)) return 'Trop de tentatives — réessayez dans quelques instants'
  if (/unable to validate email address|invalid.*email/i.test(msg)) return 'Adresse email invalide'
  if (/failed to fetch|network/i.test(msg)) return 'Problème de connexion — vérifiez votre réseau et réessayez'
  return msg
}
