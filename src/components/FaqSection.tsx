import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, MessageCircle, HelpCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Reveal } from '@/components/motion/Reveal'

export interface FaqItem {
  q: string
  a: string
}

interface Props {
  items: FaqItem[]
  eyebrow?: string
  title?: React.ReactNode
  subtitle?: string
  /** Show the filter box — worth it past ~5 questions, noise below that. */
  searchable?: boolean
  /** Render the "still have questions" footer CTA. */
  showContactCta?: boolean
  className?: string
}

export function FaqSection({
  items,
  eyebrow = 'FAQ',
  title,
  subtitle,
  searchable,
  showContactCta = true,
  className = '',
}: Props) {
  const [query, setQuery] = useState('')
  const enableSearch = searchable ?? items.length > 5

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(it =>
      it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)
    )
  }, [items, query])

  return (
    <section id="faq" className={`py-24 bg-secondary/40 ${className}`}>
      <Reveal className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="rounded-full bg-card mb-4 gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-primary" />
            {eyebrow}
          </Badge>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight">
            {title ?? <>Questions <span className="text-primary">fréquentes</span></>}
          </h2>
          {subtitle && (
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {enableSearch && (
          <div className="relative max-w-md mx-auto mb-8">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher une question…"
              className="pl-10 h-11 rounded-full bg-card"
              aria-label="Rechercher dans la FAQ"
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-card">
            <p className="font-medium mb-1">Aucune question ne correspond à « {query} »</p>
            <p className="text-sm text-muted-foreground mb-4">
              Reformulez votre recherche ou contactez-nous directement.
            </p>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link to="/contact">Poser ma question</Link>
            </Button>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full space-y-3">
            {filtered.map((it, i) => (
              <AccordionItem
                key={it.q}
                value={`faq-${i}`}
                className="rounded-2xl border border-border bg-card px-5 sm:px-6 transition-all duration-200 hover:border-primary/30 data-[state=open]:border-primary/40 data-[state=open]:shadow-lg data-[state=open]:shadow-primary/5"
              >
                <AccordionTrigger className="text-left font-serif text-base sm:text-lg font-semibold hover:no-underline py-5 gap-3">
                  <span className="flex items-start gap-3">
                    <span className="shrink-0 mt-0.5 h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold grid place-items-center tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {it.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-5 pl-9">
                  {it.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {showContactCta && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Vous ne trouvez pas votre réponse ?</p>
                <p className="text-sm text-muted-foreground">Notre équipe vous répond sous 24h.</p>
              </div>
            </div>
            <Button asChild className="rounded-full shrink-0">
              <Link to="/contact">Nous contacter</Link>
            </Button>
          </div>
        )}
      </Reveal>
    </section>
  )
}
