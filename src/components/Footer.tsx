import { Link } from 'react-router-dom'
import { MessageCircle, Globe, Shield, Zap } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { buildWhatsAppUrl } from '@/lib/whatsapp'

const WHATSAPP_URL = buildWhatsAppUrl("Bonjour BizKey")

const COUNTRIES = ['Bénin', 'Togo', 'Sénégal', 'Mali', "Côte d'Ivoire", 'Niger', 'Cameroun']

export function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-3">
            <Logo variant="lockup" size="md" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Plateforme d'intelligence artificielle pour les importateurs africains.
              Sourcez, analysez et négociez depuis la Chine.
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700 transition font-medium"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp Support
            </a>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Plateforme</h4>
            <ul className="space-y-2">
              {[
                { label: 'Tableau de bord', to: '/app' },
                { label: 'Analyser un produit', to: '/app/analyze' },
                { label: 'Comparer des produits', to: '/app/compare' },
                { label: 'Stratégie de négociation', to: '/app/negotiate' },
                { label: 'Tarifs & Plans', to: '/pricing' },
                { label: 'ERP Commandes', to: '/erp' },
              ].map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-sm text-muted-foreground hover:text-foreground transition">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Countries */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Pays desservis
            </h4>
            <ul className="space-y-1.5">
              {COUNTRIES.map((country) => (
                <li key={country} className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                  {country}
                </li>
              ))}
            </ul>
          </div>

          {/* Features & Legal */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Fonctionnalités</h4>
            <ul className="space-y-2 mb-5">
              {[
                { icon: Zap, label: 'Analyse IA produits' },
                { icon: Shield, label: 'Score de fiabilité fournisseur' },
                { icon: Globe, label: 'Scraping Alibaba, 1688, Taobao' },
                { icon: MessageCircle, label: 'Messages en chinois' },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <item.icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  {item.label}
                </li>
              ))}
            </ul>
            <h4 className="text-sm font-semibold mb-2">Légal</h4>
            <ul className="space-y-1.5">
              {[
                { label: 'Politique de confidentialité', to: '#' },
                { label: "Conditions d'utilisation", to: '#' },
                { label: 'Mentions légales', to: '#' },
              ].map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="text-xs text-muted-foreground hover:text-foreground transition">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} BizKey. Tous droits réservés.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Système opérationnel
            </span>
            <span>Propulsé par Google Gemma 4</span>
            <span>🇧🇯🇹🇬🇸🇳🇲🇱🇨🇮🇳🇪🇨🇲</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
