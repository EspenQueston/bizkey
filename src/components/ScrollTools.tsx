import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronsUp, ChevronsDown } from 'lucide-react'

/**
 * Fixed bottom-right, stacked above the WhatsApp chat launcher (bottom-5
 * right-5, 56px, z-[60]) rather than sharing its corner exactly — z-30 here
 * is deliberately lower than the chat widget's z-60, so when the chat panel
 * opens it simply covers this widget instead of the two competing for the
 * same pixels.
 */
export function ScrollTools() {
  const [scrollable, setScrollable] = useState(false)
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(false)

  const update = useCallback(() => {
    const doc = document.documentElement
    const scrollY = window.scrollY
    const maxScroll = doc.scrollHeight - doc.clientHeight
    setScrollable(maxScroll > 300)
    setAtTop(scrollY < 24)
    setAtBottom(scrollY >= maxScroll - 24)
  }, [])

  useEffect(() => {
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // Async content (images, data fetches) can grow the page after mount
    // without firing scroll/resize — recheck once things have likely settled
    // rather than leaving a short-page verdict stuck on a page that grew.
    const t = window.setTimeout(update, 800)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.clearTimeout(t)
    }
  }, [update])

  function toTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function toBottom() {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
  }

  return (
    <AnimatePresence>
      {scrollable && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-24 right-5 z-30 flex flex-col gap-2"
        >
          <button
            onClick={toTop}
            disabled={atTop}
            aria-label="Remonter en haut de la page"
            className="h-10 w-10 rounded-full border border-border bg-card shadow-lg grid place-items-center text-muted-foreground transition-all hover:border-primary/40 hover:text-primary hover:-translate-y-0.5 disabled:opacity-30 disabled:pointer-events-none disabled:hover:translate-y-0"
          >
            <ChevronsUp className="h-4 w-4" />
          </button>
          <button
            onClick={toBottom}
            disabled={atBottom}
            aria-label="Descendre en bas de la page"
            className="h-10 w-10 rounded-full border border-border bg-card shadow-lg grid place-items-center text-muted-foreground transition-all hover:border-primary/40 hover:text-primary hover:translate-y-0.5 disabled:opacity-30 disabled:pointer-events-none disabled:hover:translate-y-0"
          >
            <ChevronsDown className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
