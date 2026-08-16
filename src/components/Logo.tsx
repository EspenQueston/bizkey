import { Link } from 'react-router-dom'

export interface LogoProps {
  /**
   * 'monogram' — icon square only, no wordmark (e.g. AnalysisResult's badge).
   * 'lockup' — icon + "BizKey" wordmark (the common navbar/sidebar/header case).
   * 'lockup-tagline' — icon + "BizKey — New Vision" (institutional contexts:
   * public footers, the login screen — never forced into dense in-product UI).
   */
  variant?: 'monogram' | 'lockup' | 'lockup-tagline'
  size?: 'sm' | 'md' | 'lg'
  /** ERP panel sidebar header uses a gradient tile instead of a flat one. */
  gradient?: boolean
  /** Wrap the whole thing in a <Link to="/">. Off for AnalysisResult's inert badge use. */
  asLink?: boolean
  /** Icon square gets a hover scale/rotate (SiteNavbar's current effect). */
  animated?: boolean
  className?: string
  /** Extra classes on the wordmark <span>, e.g. 'hidden sm:inline' to collapse to icon-only on mobile. */
  wordClassName?: string
}

const SIZE_MAP = {
  sm: { box: 'h-7 w-7 rounded-lg', text: 'text-xs', word: 'text-sm' },
  md: { box: 'h-8 w-8 rounded-lg', text: 'text-sm', word: 'text-base' },
  lg: { box: 'h-9 w-9 rounded-xl', text: 'text-base', word: 'text-lg' },
} as const

/**
 * Single source of truth for the BizKey mark. Renders the real monogram
 * asset (public/brand/bizkey-monogram.png) — every call site across the app
 * picks up brand-asset changes automatically, nothing else needs touching.
 */
export function Logo({
  variant = 'lockup',
  size = 'lg',
  gradient = false,
  asLink = true,
  animated = false,
  className = '',
  wordClassName = '',
}: LogoProps) {
  const s = SIZE_MAP[size]

  const icon = (
    <div
      className={`${s.box} ${gradient ? 'bg-gradient-to-br from-primary/15 to-primary/5' : ''} grid place-items-center shrink-0 p-1 ${
        animated ? 'transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3' : ''
      }`}
    >
      {/* Light mode uses the newer glossy mark (logo2.png); dark mode keeps
          the original monogram — pure CSS swap, no theme flash. */}
      <img src="/brand/logo2.png" alt="BizKey" className="h-full w-full object-contain drop-shadow-sm dark:hidden" />
      <img src="/brand/bizkey-monogram.png" alt="BizKey" className="hidden h-full w-full object-contain drop-shadow-sm dark:block" />
    </div>
  )

  const content =
    variant === 'monogram' ? (
      icon
    ) : (
      <div className="flex items-center gap-2">
        {icon}
        <span className={`font-serif ${s.word} font-semibold tracking-tight whitespace-nowrap ${wordClassName}`}>
          BizKey
          {variant === 'lockup-tagline' && (
            <span className="text-primary"> — New Vision</span>
          )}
        </span>
      </div>
    )

  if (!asLink) return <div className={className}>{content}</div>

  return (
    <Link to="/" className={`flex items-center shrink-0 ${animated ? 'group' : ''} ${className}`}>
      {content}
    </Link>
  )
}
