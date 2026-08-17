import { Link } from 'react-router-dom'

export interface LogoProps {
  /**
   * 'monogram' — icon square only, no wordmark (e.g. AnalysisResult's badge,
   * the ERP sidebar's icon tile). Kept as a real square crop since a wide
   * lockup image doesn't fit those compact contexts.
   * 'lockup' / 'lockup-tagline' — the full brand mark, icon and "BizKey — New
   * Vision" name fused into one image: image.png (navy) in light mode,
   * new-logo.png (gold) in dark mode — navy-on-white reads far better than
   * gold-on-white, while gold is the one that pops on the dark navy body.
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
  sm: 'h-8',
  md: 'h-11',
  lg: 'h-14',
} as const

/**
 * Single source of truth for the BizKey mark. 'monogram' renders the square
 * icon crop (public/brand/logo2.png light / bizkey-monogram.png dark);
 * 'lockup'/'lockup-tagline' render the full lockup image, swapped per theme
 * (public/brand/image.png light / new-logo.png dark).
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
            the original monogram — pure CSS swap, no theme flash.
            width/height are the assets' real pixel dimensions (1254², 1:1):
            CSS still controls the rendered size, but declaring them lets the
            browser reserve the box before the bytes arrive instead of
            reflowing everything around it on load. */}
        <img src="/brand/logo2.png" alt="BizKey" width={1254} height={1254} className="h-full w-full object-contain drop-shadow-sm dark:hidden" />
        <img src="/brand/bizkey-monogram.png" alt="BizKey" width={1254} height={1254} className="hidden h-full w-full object-contain drop-shadow-sm dark:block" />
      </div>
    ) : (
      // aspect-[2/1] pairs with the h-full/w-auto sizing to hold the lockup's
      // horizontal space from first paint. Without it the width starts at 0
      // and snaps to the image's natural ratio once decoded, shoving the nav
      // items beside it sideways — the most visible layout shift on the site,
      // since the logo sits in the header of every page. 1774×887 is the
      // assets' real size, exactly 2:1.
      <span className={`inline-flex items-center ${LOCKUP_HEIGHT_MAP[size]}`}>
        <img
          src="/brand/image.png"
          alt="BizKey — New Vision"
          width={1774}
          height={887}
          className={`h-full w-auto aspect-[2/1] object-contain dark:hidden ${animated ? 'transition-transform duration-300 group-hover:scale-105' : ''}`}
        />
        <img
          src="/brand/new-logo.png"
          alt="BizKey — New Vision"
          width={1774}
          height={887}
          className={`hidden h-full w-auto aspect-[2/1] object-contain dark:block ${animated ? 'transition-transform duration-300 group-hover:scale-105' : ''}`}
        />
      </span>
    )

  if (!asLink) return <div className={className}>{content}</div>

  return (
    <Link to="/" className={`flex items-center shrink-0 ${animated ? 'group' : ''} ${className}`}>
      {content}
    </Link>
  )
}
