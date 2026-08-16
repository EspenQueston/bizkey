import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import { WhatsAppChatWidget } from '@/components/WhatsAppChatWidget'

// Pages
import LandingPage from '@/pages/Landing'
import AboutPage from '@/pages/About'
import ServicesPage from '@/pages/Services'
import ContactPage from '@/pages/Contact'
import HelpPage from '@/pages/Help'
import LoginPage from '@/pages/Login'
import AnalyzePage from '@/pages/Analyze'
import AnalysisResultPage from '@/pages/AnalysisResult'
import PricingPage from '@/pages/Pricing'
import ComparePage from '@/pages/Compare'
import NegotiatePage from '@/pages/Negotiate'
import ProfilePage from '@/pages/Profile'
import SettingsPage from '@/pages/Settings'
import CheckoutPage from '@/pages/Checkout'
import CheckoutAssistantPage from '@/pages/CheckoutAssistant'
import DashboardPricingPage from '@/pages/DashboardPricing'

// Unified ERP Panel
import ERPPanelLayout from '@/pages/erp-panel/ERPPanelLayout'
import ERPPanelDashboard from '@/pages/erp-panel/ERPPanelDashboard'

// Re-use existing admin pages (they work standalone)
import AdminAnalyses from '@/pages/admin/AdminAnalyses'
import AdminTransactions from '@/pages/admin/AdminTransactions'
import AdminUsers from '@/pages/admin/AdminUsers'
import AdminPromoCodes from '@/pages/admin/AdminPromoCodes'
import AdminWebhooks from '@/pages/admin/AdminWebhooks'
import AdminAnalytics from '@/pages/admin/AdminAnalytics'
import AdminAIQuality from '@/pages/admin/AdminAIQuality'

// BizKey Assistant (WhatsApp automation)
import WhatsAppOverview from '@/pages/admin/WhatsAppOverview'
import WhatsAppNumbers from '@/pages/admin/WhatsAppNumbers'
import WhatsAppConversations from '@/pages/admin/WhatsAppConversations'
import WhatsAppKnowledgeBase from '@/pages/admin/WhatsAppKnowledgeBase'
import WhatsAppAutoReplies from '@/pages/admin/WhatsAppAutoReplies'
import AssistantClients from '@/pages/admin/AssistantClients'
import WhatsAppAssistantSettings from '@/pages/assistant/AssistantSettings'
import WhatsAppAssistantBilling from '@/pages/assistant/AssistantBilling'

// Re-use existing ERP pages
import ClientsPage from '@/pages/erp/Clients'
import OrdersPage from '@/pages/erp/Orders'
import DeliveryPage from '@/pages/erp/Delivery'
import QuotesPage from '@/pages/erp/Quotes'
import MyQuotesPage from '@/pages/erp/MyQuotes'
import MyOrdersPage from '@/pages/erp/MyOrders'
import MyDeliveriesPage from '@/pages/erp/MyDeliveries'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(timer)
  }, [loading])

  if (loading && !timedOut) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )
  if (timedOut && !user) return <Navigate to="/login" replace />
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(timer)
  }, [loading])

  if (loading && !timedOut) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  // Straight to the panel root rather than the retired /dashboard path, which
  // would only bounce through an extra redirect to land in the same place.
  if (!profile?.is_admin) return <Navigate to="/app" replace />

  return <>{children}</>
}

/**
 * Guards the WhatsApp Assistant pages that both admin and a subscribed
 * business owner can reach — RLS is what actually scopes the data each of
 * them sees, this just keeps a non-subscriber from landing on an empty page.
 * A business owner needs status 'active' specifically — trial/suspended/
 * cancelled accounts don't get portal access, matching admin's own gating
 * of who counts as a paying client elsewhere.
 */
function AssistantAccessRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, assistantClient, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(timer)
  }, [loading])

  if (loading && !timedOut) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (!profile?.is_admin && assistantClient?.status !== 'active') return <Navigate to="/app" replace />

  return <>{children}</>
}

/**
 * Guards Settings/Billing specifically: these are "manage my own business"
 * pages, meaningless for admin (who isn't a subscriber of their own
 * product) — unlike AssistantAccessRoute, admin does NOT bypass here.
 */
function AssistantOwnerRoute({ children }: { children: React.ReactNode }) {
  const { user, assistantClient, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(timer)
  }, [loading])

  if (loading && !timedOut) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (assistantClient?.status !== 'active') return <Navigate to="/app" replace />

  return <>{children}</>
}

/**
 * Panel landing page. Admins get the operational overview; regular users have
 * no use for MRR and webhooks, so they land straight on the analyze tool.
 */
function PanelHome() {
  const { profile, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }
  return profile?.is_admin ? <ERPPanelDashboard /> : <Navigate to="/app/analyze" replace />
}

/** Same-URL-different-component-per-role, mirroring PanelHome — admins get the full ERP order/delivery management tools, clients get a read-only view scoped to their own orders. */
function OrdersRoute() {
  const { profile } = useAuth()
  return profile?.is_admin ? <OrdersPage /> : <MyOrdersPage />
}
function DeliveryRoute() {
  const { profile } = useAuth()
  return profile?.is_admin ? <DeliveryPage /> : <MyDeliveriesPage />
}

/** Keeps old /analysis/:id links working by carrying the id across. */
function LegacyAnalysisRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/app/analysis/${id}`} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/aide" element={<HelpPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
      <Route path="/checkout-assistant" element={<ProtectedRoute><CheckoutAssistantPage /></ProtectedRoute>} />

      {/* Single authenticated panel. The old /dashboard layout is gone — its
          pages live here, and its own content (analyze widget + recent
          analyses) was dropped because /app/analyze and
          /app/analyses already provided both.

          The guard is authentication, not admin: every signed-in user works
          here. Admin-only pages are individually wrapped in <AdminRoute> and
          their nav entries are hidden, so a regular user keeps their sourcing
          tools instead of losing the product entirely. */}
      <Route path="/app" element={<ProtectedRoute><ERPPanelLayout /></ProtectedRoute>}>
        <Route index element={<PanelHome />} />

        {/* Sourcing — available to every authenticated user */}
        <Route path="analyze" element={<AnalyzePage />} />
        <Route path="analysis/:id" element={<AnalysisResultPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="negotiate" element={<NegotiatePage />} />
        <Route path="quotes" element={<MyQuotesPage />} />

        {/* Orders/delivery — role-branched: admins get the full ERP tools,
            everyone else gets a read-only view of their own orders. */}
        <Route path="orders" element={<OrdersRoute />} />
        <Route path="delivery" element={<DeliveryRoute />} />

        {/* Account */}
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="billing" element={<DashboardPricingPage />} />

        {/* Administration */}
        <Route path="overview" element={<AdminRoute><ERPPanelDashboard /></AdminRoute>} />
        <Route path="analyses" element={<AdminRoute><AdminAnalyses /></AdminRoute>} />
        <Route path="transactions" element={<AdminRoute><AdminTransactions /></AdminRoute>} />
        <Route path="users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="promo" element={<AdminRoute><AdminPromoCodes /></AdminRoute>} />
        <Route path="webhooks" element={<AdminRoute><AdminWebhooks /></AdminRoute>} />
        <Route path="analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
        <Route path="ai-quality" element={<AdminRoute><AdminAIQuality /></AdminRoute>} />
        <Route path="clients" element={<AdminRoute><ClientsPage /></AdminRoute>} />
        <Route path="quote-requests" element={<AdminRoute><QuotesPage /></AdminRoute>} />

        {/* BizKey WhatsApp Assistant — shared by admin (sees every tenant)
            and a subscribed business owner (RLS scopes them to their own
            data automatically); numbers/clients stay admin-only since those
            are the cross-tenant inventory/CRM views. */}
        <Route path="assistant" element={<AssistantAccessRoute><WhatsAppOverview /></AssistantAccessRoute>} />
        <Route path="assistant/numbers" element={<AdminRoute><WhatsAppNumbers /></AdminRoute>} />
        <Route path="assistant/conversations" element={<AssistantAccessRoute><WhatsAppConversations /></AssistantAccessRoute>} />
        <Route path="assistant/knowledge-base" element={<AssistantAccessRoute><WhatsAppKnowledgeBase /></AssistantAccessRoute>} />
        <Route path="assistant/auto-replies" element={<AssistantAccessRoute><WhatsAppAutoReplies /></AssistantAccessRoute>} />
        <Route path="assistant/settings" element={<AssistantOwnerRoute><WhatsAppAssistantSettings /></AssistantOwnerRoute>} />
        <Route path="assistant/billing" element={<AssistantOwnerRoute><WhatsAppAssistantBilling /></AssistantOwnerRoute>} />
        <Route path="assistant/clients" element={<AdminRoute><AssistantClients /></AdminRoute>} />
      </Route>

      {/* Legacy redirects — every old path keeps working */}
      <Route path="/dashboard/pricing" element={<Navigate to="/app/billing" replace />} />
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route path="/dashboard/*" element={<Navigate to="/app" replace />} />
      <Route path="/analyze" element={<Navigate to="/app/analyze" replace />} />
      <Route path="/analysis/:id" element={<LegacyAnalysisRedirect />} />
      <Route path="/compare" element={<Navigate to="/app/compare" replace />} />
      <Route path="/negotiate" element={<Navigate to="/app/negotiate" replace />} />
      <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
      <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
      <Route path="/admin" element={<Navigate to="/app" replace />} />
      <Route path="/admin/*" element={<Navigate to="/app" replace />} />
      <Route path="/erp" element={<Navigate to="/app" replace />} />
      <Route path="/erp/*" element={<Navigate to="/app" replace />} />
      <Route path="/erp-panel" element={<Navigate to="/app" replace />} />
      <Route path="/erp-panel/*" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="bizkey-theme">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <WhatsAppChatWidget />
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
