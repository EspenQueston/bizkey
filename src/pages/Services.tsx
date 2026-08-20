import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Search, BarChart3, Users, Truck, Sparkles, CheckCircle, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SiteNavbar } from '@/components/SiteNavbar'
import { ParticlesBackground } from '@/components/ParticlesBackground'
import { FaqSection, type FaqItem } from '@/components/FaqSection'
import { Reveal } from '@/components/motion/Reveal'
import { SiteFooter } from '@/components/SiteFooter'

const SERVICE_META = [
  { id: '01', key: 's1', icon: ImageIcon, href: '/', color: 'from-primary/10 to-primary/5' },
  { id: '02', key: 's2', icon: BarChart3, href: '/', color: 'from-chart-2/10 to-chart-2/5' },
  { id: '03', key: 's3', icon: Users, href: '/contact', color: 'from-chart-3/10 to-chart-3/5' },
  { id: '04', key: 's4', icon: Truck, href: '/contact', color: 'from-chart-4/10 to-chart-4/5' },
] as const

interface Service {
  id: string
  icon: (typeof SERVICE_META)[number]['icon']
  href: string
  color: string
  badge: string
  title: string
  desc: string
  benefits: string[]
  cta: string
}

/**
 * One service presented as a large alternating row: a stat/visual panel on one
 * side, the copy and benefits on the other. Flipping the order every other row
 * keeps a long list from reading as a monotonous stack.
 */
function ServiceRow({ service, index }: { service: Service; index: number }) {
  const flipped = index % 2 === 1

  return (
    <Reveal className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
      {/* Visual panel */}
      <div className={flipped ? 'lg:order-2' : ''}>
        <div className={`relative rounded-3xl border border-border bg-gradient-to-br ${service.color} p-8 sm:p-10 overflow-hidden group transition-all duration-200 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1`}>
          <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
          <div className="absolute -right-8 -top-8 text-[7rem] font-serif font-bold text-primary/10 select-none leading-none">
            {service.id}
          </div>

          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-background border border-border grid place-items-center shadow-lg mb-6 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
              <service.icon className="h-8 w-8 text-primary" />
            </div>

            <ul className="space-y-2.5">
              {service.benefits.map(b => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="font-medium">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Copy */}
      <div className={flipped ? 'lg:order-1' : ''}>
        <Badge variant="outline" className="rounded-full text-xs border-primary/30 text-primary mb-4">
          {service.badge}
        </Badge>
        <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-4">
          {service.title}
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-7">
          {service.desc}
        </p>
        <Button asChild className="rounded-full gap-2 group/btn" size="lg">
          <Link to={service.href}>
            {service.cta}
            <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
          </Link>
        </Button>
      </div>
    </Reveal>
  )
}

export default function ServicesPage() {
  const { t } = useTranslation('services')

  const SERVICES: Service[] = SERVICE_META.map(m => ({
    id: m.id,
    icon: m.icon,
    href: m.href,
    color: m.color,
    badge: t(`${m.key}.badge`),
    title: t(`${m.key}.title`),
    desc: t(`${m.key}.desc`),
    benefits: [t(`${m.key}.b1`), t(`${m.key}.b2`), t(`${m.key}.b3`), t(`${m.key}.b4`)],
    cta: t(`${m.key}.cta`),
  }))

  const SERVICES_FAQ: FaqItem[] = [1, 2, 3, 4, 5, 6].map(n => ({ q: t(`faq.q${n}`), a: t(`faq.a${n}`) }))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNavbar />

      <main className="pt-24">
        {/* Hero */}
        <section className="py-20 relative overflow-hidden">
          <ParticlesBackground density={45} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
          <Reveal className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
            <Badge variant="secondary" className="rounded-full mb-6">
              <Search className="h-3.5 w-3.5 text-primary mr-1" />
              {t('hero.badge')}
            </Badge>
            <h1 className="font-serif text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              {t('hero.titlePrefix')}{' '}
              <span className="text-primary">{t('hero.titleHighlight')}</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {t('hero.subtitle')}
            </p>
          </Reveal>
        </section>

        {/* Services — alternating showcase, each row revealing on scroll */}
        <section className="py-12 pb-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 sm:space-y-24">
            {SERVICES.map((service, i) => (
              <ServiceRow key={service.id} service={service} index={i} />
            ))}
          </div>
        </section>

        <FaqSection
          items={SERVICES_FAQ}
          eyebrow={t('faq.eyebrow')}
          title={<>{t('faq.titlePrefix')} <span className="text-primary">{t('faq.titleHighlight')}</span></>}
          subtitle={t('faq.subtitle')}
        />

        {/* CTA */}
        <section className="py-20 bg-primary/5 border-t border-border">
          <Reveal className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="font-serif text-3xl font-bold mb-4">{t('cta.title')}</h2>
            <p className="text-muted-foreground mb-8">{t('cta.subtitle')}</p>
            <Button asChild size="lg" className="rounded-full gap-2 shadow-xl shadow-primary/25">
              <Link to="/">
                <Sparkles className="h-5 w-5" />
                {t('cta.button')}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
