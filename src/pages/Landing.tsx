import { useRef, useState } from "react"
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
            Agent d'achat Chine — Afrique francophone
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-foreground"
        >
          Commande n'importe quel{" "}
          <span className="relative inline-block">
            <span className="relative z-10 text-gradient">produit</span>
            <span className="absolute left-0 bottom-1 h-3 w-full bg-primary/30 -z-0" />
          </span>{" "}
          depuis la Chine.{" "}
          <span className="text-gradient">Sans parler chinois.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.32 }}
          className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          BizKey est ton agent d'achat basé en Chine — sourcing produit et automatisation WhatsApp, réunis sous une seule plateforme. Tu envoies la photo, on gère le fournisseur, le paiement et la livraison jusqu'à toi.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.48 }}
          className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
        >
          Deux façons de commencer
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
            BizKey Sourcing
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => openChoice("assistant")}
            className="rounded-full text-base h-14 px-8 group border-[#0A1B33]/20 hover:bg-[#0A1B33]/5 dark:border-white/15 w-full sm:w-auto"
          >
            <Bot className="h-5 w-5" />
            BizKey WhatsApp Assistant
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.72 }}
          className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Clock className="h-4 w-4 text-primary" />
          Réponse sous 24h — Sans engagement
        </motion.div>

        <ProductChoiceDialog open={choiceOpen} onOpenChange={setChoiceOpen} product={choiceProduct} />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto"
        >
          {[
            { icon: ShieldCheck, label: "Paiement sécurisé" },
            { icon: Truck, label: "Livraison suivie" },
            { icon: MessageCircle, label: "Support 24h" },
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
  const items = [
    { icon: ShoppingBag, value: "+300", label: "commandes livrées en Afrique francophone" },
    { icon: Clock, value: "Depuis 2024", label: "Agent d'achat actif entre la Chine et l'Afrique" },
    { icon: Globe2, value: "8 pays desservis", label: "Sénégal, Côte d'Ivoire, Cameroun, Guinée, Mali, Togo, RDC, Bénin" },
    { icon: Wallet, value: "Mobile Money", label: "Orange Money, Wave, MTN, Moov acceptés" },
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
  const blocs = [
    {
      icon: Search,
      title: "Tu trouves le produit. On trouve le meilleur prix.",
      text: "Tu n'as plus besoin de naviguer sur 1688 ou Taobao sans rien comprendre. Tu envoies juste une photo ou une description, et on te revient avec le prix du fournisseur, les frais de livraison, et le total à payer — en FCFA ou dans ta devise locale. Zéro surprise, zéro mauvaise traduction.",
      tag: "Transparence totale",
    },
    {
      icon: CreditCard,
      title: "Pas de carte Visa ? Aucun problème.",
      text: "On accepte les paiements via Mobile Money (Orange Money, Wave, MTN, Moov) et les virements locaux. C'est nous qui gérons le paiement au fournisseur chinois. Tu n'as pas besoin de compte bancaire international, ni de carte Visa. Tu paies comme tu paies d'habitude.",
      tag: "Paiement local",
    },
    {
      icon: PackageCheck,
      title: "Ta commande arrive chez toi, sans stress.",
      text: "On gère la vérification du fournisseur, l'expédition depuis la Chine, le suivi en temps réel, et la livraison jusqu'à ton adresse ou ton pays. Tu reçois des photos et vidéos à chaque étape. Plus besoin de te demander \"où est ma commande ?\" — on te tient informé jusqu'à la livraison.",
      tag: "Livraison suivie",
    },
  ]
  return (
    <section id="valeur" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl mb-16">
          <Badge variant="secondary" className="rounded-full mb-4">Pourquoi BizKey</Badge>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Trois problèmes résolus, <span className="text-gradient">zéro galère.</span>
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
  const steps = [
    {
      n: "01",
      icon: Send,
      title: "Envoie ta demande",
      text: "Tu nous envoies la photo ou la description du produit que tu veux sur WhatsApp. On analyse ta demande et on te revient sous 24h avec le prix exact, le délai de livraison, et les détails de la commande.",
    },
    {
      n: "02",
      icon: CheckCircle2,
      title: "Tu confirmes et tu paies",
      text: "Tu valides le devis. Tu paies via Mobile Money ou virement — en toute sécurité. Dès réception du paiement, on passe la commande au fournisseur et on te confirme le démarrage.",
    },
    {
      n: "03",
      icon: PackageCheck,
      title: "Tu reçois ta commande",
      text: "On gère tout : achat, contrôle qualité, expédition, suivi et livraison jusqu'à toi. Tu reçois des updates réguliers et ta commande arrive à ton adresse en Afrique.",
    },
  ]
  return (
    <section id="process" className="py-24 bg-secondary/40 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <Reveal className="max-w-2xl mb-16">
          <Badge variant="secondary" className="rounded-full bg-card mb-4">Comment ça marche</Badge>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Trois étapes. <span className="text-gradient">C'est tout.</span>
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

const TESTIMONIALS = [
  {
    text: "J'avais essayé de commander sur Alibaba tout seul et j'ai perdu 80 000 FCFA dans une arnaque. Avec BizKey, j'ai commandé 50 paires de sneakers pour ma boutique. J'ai tout reçu en 3 semaines, exactement comme sur les photos. Je recommande les yeux fermés.",
    name: "Moussa K.",
    role: "Revendeur de chaussures, Abidjan",
    initials: "MK",
    color: "bg-primary/15 text-primary",
  },
  {
    text: "Ce qui m'a convaincu c'est qu'ils m'ont envoyé des photos du produit avant l'expédition. Je savais exactement ce que j'allais recevoir. J'ai commandé des téléphones reconditionnés et j'ai pu tripler ma mise en les revendant ici à Dakar.",
    name: "Fatou D.",
    role: "Vendeuse en ligne, Dakar",
    initials: "FD",
    color: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  {
    text: "Je n'avais pas de carte Visa, je pensais que c'était impossible de commander depuis la Chine. Ils acceptent Wave — j'ai payé depuis mon téléphone comme d'habitude. Ma commande de cosmétiques est arrivée en moins d'un mois.",
    name: "Ismaël B.",
    role: "Entrepreneur, Douala",
    initials: "IB",
    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    text: "Je gère une petite boutique d'accessoires à Bamako. Avant, un intermédiaire prenait une grosse commission sans jamais montrer les vrais prix. Avec BizKey, je vois le prix fournisseur direct et je paie par Orange Money. Ma dernière commande de 200 coques est arrivée complète.",
    name: "Aïcha S.",
    role: "Gérante de boutique, Bamako",
    initials: "AS",
    color: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
  {
    text: "Je commande en gros pour ma boutique de tissus à Lomé. Ce qui change tout, c'est le suivi : je reçois des vidéos de l'emballage avant l'expédition. Sur ma dernière commande de 300 mètres, j'ai économisé près de 15% par rapport à mon ancien fournisseur local.",
    name: "Koffi A.",
    role: "Grossiste textile, Lomé",
    initials: "KA",
    color: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    text: "Entre gérer ma boutique et répondre aux clients sur WhatsApp toute la journée, je n'avais plus de temps pour sourcer. Depuis BizKey WhatsApp Assistant, les questions fréquentes sont répondues automatiquement et je ne m'occupe que des vraies commandes. Un vrai gain de temps.",
    name: "Grace M.",
    role: "Commerçante, Kinshasa",
    initials: "GM",
    color: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    text: "J'ai commandé des sacs à main pour ma boutique en ligne trois fois maintenant avec BizKey. Chaque fois, le numéro de suivi fonctionne vraiment et je peux dire à mes clientes exactement quand la commande arrive. C'est ça qui m'a fait rester fidèle.",
    name: "Rachidatou O.",
    role: "Boutique en ligne, Cotonou",
    initials: "RO",
    color: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
]

function TestimonialCard({ t }: { t: (typeof TESTIMONIALS)[number] }) {
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
  // Duplicated so the marquee loop (translateX 0 → -50%) is seamless.
  const track = [...TESTIMONIALS, ...TESTIMONIALS]
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
          <Badge variant="secondary" className="rounded-full mb-4">Ils nous font confiance</Badge>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Des commerçants <span className="text-gradient">qui cartonnent</span> grâce à la Chine.
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
          {track.map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </div>
      </div>
    </section>
  )
}

const LANDING_FAQ: FaqItem[] = [
  {
    q: "Est-ce que c'est fiable ? Comment je sais que ce n'est pas une arnaque ?",
    a: "On travaille en totale transparence : tu reçois le nom du fournisseur, des photos du produit avant expédition, et un numéro de suivi dès que ta commande part de Chine. On ne demande jamais d'argent avant de t'avoir fourni un devis détaillé et validé ensemble.",
  },
  {
    q: "Combien ça coûte pour utiliser votre service ?",
    a: "On prend une commission de 5 à 10% sur le montant total de ta commande (produit + livraison). Il n'y a aucun frais caché. Tout est indiqué dans le devis avant que tu confirmes quoi que ce soit.",
  },
  {
    q: "Je n'ai pas beaucoup de capital. Quel est le minimum pour commander ?",
    a: "Tu peux démarrer avec aussi peu que 30 000 à 50 000 FCFA selon le produit. On t'aide à identifier les fournisseurs qui acceptent les petites quantités pour que tu puisses tester avant de commander en gros.",
  },
  {
    q: "Combien de temps prend la livraison en Afrique ?",
    a: "En général, entre 15 et 35 jours selon le pays et la méthode d'expédition choisie. On t'informe du délai exact dans le devis et on te tient au courant à chaque étape.",
  },
  {
    q: "Puis-je payer avec Mobile Money ?",
    a: "Oui. Orange Money, Wave, MTN Mobile Money, Moov Money et T-Money sont acceptés selon ton pays. Aucune carte Visa ni compte bancaire international n'est nécessaire — tu paies depuis ton téléphone comme d'habitude.",
  },
  {
    q: "Que se passe-t-il si le produit reçu ne correspond pas ?",
    a: "On contrôle la marchandise avant expédition et on t'envoie les photos pour validation. Si malgré cela le produit livré ne correspond pas à ce qui a été validé, on prend en charge le litige avec le fournisseur et on te rembourse la part concernée.",
  },
]

function Faq() {
  return <FaqSection items={LANDING_FAQ} />
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
