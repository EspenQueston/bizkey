import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * The browser only restores scroll position automatically on back/forward,
 * not on a fresh navigation — without this, clicking a nav link mid-scroll
 * on one page lands the user mid-scroll on the next. Pathname-only (not the
 * full location) so hash/query changes on the same page don't fight anchor
 * scrolling or filter state.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
