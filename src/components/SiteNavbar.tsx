import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, X, LayoutDashboard, Sparkles, UserRound, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ModeToggle } from '@/components/mode-toggle'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/contexts/AuthContext'

/** Avatar + green "connected" dot, dropdown with profile/dashboard/logout. Only rendered when a session actually exists. */
function AccountMenu() {
  const { t } = useTranslation()
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  const initials = (profile?.name ?? profile?.email ?? user.email ?? 'U').slice(0, 2).toUpperCase()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform hover:scale-105"
          aria-label={t('nav.accountMenu')}
        >
          <Avatar className="h-9 w-9 ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background"
            title={t('nav.connected')}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('nav.connected')}</span>
            {profile?.is_admin && (
              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4">Admin</Badge>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium truncate">{profile?.name ?? t('nav.myAccount')}</span>
            <span className="text-xs text-muted-foreground truncate">{profile?.email ?? user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app" className="cursor-pointer">
            <LayoutDashboard className="h-4 w-4" />
            {t('nav.dashboard')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/profile" className="cursor-pointer">
            <UserRound className="h-4 w-4" />
            {t('nav.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut} className="cursor-pointer">
          <LogOut className="h-4 w-4" />
          {t('nav.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SiteNavbar() {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const NAV_LINKS = [
    { label: t('nav.home'), to: '/' },
    { label: t('nav.services'), to: '/services' },
    { label: t('nav.pricing'), to: '/pricing' },
    { label: t('nav.about'), to: '/about' },
    { label: t('nav.help'), to: '/aide' },
    { label: t('nav.contact'), to: '/contact' },
  ]

  async function handleMobileSignOut() {
    setMobileOpen(false)
    await signOut()
    navigate('/')
  }

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
            <LanguageToggle />
            <ModeToggle />
            {user ? (
              <>
                <Button asChild size="sm" className="rounded-full">
                  <Link to="/app">
                    <LayoutDashboard className="h-4 w-4 mr-1.5" />
                    {t('nav.dashboard')}
                  </Link>
                </Button>
                <AccountMenu />
              </>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost" className="rounded-full">
                  <Link to="/login">{t('nav.login')}</Link>
                </Button>
                <Button asChild size="sm" className="rounded-full gap-1.5 shadow-lg shadow-primary/25">
                  <Link to="/login">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('nav.trial')}
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile actions */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageToggle />
            <ModeToggle />
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="h-9 w-9 rounded-xl border border-border grid place-items-center"
              aria-label={t('nav.menu')}
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
                  <>
                    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-secondary/50 mb-1">
                      <Avatar className="h-9 w-9 ring-2 ring-primary/20 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {(profile?.name ?? profile?.email ?? user.email ?? 'U').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('nav.connected')}</span>
                          {profile?.is_admin && (
                            <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4">Admin</Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">{profile?.name ?? profile?.email ?? user.email}</p>
                      </div>
                    </div>
                    <Button asChild size="sm" className="rounded-full w-full" onClick={() => setMobileOpen(false)}>
                      <Link to="/app">
                        <LayoutDashboard className="h-4 w-4 mr-1.5" />
                        {t('nav.dashboard')}
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="rounded-full w-full" onClick={() => setMobileOpen(false)}>
                      <Link to="/app/profile">
                        <UserRound className="h-4 w-4 mr-1.5" />
                        {t('nav.profile')}
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-full w-full text-destructive hover:text-destructive" onClick={handleMobileSignOut}>
                      <LogOut className="h-4 w-4 mr-1.5" />
                      {t('nav.logout')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="outline" size="sm" className="rounded-full w-full" onClick={() => setMobileOpen(false)}>
                      <Link to="/login">{t('nav.login')}</Link>
                    </Button>
                    <Button asChild size="sm" className="rounded-full w-full gap-1.5" onClick={() => setMobileOpen(false)}>
                      <Link to="/login">
                        <Sparkles className="h-3.5 w-3.5" />
                        {t('nav.trial')}
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
