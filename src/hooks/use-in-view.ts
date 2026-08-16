import { useEffect, useRef, useState } from 'react'

/**
 * Returns a ref + whether the element has scrolled into view (once, then stays
 * true). Pair with the `.reveal` / `.reveal-visible` CSS classes.
 *
 * `.reveal` starts at `opacity: 0`, so anything gated on this hook is INVISIBLE
 * until it resolves true. It therefore fails open in every degraded case —
 * no IntersectionObserver, reduced-motion preference, or an observer that never
 * fires (background tab, zero-height parent) — because content silently
 * disappearing is far worse than skipping an entrance animation.
 */
export function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Users who asked for reduced motion get the content immediately.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(el)

    // Last-resort safety net: if the observer hasn't fired by now, reveal
    // anyway rather than leaving the section blank forever.
    const failSafe = window.setTimeout(() => setInView(true), 1500)

    return () => {
      observer.disconnect()
      window.clearTimeout(failSafe)
    }
  }, [threshold])

  return { ref, inView }
}
