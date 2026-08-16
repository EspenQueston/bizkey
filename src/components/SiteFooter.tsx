import { Link } from 'react-router-dom'
import { MapPin, Smartphone, Globe } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { buildWhatsAppUrl } from '@/lib/whatsapp'

// WeChat icon
function WeChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-3.915-6.348-7.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.927a.272.272 0 00.14.045c.134 0 .24-.11.24-.245 0-.06-.023-.12-.04-.177l-.325-1.233a.492.492 0 01.177-.554 5.49 5.49 0 002.504-4.604c0-3.516-3.284-6.14-7.063-6.14zM14.5 12.61a.973.973 0 01.97.972.973.973 0 01-.97.972.973.973 0 01-.97-.972.973.973 0 01.97-.972zm4.843 0a.973.973 0 01.97.972.973.973 0 01-.97.972.973.973 0 01-.97-.972.973.973 0 01.97-.972z"/>
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.84a8.17 8.17 0 004.79 1.52V6.9a4.85 4.85 0 01-1.02-.21z"/>
    </svg>
  )
}

const NAV_LINKS = [
  { label: 'Accueil', to: '/' },
  { label: 'Services', to: '/services' },
  { label: 'Tarifs', to: '/pricing' },
  { label: 'À propos', to: '/about' },
  { label: 'Aide', to: '/aide' },
  { label: 'Contact', to: '/contact' },
]

const SOCIAL_LINKS = [
  { icon: WeChatIcon, label: 'WeChat', href: buildWhatsAppUrl(), color: 'hover:text-green-500' },
  { icon: Smartphone, label: 'WhatsApp', href: buildWhatsAppUrl(), color: 'hover:text-green-400' },
  { icon: FacebookIcon, label: 'Facebook', href: 'https://facebook.com', color: 'hover:text-blue-500' },
  { icon: InstagramIcon, label: 'Instagram', href: 'https://instagram.com', color: 'hover:text-pink-500' },
  { icon: TikTokIcon, label: 'TikTok', href: 'https://tiktok.com', color: 'hover:text-foreground' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* Col 1 — Brand */}
        <div className="space-y-4">
          <Logo variant="lockup-tagline" size="lg" />
          <p className="text-muted-foreground leading-relaxed text-xs max-w-[220px]">
            Ton agent d'achat en Chine. Tu envoies une photo, on livre chez toi.
          </p>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} BizKey — All rights reserved
          </p>
        </div>

        {/* Col 2 — Navigation */}
        <div className="space-y-4">
          <p className="font-semibold text-foreground">Navigation</p>
          <ul className="space-y-2">
            {NAV_LINKS.map(link => (
              <li key={link.to}>
                <Link to={link.to} className="text-muted-foreground hover:text-foreground transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3 — Contact */}
        <div className="space-y-4">
          <p className="font-semibold text-foreground">Contact</p>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <span>Beijing, Haidian District, China</span>
            </li>
            <li className="flex items-center gap-2">
              <WeChatIcon className="h-4 w-4 shrink-0 text-green-500" />
              <span>WeChat : bizkey2025</span>
            </li>
            <li className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 shrink-0 text-green-400" />
              <a href={buildWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                WhatsApp
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Globe className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-xs">bizkey.com</span>
            </li>
          </ul>
        </div>

        {/* Col 4 — Social */}
        <div className="space-y-4">
          <p className="font-semibold text-foreground">Réseaux sociaux</p>
          <div className="flex flex-wrap gap-3">
            {SOCIAL_LINKS.map(social => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                title={social.label}
                className={`h-9 w-9 rounded-xl bg-secondary border border-border grid place-items-center text-muted-foreground transition-colors ${social.color}`}
              >
                <social.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
          <div className="mt-4">
            <p className="font-semibold text-foreground mb-2">Légal</p>
            <ul className="space-y-1">
              <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Politique de confidentialité</Link></li>
              <li><Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Conditions d'utilisation</Link></li>
              <li><Link to="/mentions-legales" className="text-muted-foreground hover:text-foreground transition-colors">Mentions légales</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
