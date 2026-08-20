import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { motion, useScroll, useTransform } from "framer-motion"
import { ArrowRight, ShoppingBag, Clock, Globe as Globe2, Wallet, Search, CreditCard, PackageCheck, MessageCircle, ShieldCheck, CircleCheck as CheckCircle2, Truck, Star, Send, Sparkles, Quote, ChevronRight, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SiteNavbar } from "@/components/SiteNavbar"
import { ParticlesBackground } from "@/components/ParticlesBackground"
import { FaqSection, type FaqItem } from "@/components/FaqSection"
import { SiteFooter } from "@/components/SiteFooter"
import { ProductChoiceDialog } from "@/components/ProductChoiceDialog"
import { Reveal, StaggerGrid } from "@/components/motion/Reveal"

// Twinkling accent dots — LIGHT MODE ONLY (wrapped in a dark:hidden parent
// below). Dark mode keeps its previous aurora-only look completely
// untouched, per the standing "never change dark mode" rule.
const HERO_STARS = [
  { top: "10%", left: "8%", delay: 0, gold: false },
  { top: "18%", left: "90%", delay: 0.5, gold: true },
  { top: "34%", left: "3%", delay: 1, gold: false },
  { top: "6%", left: "62%", delay: 1.5, gold: false },
  { top: "48%", left: "95%", delay: 0.25, gold: false },
  { top: "68%", left: "6%", delay: 1.1, gold: true },
  { top: "24%", left: "44%", delay: 0.75, gold: false },
]

function Hero() {
  const { t } = useTranslation('landing')
  const [choiceOpen, setChoiceOpen] = useState(false)
  const [choiceProduct, setChoiceProduct] = useState<"sourcing" | "assistant">("sourcing")
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] })
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 60])
  const contentOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.35])

  function openChoice(product: "sourcing" | "assistant") {
    setChoiceProduct(product)
    setChoiceOpen(true)
  }

  return (
    <section ref={sectionRef} className="relative pt-36 pb-24 overflow-hidden bg-background">
      <ParticlesBackground density={55} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      <div className="aurora-bg opacity-70 dark:opacity-90"><div className="aurora-blob-3" /></div>
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
      <div className="absolute inset-0 hero-glow pointer-events-none" />

      {/* Light-mode-only flourish: a soft breathing golden aura behind the
          headline, plus a scattering of small twinkling dots. Kept faint on
          purpose — this is exactly the kind of "large yellow surface" that
          caused problems before, so it stays a background whisper, not a wash. */}
      <div className="dark:hidden" aria-hidden="true">
        <motion.div
          className="absolute top-24 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(242,201,76,0.16), transparent 70%)", filter: "blur(60px)" }}
          animate={{ opacity: [0.4, 0.75, 0.4], scale: [1, 1.08, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        {HERO_STARS.map((s, i) => (
          <motion.span
            key={i}
            className="absolute h-1 w-1 rounded-full pointer-events-none hidden sm:block"
            style={{
              top: s.top,
              left: s.left,
              background: s.gold ? "var(--primary)" : "var(--foreground)",
              boxShadow: s.gold ? "0 0 5px var(--primary)" : "none",
              opacity: 0.4,
            }}
            animate={{ opacity: [0.1, 0.5, 0.1], scale: [1, 1.6, 1] }}
            transition={{ duration: 3 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: s.delay }}
          />
        ))}
      </div>

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center"
      >
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Badge
            variant="secondary"
            className="rounded-full border border-primary/20 bg-secondary text-secondary-foreground px-4 py-1.5 mb-6"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t('hero.badge')}
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-foreground"
        >
          {t('hero.titleLine1')}{" "}
          <span className="relative inline-block">
            <span className="relative z-10 text-gradient">{t('hero.titleProduct')}</span>
            <span className="absolute left-0 bottom-1 h-3 w-full bg-primary/30 -z-0" />
          </span>{" "}
          {t('hero.titleLine2')}{" "}
          <span className="text-gradient">{t('hero.titleHighlight')}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.32 }}
          className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          {t('hero.subtitle')}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.48 }}
          className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
        >
          {t('hero.twoWays')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.58 }}
          className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Button
            size="lg"
            onClick={() => openChoice("sourcing")}
            className="rounded-full text-base h-14 px-8 shadow-xl shadow-primary/25 group w-full sm:w-auto"
          >
            <Search className="h-5 w-5" />
            {t('hero.ctaSourcing')}
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => openChoice("assistant")}
            className="rounded-full text-base h-14 px-8 group border-[#0A1B33]/20 hover:bg-[#0A1B33]/5 dark:border-white/15 w-full sm:w-auto"
          >
            <Bot className="h-5 w-5" />
            {t('hero.ctaAssistant')}
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.72 }}
          className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Clock className="h-4 w-4 text-primary" />
          {t('hero.responseTime')}
        </motion.div>

        <ProductChoiceDialog open={choiceOpen} onOpenChange={setChoiceOpen} product={choiceProduct} />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto"
        >
          {[
            { icon: ShieldCheck, label: t('hero.trust1') },
            { icon: Truck, label: t('hero.trust2') },
            { icon: MessageCircle, label: t('hero.trust3') },
          ].map((i, k) => (
            <div key={k} className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-3 rounded-xl border border-border bg-card/60">
              <i.icon className="h-4 w-4 text-primary" />
              <span>{i.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  )
}

function Credibility() {
  const { t } = useTranslation('landing')
  const items = [
    { icon: ShoppingBag, value: t('credibility.item1Value'), label: t('credibility.item1Label') },
    { icon: Clock, value: t('credibility.item2Value'), label: t('credibility.item2Label') },
    { icon: Globe2, value: t('credibility.item3Value'), label: t('credibility.item3Label') },
    { icon: Wallet, value: t('credibility.item4Value'), label: t('credibility.item4Label') },
  ]
  return (
    <section className="py-16 border-y border-border bg-card/50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, i) => (
            <div
              key={i}
              className="tilt-card group relative p-6 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-colors"
            >
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/30 transition-all">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="text-2xl font-bold font-serif">{item.value}</div>
              <div className="text-sm text-muted-foreground mt-1 leading-snug">{item.label}</div>
            </div>
          ))}
        </StaggerGrid>
      </div>
    </section>
  )
}

function ValueProps() {
  const { t } = useTranslation('landing')
  const blocs = [
    { icon: Search, title: t('valueProps.item1Title'), text: t('valueProps.item1Text'), tag: t('valueProps.item1Tag') },
    { icon: CreditCard, title: t('valueProps.item2Title'), text: t('valueProps.item2Text'), tag: t('valueProps.item2Tag') },
    { icon: PackageCheck, title: t('valueProps.item3Title'), text: t('valueProps.item3Text'), tag: t('valueProps.item3Tag') },
  ]
  return (
    <section id="valeur" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl mb-16">
          <Badge variant="secondary" className="rounded-full mb-4">{t('valueProps.eyebrow')}</Badge>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            {t('valueProps.title')} <span className="text-gradient">{t('valueProps.titleHighlight')}</span>
          </h2>
        </Reveal>

        <StaggerGrid className="grid md:grid-cols-3 gap-6" step={90}>
          {blocs.map((b, i) => (
            <Card
              key={i}
              className="tilt-card group relative overflow-hidden border-border hover:border-primary/40 transition-colors duration-200 hover:shadow-2xl hover:shadow-primary/10"
            >
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-primary via-chart-2 to-chart-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary grid place-items-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                    <b.icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground bg-muted rounded-full px-3 py-1">
                    0{i + 1}
                  </span>
                </div>
                <Badge variant="outline" className="mb-3 rounded-full text-primary border-primary/30">
                  {b.tag}
                </Badge>
                <h3 className="font-serif text-xl font-semibold tracking-tight mb-3 leading-snug">
                  {b.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{b.text}</p>
              </CardContent>
            </Card>
          ))}
        </StaggerGrid>
      </div>
    </section>
  )
}

function HowItWorks() {
  const { t } = useTranslation('landing')
  const steps = [
    { n: "01", icon: Send, title: t('howItWorks.step1Title'), text: t('howItWorks.step1Text') },
    { n: "02", icon: CheckCircle2, title: t('howItWorks.step2Title'), text: t('howItWorks.step2Text') },
    { n: "03", icon: PackageCheck, title: t('howItWorks.step3Title'), text: t('howItWorks.step3Text') },
  ]
  return (
    <section id="process" className="py-24 bg-secondary/40 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <Reveal className="max-w-2xl mb-16">
          <Badge variant="secondary" className="rounded-full bg-card mb-4">{t('howItWorks.eyebrow')}</Badge>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            {t('howItWorks.title')} <span className="text-gradient">{t('howItWorks.titleHighlight')}</span>
          </h2>
        </Reveal>

        <div className="relative">
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <StaggerGrid className="grid lg:grid-cols-3 gap-6 lg:gap-8 relative" step={90}>
            {steps.map((s, i) => (
              <div
                key={i}
                className="tilt-card glass-card relative p-8 rounded-3xl border border-border hover:border-primary/50 transition-colors duration-200 hover:shadow-2xl hover:shadow-primary/10 group"
              >
                <div className="absolute -top-5 left-8">
                  <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/30 font-serif font-bold text-lg">
                    {s.n}
                  </div>
                </div>
                <div className="pt-6">
                  <div className="h-12 w-12 rounded-xl bg-secondary text-primary grid place-items-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold tracking-tight mb-3">{s.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{s.text}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                    <div className="h-8 w-8 rounded-full bg-card border border-border grid place-items-center">
                      <ChevronRight className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </StaggerGrid>
        </div>
      </div>
    </section>
  )
}

const TESTIMONIAL_META = [
  { name: "Moussa K.", key: "t1", initials: "MK", color: "bg-primary/15 text-primary" },
  { name: "Fatou D.", key: "t2", initials: "FD", color: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  { name: "Ismaël B.", key: "t3", initials: "IB", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { name: "Aïcha S.", key: "t4", initials: "AS", color: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  { name: "Koffi A.", key: "t5", initials: "KA", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { name: "Grace M.", key: "t6", initials: "GM", color: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { name: "Rachidatou O.", key: "t7", initials: "RO", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
] as const

interface Testimonial { text: string; name: string; role: string; initials: string; color: string }

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="shrink-0 w-[320px] sm:w-[380px] h-full"
    >
      <Card className="h-full border-border hover:border-primary/40 hover:shadow-xl transition-[border-color,box-shadow] duration-300">
        <CardContent className="p-8 flex flex-col h-full">
          <Quote className="h-8 w-8 text-primary/30 mb-4" />
          <div className="flex gap-0.5 mb-4">
            {Array.from({ length: 5 }).map((_, j) => (
              <Star key={j} className="h-4 w-4 fill-primary text-primary" />
            ))}
          </div>
          <p className="text-foreground leading-relaxed text-sm italic mb-6 flex-1">
            "{t.text}"
          </p>
          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <Avatar className="h-11 w-11 ring-2 ring-primary/20 shrink-0">
              <AvatarFallback className={`font-semibold ${t.color}`}>
                {t.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{t.name}</div>
              <div className="text-xs text-muted-foreground truncate">{t.role}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function Testimonials() {
  const { t } = useTranslation('landing')
  const testimonials: Testimonial[] = TESTIMONIAL_META.map(m => ({
    name: m.name,
    initials: m.initials,
    color: m.color,
    text: t(`testimonials.${m.key}Text`),
    role: t(`testimonials.${m.key}Role`),
  }))
  // Duplicated so the marquee loop (translateX 0 → -50%) is seamless.
  const track = [...testimonials, ...testimonials]
  return (
    <section id="avis" className="py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mb-14"
        >
          <Badge variant="secondary" className="rounded-full mb-4">{t('testimonials.eyebrow')}</Badge>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            {t('testimonials.title')} <span className="text-gradient">{t('testimonials.titleHighlight')}</span> {t('testimonials.titleSuffix')}
          </h2>
        </motion.div>
      </div>

      {/* Auto-scrolling row, cards flowing in from the right — pauses on
          hover so a review can actually be read, and each card also lifts
          individually on hover. */}
      <div className="relative marquee-viewport">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-32 z-10 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-32 z-10 bg-gradient-to-l from-background to-transparent" />

        <div className="flex gap-6 animate-marquee hover:[animation-play-state:paused] w-max px-4 sm:px-6">
          {track.map((testimonial, i) => (
            <TestimonialCard key={i} t={testimonial} />
          ))}
        </div>
      </div>
    </section>
  )
}

const FAQ_KEYS = ["1", "2", "3", "4", "5", "6"] as const

function Faq() {
  const { t } = useTranslation('landing')
  const items: FaqItem[] = FAQ_KEYS.map(n => ({ q: t(`faq.q${n}`), a: t(`faq.a${n}`) }))
  return <FaqSection items={items} />
}

export default function LandingPage() {
  return (
    <div className="min-h-svh bg-background text-foreground overflow-x-hidden">
      <SiteNavbar />
      <main>
        <Hero />
        <Credibility />
        <ValueProps />
        <HowItWorks />
        <Testimonials />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  )
}
