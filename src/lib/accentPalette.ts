/**
 * Vivid accent palette for the ERP / admin panel.
 *
 * Built around the platform's gold (#D4AF37) primary: `sapphire` is gold's
 * true complement on the colour wheel (~225°) and carries the "hero" role
 * that used to belong to a green accent under the old theme. `amber` and
 * `rose` are the split complements that make gold look richer by contrast,
 * and `violet` / `teal` / `indigo` carry the remaining analytical surfaces.
 * Every entry is a saturated gradient plus a matching glow so tiles read as
 * lit objects instead of flat pastel chips.
 *
 * Tailwind needs literal class strings at build time, so these are written out
 * in full rather than composed from template strings.
 */
export interface Accent {
  /** Saturated gradient for icon tiles. */
  gradient: string
  /** Coloured shadow that makes the tile glow. */
  glow: string
  /** Text colour for figures that should pick up the accent. */
  text: string
  /** Thin top rule used to colour-code a card. */
  bar: string
  /** Soft tinted background for the card body. */
  wash: string
  /** Border tint on hover. */
  ring: string
}

export const ACCENTS = {
  sapphire: {
    gradient: 'bg-gradient-to-br from-blue-400 to-blue-700',
    glow: 'shadow-lg shadow-blue-500/40',
    text: 'text-blue-600 dark:text-blue-400',
    bar: 'bg-gradient-to-r from-blue-400 to-blue-700',
    wash: 'from-blue-500/10 to-transparent',
    ring: 'hover:border-blue-500/50',
  },
  teal: {
    gradient: 'bg-gradient-to-br from-teal-400 to-cyan-600',
    glow: 'shadow-lg shadow-teal-500/40',
    text: 'text-teal-600 dark:text-teal-400',
    bar: 'bg-gradient-to-r from-teal-400 to-cyan-600',
    wash: 'from-teal-500/10 to-transparent',
    ring: 'hover:border-teal-500/50',
  },
  sky: {
    gradient: 'bg-gradient-to-br from-sky-400 to-blue-600',
    glow: 'shadow-lg shadow-sky-500/40',
    text: 'text-sky-600 dark:text-sky-400',
    bar: 'bg-gradient-to-r from-sky-400 to-blue-600',
    wash: 'from-sky-500/10 to-transparent',
    ring: 'hover:border-sky-500/50',
  },
  violet: {
    gradient: 'bg-gradient-to-br from-violet-400 to-purple-600',
    glow: 'shadow-lg shadow-violet-500/40',
    text: 'text-violet-600 dark:text-violet-400',
    bar: 'bg-gradient-to-r from-violet-400 to-purple-600',
    wash: 'from-violet-500/10 to-transparent',
    ring: 'hover:border-violet-500/50',
  },
  amber: {
    gradient: 'bg-gradient-to-br from-amber-400 to-orange-500',
    glow: 'shadow-lg shadow-amber-500/40',
    text: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-gradient-to-r from-amber-400 to-orange-500',
    wash: 'from-amber-500/10 to-transparent',
    ring: 'hover:border-amber-500/50',
  },
  rose: {
    gradient: 'bg-gradient-to-br from-rose-400 to-pink-600',
    glow: 'shadow-lg shadow-rose-500/40',
    text: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-gradient-to-r from-rose-400 to-pink-600',
    wash: 'from-rose-500/10 to-transparent',
    ring: 'hover:border-rose-500/50',
  },
  indigo: {
    gradient: 'bg-gradient-to-br from-indigo-400 to-indigo-700',
    glow: 'shadow-lg shadow-indigo-500/40',
    text: 'text-indigo-600 dark:text-indigo-400',
    bar: 'bg-gradient-to-r from-indigo-400 to-indigo-700',
    wash: 'from-indigo-500/10 to-transparent',
    ring: 'hover:border-indigo-500/50',
  },
} as const satisfies Record<string, Accent>

export type AccentName = keyof typeof ACCENTS
