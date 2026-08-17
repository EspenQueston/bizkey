import { Link } from 'react-router-dom'
import { ArrowRight, Search, BarChart3, Users, Truck, Sparkles, CheckCircle, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SiteNavbar } from '@/components/SiteNavbar'
import { ParticlesBackground } from '@/components/ParticlesBackground'
import { FaqSection, type FaqItem } from '@/components/FaqSection'
import { useInView } from '@/hooks/use-in-view'

const SERVICES_FAQ: FaqItem[] = [
  {
    q: "La recherche par image fonctionne-t-elle avec une photo prise au marché ?",
    a: "Oui. Une photo nette du produit suffit, même prise au téléphone dans un marché local. Notre IA identifie le produit sur 1688, Taobao et Alibaba, puis vous renvoie les 3 meilleurs fournisseurs. Évitez simplement les photos floues ou avec plusieurs produits différents dans le cadre.",
  },
  {
    q: "Sur quels critères l'IA sélectionne-t-elle les 3 meilleurs produits ?",
    a: "L'algorithme pondère le volume de ventes, le nombre d'avis clients, les favoris, l'ancienneté du fournisseur sur la plateforme, sa certification, et sa note vendeur (avec un seuil recommandé à 4.0/5). Quand une donnée n'est pas publiée par la plateforme, son poids est redistribué sur les autres critères plutôt que d'être inventé.",
  },
  {
    q: "L'analyse de rentabilité inclut-elle les frais de douane ?",
    a: "L'analyse inclut le prix d'achat, les frais de transport estimés vers votre pays et le prix de revente conseillé. Les droits de douane varient de 20 à 40% selon le pays et la catégorie du produit : nous vous indiquons la fourchette applicable à votre destination pour que vous l'intégriez à votre calcul.",
  },
  {
    q: "Puis-je utiliser vos messages de négociation si je ne parle pas chinois ?",
    a: "C'est précisément l'objectif. Chaque message est généré en mandarin, prêt à être copié-collé dans Alibaba Trade Manager, WeChat ou l'application 1688, avec sa traduction française juste en dessous pour que vous sachiez exactement ce que vous envoyez.",
  },
  {
    q: "Que se passe-t-il si aucune donnée réelle n'est trouvée pour mon lien ?",
    a: "Nous ne fabriquons jamais de fausses données. Si l'API ne récupère pas le produit, le rapport l'indique clairement et vous propose de relancer la recherche par mot-clé ou par image, qui aboutissent dans la grande majorité des cas.",
  },
  {
    q: "Combien de temps prend une analyse complète ?",
    a: "Une analyse standard prend entre 15 et 30 secondes. La recherche des 3 meilleurs produits demande un peu plus de temps car chaque candidat finaliste est vérifié individuellement auprès de la plateforme.",
  },
]
import { SiteFooter } from '@/components/SiteFooter'

const SERVICES = [
  {
    id: '01',
    icon: ImageIcon,
    badge: 'IA — Recherche visuelle',
    title: 'Recherche de fournisseur par image',
    desc: 'Prenez en photo n\'importe quel produit ou envoyez une image depuis votre galerie. Notre IA identifie instantanément le produit sur les plateformes chinoises (1688, Taobao, Alibaba) et vous trouve les meilleurs fournisseurs avec les meilleurs prix.',
    benefits: [
      'Résultats en moins de 30 secondes',
      'TOP 3 fournisseurs recommandés',
      'Comparaison prix unitaire vs lot',
      'Note et avis des fournisseurs inclus',
    ],
    cta: 'Analyser un produit',
    href: '/',
    color: 'from-primary/10 to-primary/5',
  },
  {
    id: '02',
    icon: BarChart3,
    badge: 'IA — Analyse financière',
    title: 'Analyse de rentabilité produit',
    desc: 'Avant d\'investir, sachez exactement combien vous pouvez gagner. Notre IA calcule automatiquement le prix d\'achat, les frais de transport vers votre pays, le prix de revente conseillé et la marge estimée pour chaque produit.',
    benefits: [
      'Calcul automatique de la marge',
      'Frais de transport vers l\'Afrique',
      'Prix de revente conseillé (x2.5–x3)',
      'Verdict IA : Bon / Risque / Déconseillé',
    ],
    cta: 'Analyser la rentabilité',
    href: '/',
    color: 'from-chart-2/10 to-chart-2/5',
  },
  {
    id: '03',
    icon: Users,
    badge: 'Service premium',
    title: 'Sourcing à la demande (agent humain)',
    desc: 'Pour les commandes complexes ou les gros volumes, notre équipe d\'agents basés en Chine prend en charge votre recherche de fournisseur de A à Z. Négociation de prix, vérification du fournisseur, échantillons, contrôle qualité — tout est géré pour vous.',
    benefits: [
      'Agent dédié basé en Chine',
      'Visite physique du fournisseur',
      'Négociation en mandarin pour vous',
      'Contrôle qualité avant expédition',
    ],
    cta: 'Contacter un agent',
    href: '/contact',
    color: 'from-chart-3/10 to-chart-3/5',
  },
  {
    id: '04',
    icon: Truck,
    badge: 'Logistique',
    title: 'Suivi logistique Chine → Afrique',
    desc: 'Votre commande est passée ? On s\'occupe de tout. Dédouanement, fret maritime ou aérien, dernière livraison en Afrique. Vous recevez des notifications à chaque étape et un numéro de tracking international.',
    benefits: [
      'Suivi temps réel disponible',
      'Fret maritime et aérien',
      'Livraison dans 8 pays africains',
      'Gestion douanière incluse',
    ],
    cta: 'En savoir plus',
    href: '/contact',
    color: 'from-chart-4/10 to-chart-4/5',
    comingSoon: false,
  },
]

type Service = (typeof SERVICES)[number]

/**
 * One service presented as a large alternating row: a stat/visual panel on one
 * side, the copy and benefits on the other. Flipping the order every other row
 * keeps a long list from reading as a monotonous stack.
 */
function ServiceRow({ service, index }: { service: Service; index: number }) {
  const { ref, inView } = useInView<HTMLDivElement>()
  const flipped = index % 2 === 1

  return (
    <div
      ref={ref}
      className={`grid lg:grid-cols-2 gap-8 lg:gap-14 items-center reveal ${inView ? 'reveal-visible' : ''}`}
    >
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
    </div>
  )
}

export default function ServicesPage() {
  const hero = useInView<HTMLDivElement>()
  const cta = useInView<HTMLDivElement>()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNavbar />

      <main className="pt-24">
        {/* Hero */}
        <section className="py-20 relative overflow-hidden">
          <ParticlesBackground density={45} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
          <div ref={hero.ref} className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center reveal ${hero.inView ? 'reveal-visible' : ''}`}>
            <Badge variant="secondary" className="rounded-full mb-6">
              <Search className="h-3.5 w-3.5 text-primary mr-1" />
              Nos services
            </Badge>
            <h1 className="font-serif text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Tout ce dont vous avez besoin pour{' '}
              <span className="text-primary">importer depuis la Chine</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              De la recherche du produit jusqu'à la livraison à votre porte — BizKey couvre toute la chaîne du commerce Chine-Afrique.
            </p>
          </div>
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
          eyebrow="Questions sur nos services"
          title={<>Tout savoir sur <span className="text-primary">nos services</span></>}
          subtitle="Recherche par image, analyse de rentabilité, négociation, logistique — voici les réponses aux questions qu'on nous pose le plus."
        />

        {/* CTA */}
        <section className="py-20 bg-primary/5 border-t border-border">
          <div ref={cta.ref} className={`max-w-3xl mx-auto px-4 text-center reveal ${cta.inView ? 'reveal-visible' : ''}`}>
            <h2 className="font-serif text-3xl font-bold mb-4">Commencez dès maintenant — c'est gratuit</h2>
            <p className="text-muted-foreground mb-8">3 analyses gratuites sans inscription requise. Testez la puissance de BizKey.</p>
            <Button asChild size="lg" className="rounded-full gap-2 shadow-xl shadow-primary/25">
              <Link to="/">
                <Sparkles className="h-5 w-5" />
                Analyser un produit gratuitement
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
