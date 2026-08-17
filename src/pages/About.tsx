import { Link } from 'react-router-dom'
import { ArrowRight, Target, Zap, ShieldCheck, Sparkles, Globe2, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SiteNavbar } from '@/components/SiteNavbar'
import { ParticlesBackground } from '@/components/ParticlesBackground'
import { FaqSection, type FaqItem } from '@/components/FaqSection'
import { Reveal, StaggerGrid } from '@/components/motion/Reveal'

const ABOUT_FAQ: FaqItem[] = [
  {
    q: "Qui est derrière BizKey ?",
    a: "BizKey a été fondé en 2024 à Beijing par des entrepreneurs travaillant entre la Chine et l'Afrique francophone. L'équipe combine une présence physique en Chine pour le contrôle qualité et des relais à Abidjan et Dakar pour le service client.",
  },
  {
    q: "Êtes-vous un intermédiaire ou une plateforme automatisée ?",
    a: "Les deux. L'IA fait le travail de recherche et d'analyse en quelques secondes, mais des humains basés en Chine vérifient les fournisseurs, contrôlent la marchandise avant expédition et gèrent les litiges. La technologie accélère, elle ne remplace pas la vérification terrain.",
  },
  {
    q: "Comment gagnez-vous de l'argent ?",
    a: "Deux sources : une commission de 5 à 10% sur les commandes que nous gérons de bout en bout, et les abonnements/crédits pour l'usage de la plateforme d'analyse. Nous ne touchons aucune commission cachée de la part des fournisseurs chinois — notre recommandation n'est jamais achetée.",
  },
  {
    q: "Dans quels pays êtes-vous présents ?",
    a: "Nous desservons huit pays d'Afrique francophone : Sénégal, Côte d'Ivoire, Cameroun, Guinée, Mali, Togo, RDC et Bénin. Les moyens de paiement mobile disponibles varient selon le pays.",
  },
  {
    q: "Mes données et mes recherches produits sont-elles confidentielles ?",
    a: "Oui. Vos analyses et l'historique de vos recherches ne sont visibles que par vous, protégés au niveau de la base de données. Nous ne revendons pas vos idées de produits ni vos volumes de commande à des tiers.",
  },
]
import { SiteFooter } from '@/components/SiteFooter'

const STATS = [
  { value: '+300', label: 'Commandes livrées' },
  { value: '8 pays', label: 'Afrique francophone' },
  { value: '2024', label: 'Opérationnel depuis' },
  { value: '100%', label: 'Paiements Mobile Money' },
]

const VALUES = [
  { icon: ShieldCheck, title: 'Transparence', desc: 'Devis détaillés, photos avant expédition, suivi temps réel. Aucune surprise.' },
  { icon: Target, title: 'Accessibilité', desc: 'Mobile Money accepté, petites quantités possibles. Pour tous les entrepreneurs.' },
  { icon: Zap, title: 'Innovation', desc: 'Intelligence artificielle pour trouver les meilleurs fournisseurs en secondes.' },
  { icon: TrendingUp, title: 'Fiabilité', desc: 'Fournisseurs vérifiés, contrôle qualité, remboursement garanti en cas de problème.' },
]

const TEAM = [
  { initials: 'CL', name: 'Cluivert', role: 'Fondateur & CEO', location: 'Beijing' },
  { initials: 'AD', name: 'Agent Dev', role: 'Responsable Sourcing', location: 'Abidjan' },
  { initials: 'SA', name: 'Support Agent', role: 'Service Client', location: 'Dakar' },
]

export default function AboutPage() {
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
              Notre histoire
            </Badge>
            <h1 className="font-serif text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              À propos de{' '}
              <span className="text-primary">BizKey</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Rendre le commerce Chine-Afrique accessible à tous les entrepreneurs africains, quelle que soit leur taille ou leur capital.
            </p>
          </Reveal>
        </section>

        {/* Mission */}
        <section className="py-16 border-y border-border bg-card/50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="secondary" className="rounded-full mb-4">Notre mission</Badge>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-5">
                  Démocratiser l'accès aux produits chinois pour l'Afrique
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Des millions d'entrepreneurs africains souhaitent importer des produits depuis la Chine mais se heurtent à des barrières : la langue, le manque de confiance dans les fournisseurs, l'absence de moyens de paiement internationaux, et la complexité logistique.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  BizKey est né pour briser ces barrières. Grâce à l'intelligence artificielle et à notre réseau de partenaires en Chine et en Afrique, nous rendons le commerce Chine-Afrique aussi simple que d'envoyer un message WhatsApp.
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
            <Badge variant="secondary" className="rounded-full mb-6">Notre histoire</Badge>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-8">
              De l'idée à la plateforme
            </h2>
            <div className="space-y-5 text-muted-foreground leading-relaxed">
              <p>
                BizKey a été fondé en 2024 à Beijing par des entrepreneurs passionnés par le potentiel du commerce Chine-Afrique. L'idée est née d'une frustration simple : trop d'entrepreneurs africains perdaient de l'argent dans des escroqueries sur Alibaba ou ne savaient pas comment démarrer.
              </p>
              <p>
                En combinant notre présence physique en Chine et l'intelligence artificielle de pointe, nous avons développé une plateforme qui permet à n'importe quel entrepreneur africain de trouver le bon fournisseur, d'obtenir un devis transparent, et de payer avec les outils qu'il utilise déjà — Mobile Money, Wave, Orange Money.
              </p>
              <p>
                Aujourd'hui, nous avons accompagné plus de 300 commandes réussies dans 8 pays d'Afrique francophone. Notre objectif est d'en faire 10 000 d'ici 2026, en aidant chaque entrepreneur africain à accéder aux meilleurs produits chinois sans risque et sans barrières.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Values */}
        <section className="py-20 bg-secondary/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center mb-12">
              <Badge variant="secondary" className="rounded-full bg-card mb-4">Nos valeurs</Badge>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">Ce qui nous guide</h2>
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
              <Badge variant="secondary" className="rounded-full mb-4">Notre équipe</Badge>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">Des experts à votre service</h2>
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
                    <p className="text-sm text-primary font-medium relative">{m.role}</p>
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
          eyebrow="Qui sommes-nous"
          title={<>Questions sur <span className="text-primary">BizKey</span></>}
          subtitle="Notre modèle, notre équipe et nos garanties — en toute transparence."
        />

        <section className="py-20 bg-primary/5 border-t border-border">
          <Reveal className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="font-serif text-3xl font-bold mb-4">Prêt à commander depuis la Chine ?</h2>
            <p className="text-muted-foreground mb-8">Testez gratuitement — 3 analyses offertes, sans compte requis.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="rounded-full gap-2">
                <Link to="/">
                  <Sparkles className="h-5 w-5" />
                  Analyser un produit
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/contact">Nous contacter</Link>
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
