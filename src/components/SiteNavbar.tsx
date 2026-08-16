import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, LayoutDashboard, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/contexts/AuthContext'

const NAV_LINKS = [
  { label: 'Accueil', to: '/' },
  { label: 'Services', to: '/services' },
  { label: 'Tarifs', to: '/pricing' },
  { label: 'À propos', to: '/about' },
  { label: 'Aide', to: '/aide' },
  { label: 'Contact', to: '/contact' },
]

export function SiteNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()
  const { pathname } = useLocation()

  function isActive(to: string) {
    if (to === '/') return pathname === '/'
    return pathname.startsWith(to)
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'py-2'
          : 'py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`flex items-center justify-between rounded-2xl transition-all duration-500 ${
            scrolled
              ? 'glass-card shadow-lg shadow-black/5 px-4 h-14'
              : 'bg-transparent px-2 h-16'
          }`}
        >
          {/* Logo */}
          <Logo variant="lockup-tagline" size="lg" animated />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3.5 py-2 rounded-full transition-colors ${
                  isActive(link.to)
                    ? 'text-foreground font-medium bg-secondary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                {link.label}
                {isActive(link.to) && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                )}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <ModeToggle />
            {user ? (
              <Button asChild size="sm" className="rounded-full">
                <Link to="/app">
                  <LayoutDashboard className="h-4 w-4 mr-1.5" />
                  Tableau de bord
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost" className="rounded-full">
                  <Link to="/login">Se connecter</Link>
                </Button>
                <Button asChild size="sm" className="rounded-full gap-1.5 shadow-lg shadow-primary/25">
                  <Link to="/login">
                    <Sparkles className="h-3.5 w-3.5" />
                    Essai gratuit →
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile actions */}
          <div className="flex md:hidden items-center gap-2">
            <ModeToggle />
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="h-9 w-9 rounded-xl border border-border grid place-items-center"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden mt-2 glass-card rounded-2xl shadow-lg shadow-black/5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <nav className="px-3 py-3 space-y-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-xl px-4 py-2.5 text-sm transition-colors ${
                    isActive(link.to)
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 flex flex-col gap-2">
                {user ? (
                  <Button asChild size="sm" className="rounded-full w-full" onClick={() => setMobileOpen(false)}>
                    <Link to="/app">
                      <LayoutDashboard className="h-4 w-4 mr-1.5" />
                      Tableau de bord
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline" size="sm" className="rounded-full w-full" onClick={() => setMobileOpen(false)}>
                      <Link to="/login">Se connecter</Link>
                    </Button>
                    <Button asChild size="sm" className="rounded-full w-full gap-1.5" onClick={() => setMobileOpen(false)}>
                      <Link to="/login">
                        <Sparkles className="h-3.5 w-3.5" />
                        Essai gratuit →
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
