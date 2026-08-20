import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Target, Zap, ShieldCheck, Sparkles, Globe2, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SiteNavbar } from '@/components/SiteNavbar'
import { ParticlesBackground } from '@/components/ParticlesBackground'
import { FaqSection, type FaqItem } from '@/components/FaqSection'
import { SiteFooter } from '@/components/SiteFooter'
import { Reveal, StaggerGrid } from '@/components/motion/Reveal'

const TEAM = [
  { initials: 'CL', name: 'Cluivert', location: 'Beijing' },
  { initials: 'AD', name: 'Agent Dev', location: 'Abidjan' },
  { initials: 'SA', name: 'Support Agent', location: 'Dakar' },
]

export default function AboutPage() {
  const { t } = useTranslation('about')

  const ABOUT_FAQ: FaqItem[] = [1, 2, 3, 4, 5].map(n => ({ q: t(`faq.q${n}`), a: t(`faq.a${n}`) }))
  const STATS = [
    { value: '+300', label: t('mission.stat1Label') },
    { value: t('mission.stat2Value'), label: t('mission.stat2Label') },
    { value: '2024', label: t('mission.stat3Label') },
    { value: '100%', label: t('mission.stat4Label') },
  ]
  const VALUES = [
    { icon: ShieldCheck, title: t('values.v1Title'), desc: t('values.v1Desc') },
    { icon: Target, title: t('values.v2Title'), desc: t('values.v2Desc') },
    { icon: Zap, title: t('values.v3Title'), desc: t('values.v3Desc') },
    { icon: TrendingUp, title: t('values.v4Title'), desc: t('values.v4Desc') },
  ]
  const teamRoles = [t('team.m1Role'), t('team.m2Role'), t('team.m3Role')]

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
              <Sparkles className="h-3.5 w-3.5 text-primary mr-1" />
              {t('hero.badge')}
            </Badge>
            <h1 className="font-serif text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              {t('hero.titlePrefix')}{' '}
              <span className="text-primary">BizKey</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {t('hero.subtitle')}
            </p>
          </Reveal>
        </section>

        {/* Mission */}
        <section className="py-16 border-y border-border bg-card/50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="secondary" className="rounded-full mb-4">{t('mission.eyebrow')}</Badge>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-5">
                  {t('mission.title')}
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  {t('mission.p1')}
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {t('mission.p2')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {STATS.map((s, i) => (
                  <div key={i} className="p-5 rounded-2xl border border-border bg-card text-center hover:border-primary/40 hover:-translate-y-1 transition-all duration-200">
                    <div className="font-serif text-3xl font-bold text-primary mb-1">{s.value}</div>
                    <div className="text-sm text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* Story */}
        <section className="py-20">
          <Reveal className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Badge variant="secondary" className="rounded-full mb-6">{t('story.eyebrow')}</Badge>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-8">
              {t('story.title')}
            </h2>
            <div className="space-y-5 text-muted-foreground leading-relaxed">
              <p>{t('story.p1')}</p>
              <p>{t('story.p2')}</p>
              <p>{t('story.p3')}</p>
            </div>
          </Reveal>
        </section>

        {/* Values */}
        <section className="py-20 bg-secondary/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center mb-12">
              <Badge variant="secondary" className="rounded-full bg-card mb-4">{t('values.eyebrow')}</Badge>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">{t('values.title')}</h2>
            </Reveal>
            <StaggerGrid className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {VALUES.map((v, i) => (
                <Card
                  key={i}
                  className="group relative overflow-hidden border-border hover:border-primary/40 transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10"
                >
                  {/* Number watermark reinforces the sequence without extra chrome */}
                  <span className="absolute -right-3 -top-4 text-6xl font-serif font-bold text-primary/[0.07] select-none leading-none">
                    {i + 1}
                  </span>
                  <CardContent className="p-6 relative">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center mb-4 transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/30 group-hover:-rotate-6">
                      <v.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-serif font-semibold text-base mb-2">{v.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                    <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all duration-300 group-hover:w-full" />
                  </CardContent>
                </Card>
              ))}
            </StaggerGrid>
          </div>
        </section>

        {/* Team */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center mb-12">
              <Badge variant="secondary" className="rounded-full mb-4">{t('team.eyebrow')}</Badge>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">{t('team.title')}</h2>
            </Reveal>
            <StaggerGrid className="grid sm:grid-cols-3 gap-6" step={80}>
              {TEAM.map((m, i) => (
                <Card
                  key={i}
                  className="group border-border text-center overflow-hidden hover:border-primary/40 transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10"
                >
                  <CardContent className="p-8 relative">
                    <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Avatar className="h-20 w-20 mx-auto mb-4 ring-4 ring-primary/20 relative transition-all duration-300 group-hover:ring-primary/50 group-hover:scale-105">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                        {m.initials}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="font-serif font-semibold text-base relative">{m.name}</h3>
                    <p className="text-sm text-primary font-medium relative">{teamRoles[i]}</p>
                    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mt-3 px-2.5 py-1 rounded-full bg-secondary relative">
                      <Globe2 className="h-3 w-3" /> {m.location}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </StaggerGrid>
          </div>
        </section>

        {/* CTA */}
        <FaqSection
          items={ABOUT_FAQ}
          eyebrow={t('faq.eyebrow')}
          title={<>{t('faq.titlePrefix')} <span className="text-primary">BizKey</span></>}
          subtitle={t('faq.subtitle')}
        />

        <section className="py-20 bg-primary/5 border-t border-border">
          <Reveal className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="font-serif text-3xl font-bold mb-4">{t('cta.title')}</h2>
            <p className="text-muted-foreground mb-8">{t('cta.subtitle')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="rounded-full gap-2">
                <Link to="/">
                  <Sparkles className="h-5 w-5" />
                  {t('cta.analyze')}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/contact">{t('cta.contact')}</Link>
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
