import { useState } from 'react'
import { NavLink, Outlet, Navigate, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, Users, CreditCard, Tag, Webhook,
  BarChart3, LogOut, Settings, ShoppingCart, Truck,
  Home, Menu, X, ChevronDown, Search, UserRound,
  GitCompare, MessageSquare, Crown, Building2, FileText,
  Smartphone, BookOpen, Bot, PanelLeftClose, PanelLeftOpen, ArrowUpRight,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { ModeToggle } from '@/components/mode-toggle'
import { Logo } from '@/components/Logo'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface NavItem {
  icon: React.FC<{ className?: string }>
  label: string
  to: string
  end?: boolean
  /** Hidden from non-admins even when the parent section is shared. */
  adminOnly?: boolean
  /** Hidden from admins even when the parent section is shared — for "manage my own business" items that make no sense for the platform operator, who isn't a subscriber of their own product. */
  hideForAdmin?: boolean
}

type NavGroup = 'sourcing' | 'assistant' | 'shared'

interface NavSection {
  title: string
  /** Which product this section belongs to — drives the big collapsible group header rendered above the first section of each group. */
  group: NavGroup
  /** Hidden from non-admins; the routes are guarded independently. */
  adminOnly?: boolean
  /** Visible to admins AND to a subscribed Assistant business owner — everyone else is hidden. Used instead of adminOnly for the shared /app/assistant* pages now that they're multi-tenant. */
  requiresAssistantAccess?: boolean
  /** Hidden from admins — they are never billed. */
  hideForAdmin?: boolean
  /** Skip this section's own collapsible sub-header — used when the group header already names it (e.g. "Système" section inside the "Système" group) and a second identical label would be redundant. */
  flat?: boolean
  items: NavItem[]
}

const GROUP_META: Record<NavGroup, { label: string; icon: React.FC<{ className?: string }>; accent: string }> = {
  sourcing: { label: 'BizKey Sourcing', icon: Search, accent: 'text-primary' },
  assistant: { label: 'BizKey WhatsApp Assistant', icon: Bot, accent: 'text-blue-500 dark:text-blue-400' },
  shared: { label: 'Système', icon: Settings, accent: 'text-muted-foreground' },
}

// Two products under one panel, plus a shared account area that belongs to
// neither: BizKey Sourcing (import assistance) and BizKey WhatsApp Assistant
// (support automation, admin-owned for now — no live WhatsApp Business API
// account exists yet). Gestion ERP is a Sourcing section whose title and
// item visibility both flex with role — Commandes/Livraisons are every
// authenticated user's own order history, while Clients and Demandes de
// devis stay admin-only tools within the same group.
function buildNavSections(isAdmin: boolean): NavSection[] {
  return [
    {
      title: 'Sourcing',
      group: 'sourcing',
      items: [
        { icon: Search,     label: 'Analyser un produit', to: '/app/analyze'   },
        { icon: GitCompare, label: 'Comparer',            to: '/app/compare'   },
        { icon: MessageSquare, label: 'Négociation',      to: '/app/negotiate' },
        { icon: FileText,   label: 'Mes devis',           to: '/app/quotes'    },
      ],
    },
    {
      title: 'Administration',
      group: 'sourcing',
      adminOnly: true,
      items: [
        { icon: LayoutDashboard, label: "Vue d'ensemble",   to: '/app',              end: true },
        { icon: Search,          label: 'Analyses',          to: '/app/analyses'            },
        { icon: BarChart3,       label: 'Analytiques',       to: '/app/analytics'           },
        { icon: BarChart3,       label: 'Qualité IA',        to: '/app/ai-quality'          },
      ],
    },
    {
      title: 'Commercial',
      group: 'sourcing',
      adminOnly: true,
      items: [
        { icon: CreditCard, label: 'Transactions',   to: '/app/transactions' },
        { icon: Tag,        label: 'Codes Promo',    to: '/app/promo'        },
        { icon: Webhook,    label: 'Webhooks',        to: '/app/webhooks'     },
      ],
    },
    {
      title: isAdmin ? 'Gestion ERP' : 'Suivi commandes',
      group: 'sourcing',
      items: [
        { icon: ShoppingCart,  label: 'Commandes',         to: '/app/orders'         },
        { icon: Truck,         label: 'Livraisons',        to: '/app/delivery'       },
        { icon: FileText,      label: 'Demandes de devis', to: '/app/quote-requests', adminOnly: true },
        { icon: Building2,     label: 'Clients',           to: '/app/clients',        adminOnly: true },
      ],
    },
    {
      title: 'Assistant WhatsApp',
      group: 'assistant',
      requiresAssistantAccess: true,
      items: [
        { icon: Bot,        label: "Vue d'ensemble",        to: '/app/assistant',               end: true },
        { icon: Smartphone, label: 'Numéros WhatsApp',      to: '/app/assistant/numbers',        adminOnly: true },
        { icon: MessageSquare, label: 'Conversations',      to: '/app/assistant/conversations'             },
        { icon: BookOpen,   label: 'Base de connaissances', to: '/app/assistant/knowledge-base'            },
        { icon: Bot,        label: 'Réponses automatiques', to: '/app/assistant/auto-replies'              },
        { icon: Settings,   label: 'Réglages',              to: '/app/assistant/settings',       hideForAdmin: true },
        { icon: CreditCard, label: 'Facturation',           to: '/app/assistant/billing',        hideForAdmin: true },
      ],
    },
    {
      title: 'Gestion ERP',
      group: 'assistant',
      adminOnly: true,
      items: [
        { icon: Building2, label: 'Clients', to: '/app/assistant/clients' },
      ],
    },
    {
      title: 'Système',
      group: 'shared',
      adminOnly: true,
      flat: true,
      items: [
        { icon: Users, label: 'Utilisateurs', to: '/app/users' },
      ],
    },
    {
      title: 'Facturation',
      group: 'shared',
      hideForAdmin: true,
      flat: true,
      items: [
        { icon: Crown, label: 'Paiement & plans', to: '/app/billing' },
      ],
    },
    {
      title: 'Mon compte',
      group: 'shared',
      flat: true,
      items: [
        { icon: UserRound, label: 'Mon profil', to: '/app/profile' },
        { icon: Settings,  label: 'Paramètres', to: '/app/settings' },
      ],
    },
  ]
}

/**
 * Avatar button in the top bar. Opens exactly two actions — Profil and
 * Déconnexion — so the admin's account controls are one click away from
 * anywhere in the panel.
 */
function AccountMenu() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const initials = (profile?.name ?? profile?.email ?? 'A').slice(0, 2).toUpperCase()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform hover:scale-105"
          aria-label="Menu du compte"
        >
          <Avatar className="h-8 w-8 ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium truncate">{profile?.name ?? 'Administrateur'}</span>
            <span className="text-xs text-muted-foreground truncate">{profile?.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app/profile" className="cursor-pointer">
            <UserRound className="h-4 w-4" />
            Profil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={handleSignOut}
          className="cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { profile, assistantClient, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Record<NavGroup, boolean>>({ sourcing: false, assistant: false, shared: false })

  async function handleSignOut() {
    await signOut()
    navigate('/')
    onClose?.()
  }

  function toggleSection(title: string) {
    setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }))
  }

  function toggleGroup(group: NavGroup) {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }))
  }

  const isAdmin = profile?.is_admin === true
  // Portal access requires an *activated* plan — trial/suspended/cancelled
  // business owners don't get the Assistant nav, matching AssistantAccessRoute.
  const hasActiveAssistantClient = assistantClient?.status === 'active'

  // BizKey Sourcing stays open to every signed-up user (3 free credits on
  // signup, no subscription required) — this is the deliberate free-trial
  // funnel, so the nav is never hidden for it. Instead the group header
  // just surfaces where the user actually stands: same formula as
  // Analyze.tsx's own "X crédits restants" so the two never disagree.
  const isFreeTier = !isAdmin && (profile?.subscription_tier ?? 'free') === 'free'
  const sourcingCreditsLeft = (profile?.basic_credits_remaining ?? profile?.credits_remaining ?? 0) + (profile?.payg_basic_credits ?? 0)
  const sourcingCreditsExhausted = isFreeTier && sourcingCreditsLeft <= 0

  // Filter by role first (section-level, then per-item), then by the search box.
  const filteredSections = buildNavSections(isAdmin)
    .filter(section => (section.adminOnly ? isAdmin : true))
    .filter(section => (section.requiresAssistantAccess ? (isAdmin || hasActiveAssistantClient) : true))
    .filter(section => (section.hideForAdmin ? !isAdmin : true))
    .map(section => ({
      ...section,
      items: section.items
        .filter(item => (item.adminOnly ? isAdmin : true))
        .filter(item => (item.hideForAdmin ? !isAdmin : true))
        .filter(item => !searchQuery || item.label.toLowerCase().includes(searchQuery.toLowerCase())),
    }))
    .filter(section => section.items.length > 0)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Logo variant="monogram" size="lg" gradient asLink={false} />
            <div>
              <span className="font-semibold text-sm block leading-tight">
                {isAdmin ? 'Espace Admin' : 'Mon espace'}
              </span>
              <span className="text-xs text-muted-foreground">{isAdmin ? 'BizKey Admin' : 'BizKey'}</span>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 lg:hidden">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-secondary/50 border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Nav sections, grouped into three big collapsible accordions: BizKey
          Sourcing, BizKey WhatsApp Assistant, Système. Collapsing a group
          hides every section inside it in one click. */}
      <nav className="flex-1 p-3 space-y-1">
        {(['sourcing', 'assistant', 'shared'] as const).map(group => {
          const groupSections = filteredSections.filter(s => s.group === group)
          if (groupSections.length === 0) return null
          const meta = GROUP_META[group]
          const groupCollapsed = collapsedGroups[group]
          return (
            <div key={group} className="mb-2">
              <button
                onClick={() => toggleGroup(group)}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-secondary/60 hover:bg-secondary transition mb-1"
              >
                <span className={`flex items-center gap-2 text-sm font-bold ${meta.accent}`}>
                  <meta.icon className="h-4 w-4" />
                  {meta.label}
                  {group === 'sourcing' && isFreeTier && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium normal-case ${sourcingCreditsExhausted ? 'text-destructive border-destructive/30' : 'text-muted-foreground border-border'}`}
                    >
                      {sourcingCreditsExhausted ? '0 crédit' : `${sourcingCreditsLeft} crédit${sourcingCreditsLeft > 1 ? 's' : ''}`}
                    </Badge>
                  )}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${groupCollapsed ? '-rotate-90' : ''}`} />
              </button>
              {group === 'sourcing' && sourcingCreditsExhausted && (
                <Link
                  to="/pricing"
                  onClick={onClose}
                  className="flex items-center justify-between px-3 py-2 mb-1 rounded-xl border border-primary/25 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 transition"
                >
                  Crédits épuisés — passer à un forfait payant
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
              {!groupCollapsed && groupSections.map(section => {
                const isCollapsed = !section.flat && collapsedSections[section.title]
                return (
                  <div key={section.title} className="pl-1">
              {!section.flat && (
              <button
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition"
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-sky-400 to-blue-600" />
                  {section.title}
                </span>
                <ChevronDown className={`h-3 w-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
              </button>
              )}
              {!isCollapsed && (
                <div className="space-y-0.5 mt-0.5">
                  {section.items.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group/nav relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-primary/20 to-blue-500/10 text-primary shadow-sm shadow-primary/10'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {/* Vivid active rail makes the current section obvious at a glance */}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-gradient-to-b from-sky-400 to-blue-600 shadow-lg shadow-blue-500/50" />
                          )}
                          <item.icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover/nav:scale-110'}`} />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-border space-y-0.5">
        <NavLink
          to="/"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
        >
          <Home className="h-4 w-4" />
          Accueil
        </NavLink>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </div>
    </div>
  )
}

export default function ERPPanelLayout() {
  const { user, profile, loading } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(() => localStorage.getItem('bizkey_sidebar_hidden') === 'true')
  const location = useLocation()

  function toggleSidebar() {
    setSidebarHidden(prev => {
      const next = !prev
      localStorage.setItem('bizkey_sidebar_hidden', String(next))
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  // Authentication guard only. Redirecting non-admins to /dashboard here would
  // now be an infinite loop, since /dashboard redirects straight back — and the
  // panel is the whole app for regular users. Admin-only pages guard themselves.
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Find current page title. Built with isAdmin=true so admin-only routes
  // still resolve a label here — a non-admin can never reach one anyway,
  // since AdminRoute blocks it before this breadcrumb renders.
  const currentItem = buildNavSections(true).flatMap(s => s.items).find(item =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  )

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col w-64 border-r border-border bg-card fixed top-0 left-0 h-full z-20 transition-transform duration-200 ${sidebarHidden ? '-translate-x-full' : ''}`}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-card border-r border-border z-50 shadow-2xl">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 min-w-0 transition-[margin] duration-200 ${sidebarHidden ? 'lg:ml-0' : 'lg:ml-64'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hidden lg:flex"
              onClick={toggleSidebar}
              title={sidebarHidden ? 'Afficher le menu' : 'Masquer le menu'}
            >
              {sidebarHidden ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            <div className="text-sm">
              <span className="text-muted-foreground">BizKey</span>
              {currentItem && (
                <span className="text-foreground font-semibold"> — {currentItem.label}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:flex gap-1.5 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              En ligne
            </Badge>
            <ModeToggle />
            <AccountMenu />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6 pb-20 lg:pb-6">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav />
    </div>
  )
}
