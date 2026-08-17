import { useCallback, useEffect, useState } from 'react'

/**
 * Returns a ref + whether the element has scrolled into view (once, then stays
 * true). Pair with the `.reveal` / `.reveal-visible` CSS classes.
 *
 * `.reveal` starts at `opacity: 0`, so anything gated on this hook is INVISIBLE
 * until it resolves true. It therefore fails open in every degraded case —
 * no IntersectionObserver, reduced-motion preference, or an observer that never
 * fires (background tab, zero-height parent) — because content silently
 * disappearing is far worse than skipping an entrance animation.
 *
 * `ref` is a callback ref, not a plain `useRef` — deliberately, because a
 * caller that renders a loading state first (e.g. `if (loading) return
 * <Spinner/>`) mounts the real target element on a later render. A plain ref
 * pairs with a one-shot `useEffect` that already ran (and bailed on a null
 * node) by the time that happens, so the observer — and its fail-safe timer
 * — would never be set up at all. A callback ref fires exactly when the node
 * actually attaches, whichever render that turns out to be.
 */
export function useInView<T extends HTMLElement>(threshold = 0.15) {
  const [node, setNode] = useState<T | null>(null)
  const [inView, setInView] = useState(false)
  const ref = useCallback((el: T | null) => setNode(el), [])

  useEffect(() => {
    if (!node) return

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
    observer.observe(node)

    // Last-resort safety net: if the observer hasn't fired by now, reveal
    // anyway rather than leaving the section blank forever.
    const failSafe = window.setTimeout(() => setInView(true), 1500)

    return () => {
      observer.disconnect()
      window.clearTimeout(failSafe)
    }
  }, [node, threshold])

  return { ref, inView }
}
