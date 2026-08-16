import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Search, ShoppingCart, MessageSquare, UserRound } from 'lucide-react'
import { SearchModeSheet } from '@/components/SearchModeSheet'

const TAB_CLASS = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors ${
    isActive ? 'text-primary' : 'text-muted-foreground'
  }`

/**
 * Fixed 5-tab bottom bar for small screens, matching ERPPanelLayout's lg
 * breakpoint for the sidebar/overlay split. "Messages" points at Négociation
 * for now — the closest existing "communication about a deal" feature — and
 * becomes a real WhatsApp inbox once BizKey Assistant ships. Keeping the tab
 * here means the nav position never has to move later, only what's behind it.
 */
export function MobileBottomNav() {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-card/95 backdrop-blur border-t border-border flex items-stretch px-1 pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/app" end className={TAB_CLASS}>
          <Home className="h-5 w-5" />
          Accueil
        </NavLink>
        <button onClick={() => setSearchOpen(true)} className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium text-muted-foreground">
          <Search className="h-5 w-5" />
          Rechercher
        </button>
        <NavLink to="/app/orders" className={TAB_CLASS}>
          <ShoppingCart className="h-5 w-5" />
          Commandes
        </NavLink>
        <NavLink to="/app/negotiate" className={TAB_CLASS}>
          <MessageSquare className="h-5 w-5" />
          Messages
        </NavLink>
        <NavLink to="/app/profile" className={TAB_CLASS}>
          <UserRound className="h-5 w-5" />
          Compte
        </NavLink>
      </nav>
      <SearchModeSheet open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
