import { Children, cloneElement, isValidElement } from 'react'
import type { ElementType, ReactNode, ReactElement } from 'react'
import { useInView } from '@/hooks/use-in-view'

/**
 * Scroll-triggered entrance for a section or a group of cards.
 *
 * Wraps the useInView hook + the `.reveal` / `.reveal-visible` CSS pair so
 * pages stop repeating the ref/className incantation by hand. Deliberately
 * CSS-driven rather than Framer Motion: these fire on nearly every section
 * of every page, and a plain class toggle costs no JS per element and no
 * extra bundle weight. Accessibility and the reduced-motion opt-out live in
 * the hook and the stylesheet respectively, so every caller inherits them.
 */
export function Reveal({
  children,
  className = '',
  as: Tag = 'div',
  delay,
}: {
  children: ReactNode
  className?: string
  /** Render as a different element when a plain div would break semantics. */
  as?: ElementType
  /** Milliseconds. Sequences this block against its siblings. */
  delay?: number
}) {
  const { ref, inView } = useInView<HTMLElement>()
  return (
    <Tag
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`reveal ${inView ? 'reveal-visible' : ''} ${className}`}
    >
      {children}
    </Tag>
  )
}

/**
 * A grid whose children arrive in a staggered sweep rather than all at once.
 *
 * One observer watches the container; each child then carries its own
 * `.reveal` class and an incremental transition-delay. That split matters —
 * putting the delay on children while only the *parent* carries `.reveal`
 * (the pattern this replaces) staggers nothing, because the children have
 * no entrance transition to delay. Worse, the stray delay lands on whatever
 * transition the child *does* declare, so a hover effect on the sixth card
 * would sit idle for ~350ms before responding.
 *
 * `step` stays low deliberately: past ~100ms an eight-item grid stops
 * reading as "arriving" and starts reading as "loading slowly".
 */
export function StaggerGrid({
  children,
  className = '',
  step = 70,
}: {
  children: ReactNode
  className?: string
  step?: number
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className={className}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child
        const el = child as ReactElement<{ className?: string; style?: React.CSSProperties }>
        return cloneElement(el, {
          className: `reveal ${inView ? 'reveal-visible' : ''} ${el.props.className ?? ''}`,
          style: { ...el.props.style, transitionDelay: `${i * step}ms` },
        })
      })}
    </div>
  )
}
