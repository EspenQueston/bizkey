import { Link } from 'react-router-dom'

export interface LogoProps {
  /**
   * 'monogram' — icon square only, no wordmark (e.g. AnalysisResult's badge,
   * the ERP sidebar's icon tile). Kept as a real square crop since a wide
   * lockup image doesn't fit those compact contexts.
   * 'lockup' / 'lockup-tagline' — the full brand mark (public/brand/new-logo.png),
   * icon and "BizKey — New Vision" name fused into one image. Same asset for
   * both, since the wordmark is already baked into the artwork.
   */
  variant?: 'monogram' | 'lockup' | 'lockup-tagline'
  size?: 'sm' | 'md' | 'lg'
  /** ERP panel sidebar header uses a gradient tile instead of a flat one. Monogram-only. */
  gradient?: boolean
  /** Wrap the whole thing in a <Link to="/">. Off for AnalysisResult's inert badge use. */
  asLink?: boolean
  /** Icon square gets a hover scale/rotate (SiteNavbar's current effect). */
  animated?: boolean
  className?: string
  /** Unused for lockup variants now that the name is baked into new-logo.png — kept so existing call sites still type-check. */
  wordClassName?: string
}

const ICON_SIZE_MAP = {
  sm: 'h-7 w-7 rounded-lg',
  md: 'h-8 w-8 rounded-lg',
  lg: 'h-9 w-9 rounded-xl',
} as const

const LOCKUP_HEIGHT_MAP = {
  sm: 'h-7',
  md: 'h-9',
  lg: 'h-11',
} as const

/**
 * Single source of truth for the BizKey mark. 'monogram' renders the square
 * icon crop (public/brand/logo2.png light / bizkey-monogram.png dark);
 * 'lockup'/'lockup-tagline' render the full new-logo.png lockup — same image
 * in both themes, since it's already gold-on-transparent and reads fine on
 * both a light and a navy background.
 */
export function Logo({
  variant = 'lockup',
  size = 'lg',
  gradient = false,
  asLink = true,
  animated = false,
  className = '',
}: LogoProps) {
  const content =
    variant === 'monogram' ? (
      <div
        className={`${ICON_SIZE_MAP[size]} ${gradient ? 'bg-gradient-to-br from-primary/15 to-primary/5' : ''} grid place-items-center shrink-0 p-1 ${
          animated ? 'transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3' : ''
        }`}
      >
        {/* Light mode uses the newer glossy mark (logo2.png); dark mode keeps
            the original monogram — pure CSS swap, no theme flash. */}
        <img src="/brand/logo2.png" alt="BizKey" className="h-full w-full object-contain drop-shadow-sm dark:hidden" />
        <img src="/brand/bizkey-monogram.png" alt="BizKey" className="hidden h-full w-full object-contain drop-shadow-sm dark:block" />
      </div>
    ) : (
      <img
        src="/brand/new-logo.png"
        alt="BizKey — New Vision"
        className={`${LOCKUP_HEIGHT_MAP[size]} w-auto object-contain ${animated ? 'transition-transform duration-300 group-hover:scale-105' : ''}`}
      />
    )

  if (!asLink) return <div className={className}>{content}</div>

  return (
    <Link to="/" className={`flex items-center shrink-0 ${animated ? 'group' : ''} ${className}`}>
      {content}
    </Link>
  )
}
