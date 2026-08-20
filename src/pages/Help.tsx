import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SiteNavbar } from '@/components/SiteNavbar'
import { ParticlesBackground } from '@/components/ParticlesBackground'
import { FaqSection, type FaqItem } from '@/components/FaqSection'
import { SiteFooter } from '@/components/SiteFooter'
import { getPublicKbArticles } from '@/lib/db'
import { Reveal } from '@/components/motion/Reveal'

export default function HelpPage() {
  const { t } = useTranslation('help')
  const [items, setItems] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPublicKbArticles()
      .then(articles => setItems(articles.map(a => ({ q: a.title, a: a.answer }))))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNavbar />

      <section className="relative overflow-hidden pt-32 pb-16">
        <ParticlesBackground density={45} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
        <Reveal className="relative max-w-4xl mx-auto w-full px-4 text-center space-y-3">
          <Badge variant="secondary" className="rounded-full mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary mr-1" />
            {t('hero.badge')}
          </Badge>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight">
            {t('hero.titlePrefix')} <span className="text-primary">{t('hero.titleHighlight')}</span> ?
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t('hero.subtitle')}
          </p>
        </Reveal>
      </section>

      <main className="flex-1">
        {loading ? (
          <div className="py-24 text-center text-muted-foreground text-sm">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />
            {t('loading')}
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center max-w-md mx-auto px-4">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">{t('empty.title')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('empty.subtitle')}</p>
          </div>
        ) : (
          <FaqSection
            items={items}
            eyebrow={t('faq.eyebrow')}
            title={<>{t('faq.titlePrefix')} <span className="text-primary">{t('faq.titleHighlight')}</span></>}
            searchable
          />
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
