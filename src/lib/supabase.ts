import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          country: string | null
          subscription_tier: 'free' | 'basic' | 'pro'
          credits_remaining: number
          is_admin: boolean
          basic_credits_remaining: number
          advanced_credits_remaining: number
          payg_basic_credits: number
          payg_advanced_credits: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          country?: string | null
          subscription_tier?: 'free' | 'basic' | 'pro'
          credits_remaining?: number
          is_admin?: boolean
          basic_credits_remaining?: number
          advanced_credits_remaining?: number
          payg_basic_credits?: number
          payg_advanced_credits?: number
        }
        Update: {
          name?: string | null
          country?: string | null
          subscription_tier?: 'free' | 'basic' | 'pro'
          credits_remaining?: number
          is_admin?: boolean
          basic_credits_remaining?: number
          advanced_credits_remaining?: number
          payg_basic_credits?: number
          payg_advanced_credits?: number
        }
      }
      plans: {
        Row: {
          id: string
          name: string
          display_name: string
          type: 'subscription' | 'payg'
          price_yuan: number
          price_usd: number
          basic_credits: number
          advanced_credits: number
          duration_days: number | null
          is_active: boolean
          is_beta: boolean
          sort_order: number
          metadata: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Plan, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Plan, 'id' | 'created_at'>>
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          status: 'active' | 'expired' | 'cancelled' | 'pending'
          basic_credits_remaining: number
          advanced_credits_remaining: number
          started_at: string
          expires_at: string | null
          auto_renew: boolean
          payment_method: string | null
          created_at: string
        }
        Insert: Omit<Subscription, 'id' | 'created_at'>
        Update: Partial<Omit<Subscription, 'id' | 'user_id' | 'created_at'>>
      }
      payment_transactions: {
        Row: {
          id: string
          user_id: string
          plan_id: string | null
          amount_local: number
          currency: string
          amount_usd: number | null
          payment_method: string | null
          country_code: string | null
          phone_number: string | null
          gateway: string
          gateway_transaction_id: string | null
          status: 'pending' | 'success' | 'failed' | 'refunded'
          webhook_received_at: string | null
          webhook_payload: Record<string, unknown> | null
          created_at: string
        }
        Insert: Omit<PaymentTransaction, 'id' | 'created_at'>
        Update: Partial<Omit<PaymentTransaction, 'id' | 'user_id' | 'created_at'>>
      }
      usage_logs: {
        Row: {
          id: string
          user_id: string
          subscription_id: string | null
          request_type: 'basic' | 'advanced'
          credits_consumed: number
          source: 'subscription' | 'payg'
          feature: string | null
          response_time_ms: number | null
          created_at: string
        }
      }
      system_events: {
        Row: {
          id: string
          user_id: string | null
          event_name: string
          service: string
          status: 'ok' | 'warn' | 'error'
          latency_ms: number | null
          source: string | null
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: Omit<SystemEvent, 'id' | 'created_at'>
        Update: Partial<Omit<SystemEvent, 'id' | 'created_at'>>
      }
      promo_codes: {
        Row: {
          id: string
          code: string
          discount_type: 'percent' | 'fixed_yuan' | 'fixed_usd'
          discount_value: number
          max_uses: number | null
          used_count: number
          valid_until: string | null
          plan_ids: string[] | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<PromoCode, 'id' | 'created_at' | 'used_count'>
        Update: Partial<Omit<PromoCode, 'id' | 'created_at'>>
      }
      exchange_rates: {
        Row: {
          id: string
          base_currency: string
          target_currency: string
          rate: number
          fetched_at: string
        }
      }
      analyses: {
        Row: {
          id: string
          user_id: string
          /** NULL for image-sourced analyses, which have no originating link. */
          product_url: string | null
          product_name: string | null
          supplier_name: string | null
          price: number | null
          moq: number | null
          confidence_score: number | null
          ai_analysis: AIAnalysisResult | null
          raw_product_data: ProductData | null
          data_source: string | null
          ai_source: string | null
          quality_tier: string | null
          fallback_reason: string | null
          created_at: string
        }
      }
      comparisons: {
        Row: {
          id: string
          user_id: string
          analysis_ids: string[]
          winner_analysis_id: string | null
          ai_recommendation: string | null
          created_at: string
        }
      }
      negotiations: {
        Row: {
          id: string
          user_id: string
          analysis_id: string
          target_price: number | null
          strategy: object | null
          messages: object | null
          created_at: string
        }
      }
      erp_clients: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string | null
          phone: string | null
          country: ERPCountry
          city: string | null
          company: string | null
          notes: string | null
          status: 'active' | 'inactive' | 'prospect'
          created_at: string
        }
        Insert: Omit<ERPClient, 'id' | 'created_at'>
        Update: Partial<Omit<ERPClient, 'id' | 'user_id' | 'created_at'>>
      }
      // erp_orders / erp_deliveries: intentionally not duplicated here — this
      // Database['public']['Tables'] block isn't actually used as a generic
      // type param anywhere queries against those two tables run (only the
      // ERPOrder/ERPDelivery interfaces above are), and a second, hand-kept
      // copy had already drifted out of sync with real columns. Edit
      // ERPOrder/ERPDelivery directly instead.
    }
  }
}

// ─── Payment / Billing Types ───────────────────────────────────────────────────
export interface Plan {
  id: string
  name: string
  display_name: string
  type: 'subscription' | 'payg'
  price_yuan: number
  price_usd: number
  basic_credits: number
  advanced_credits: number
  duration_days: number | null
  is_active: boolean
  is_beta: boolean
  sort_order: number
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  status: 'active' | 'expired' | 'cancelled' | 'pending'
  basic_credits_remaining: number
  advanced_credits_remaining: number
  started_at: string
  expires_at: string | null
  auto_renew: boolean
  payment_method: string | null
  created_at: string
}

export interface PaymentTransaction {
  id: string
  user_id: string
  plan_id: string | null
  quote_request_id: string | null
  assistant_plan_id: string | null
  amount_local: number
  currency: string
  amount_usd: number | null
  payment_method: string | null
  country_code: string | null
  phone_number: string | null
  gateway: string
  gateway_transaction_id: string | null
  status: 'pending' | 'success' | 'failed' | 'refunded'
  webhook_received_at: string | null
  webhook_payload: Record<string, unknown> | null
  created_at: string
}

export interface UsageLog {
  id: string
  user_id: string
  subscription_id: string | null
  request_type: 'basic' | 'advanced'
  credits_consumed: number
  source: 'subscription' | 'payg'
  feature: string | null
  response_time_ms: number | null
  created_at: string
}

export interface SystemEvent {
  id: string
  user_id: string | null
  event_name: string
  service: string
  status: 'ok' | 'warn' | 'error'
  latency_ms: number | null
  source: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface PromoCode {
  id: string
  code: string
  discount_type: 'percent' | 'fixed_yuan' | 'fixed_usd'
  discount_value: number
  max_uses: number | null
  used_count: number
  valid_until: string | null
  plan_ids: string[] | null
  is_active: boolean
  created_at: string
}

export interface CreditBalance {
  sub_basic: number
  sub_advanced: number
  payg_basic: number
  payg_advanced: number
  total_basic: number
  total_advanced: number
}

// ─── ERP Types ─────────────────────────────────────────────────────────────────
export type ERPCountry = 'benin' | 'togo' | 'senegal' | 'mali' | 'cote_divoire' | 'niger' | 'cameroun'
export type ERPOrderStatus = 'draft' | 'confirmed' | 'in_production' | 'shipped' | 'in_transit' | 'customs' | 'delivered' | 'cancelled' | 'returned'
export type ERPDeliveryStatus = 'pending' | 'dispatched' | 'in_transit' | 'customs' | 'delivered' | 'returned'

export interface ERPClient {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  country: ERPCountry
  city: string | null
  company: string | null
  notes: string | null
  status: 'active' | 'inactive' | 'prospect'
  created_at: string
}

export interface ERPOrder {
  id: string
  user_id: string
  client_id: string | null
  customer_id: string | null
  order_number: string
  status: ERPOrderStatus
  product_name: string
  product_url: string | null
  quantity: number
  unit_price: number
  currency: string
  total_amount: number
  supplier_name: string | null
  destination_country: ERPCountry
  destination_city: string | null
  payment_method: string | null
  is_paid: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ERPDelivery {
  id: string
  order_id: string
  user_id: string
  tracking_number: string | null
  carrier: string | null
  status: ERPDeliveryStatus
  origin_country: string
  destination_country: ERPCountry
  destination_city: string | null
  estimated_days: number | null
  dispatched_at: string | null
  delivered_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type QuoteRequestStatus = 'pending' | 'reviewing' | 'quoted' | 'accepted' | 'rejected' | 'expired'

export interface QuoteRequest {
  id: string
  customer_id: string
  analysis_id: string | null
  product_name: string
  product_url: string | null
  product_image_url: string | null
  quantity: number
  target_price_cny: number | null
  notes: string | null
  status: QuoteRequestStatus
  quoted_unit_price: number | null
  quoted_currency: string | null
  quoted_total: number | null
  admin_notes: string | null
  quoted_by: string | null
  quoted_at: string | null
  erp_order_id: string | null
  created_at: string
  updated_at: string
}

// ─── BizKey Assistant (WhatsApp) ───────────────────────────────────────────

export type WhatsAppNumberStatus = 'pending' | 'active' | 'inactive'

export interface WhatsAppNumber {
  id: string
  label: string
  phone_number: string
  status: WhatsAppNumberStatus
  business_account_id: string | null
  /** null = BizKey's own number. Admin-assigned via AssistantClients.tsx, kept in sync by a DB trigger. */
  client_id?: string | null
  created_at: string
}

export type WhatsAppConversationStatus = 'open' | 'pending_human' | 'closed'

export type WhatsAppChannel = 'whatsapp' | 'website'

export interface WhatsAppConversation {
  id: string
  number_id: string | null
  customer_phone: string
  customer_name: string | null
  status: WhatsAppConversationStatus
  last_message_at: string
  assigned_to: string | null
  created_at: string
  channel: WhatsAppChannel
  /** null = BizKey's own conversation. */
  client_id?: string | null
}

export type WhatsAppMessageDirection = 'inbound' | 'outbound'
export type WhatsAppSenderType = 'customer' | 'bot' | 'agent'

export interface WhatsAppMessage {
  id: string
  conversation_id: string
  direction: WhatsAppMessageDirection
  sender_type: WhatsAppSenderType
  body: string
  created_at: string
  channel?: WhatsAppChannel
  message_type?: 'text' | 'audio' | 'image' | null
  image_intent?: 'parcel' | 'product' | 'unknown' | null
  tracking_number?: string | null
  carrier?: string | null
  media_url?: string | null
  client_id?: string | null
}

export interface WhatsAppKbArticle {
  id: string
  title: string
  keywords: string[]
  answer: string
  is_active: boolean
  created_at: string
  updated_at: string
  /** null = BizKey's own article (also the one publicly readable on /aide). */
  client_id?: string | null
}

export type WhatsAppTriggerType = 'greeting' | 'keyword' | 'fallback'

export interface WhatsAppAutoReply {
  id: string
  trigger_type: WhatsAppTriggerType
  trigger_value: string | null
  kb_article_id: string | null
  response_text: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  /** null = BizKey's own rule. */
  client_id?: string | null
}

export interface AssistantPlan {
  id: string
  name: string
  display_name: string
  price_yuan: number
  price_usd: number
  price_xof: number
  max_numbers: number
  max_conversations_per_month: number
  features: string[]
  is_active: boolean
  is_popular: boolean
  sort_order: number
  created_at: string
}

export type AssistantClientStatus = 'trial' | 'active' | 'suspended' | 'cancelled' | 'expired'

export type AssistantTone = 'professional' | 'friendly' | 'commercial'

export interface AssistantClient {
  id: string
  company_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  status: AssistantClientStatus
  plan_id: string | null
  whatsapp_number_id: string | null
  profile_id: string | null
  tone: AssistantTone
  business_hours: Record<string, unknown> | null
  requested_whatsapp_number: string | null
  notes: string | null
  /** Set by activate_assistant_subscription / admin_assign_assistant_plan on each activation — null until the business has ever been on a paid plan. */
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

/**
 * `status === 'active'` alone isn't enough to know a subscription is
 * genuinely current — the sync_subscription_status sweep that flips a
 * lapsed client to 'expired' runs hourly (and on login), so there's always
 * a window where the stored status still says 'active' after
 * current_period_end has actually passed. Re-checking the timestamp here
 * closes that window without depending on the sweep having run recently —
 * the same belt-and-suspenders pattern consume_basic_credit/
 * consume_advanced_credit already use on the Sourcing side (they don't
 * trust subscriptions.status alone either). Used by both the route guards
 * that gate access and the sidebar nav that decides whether to show the
 * Assistant tab at all, so the two never disagree.
 */
export function isAssistantSubscriptionLive(client: AssistantClient | null): boolean {
  if (client?.status !== 'active') return false
  if (!client.current_period_end) return true
  return new Date(client.current_period_end) > new Date()
}

export const ERP_COUNTRY_INFO: Record<ERPCountry, {
  label: string; flag: string; capital: string; currency: string;
  avgSeaDays: number; avgAirDays: number; customsDuty: string;
}> = {
  benin:       { label: 'Bénin',          flag: '🇧🇯', capital: 'Cotonou',  currency: 'XOF', avgSeaDays: 35, avgAirDays: 10, customsDuty: '20–35%' },
  togo:        { label: 'Togo',           flag: '🇹🇬', capital: 'Lomé',     currency: 'XOF', avgSeaDays: 35, avgAirDays: 10, customsDuty: '20–35%' },
  senegal:     { label: 'Sénégal',        flag: '🇸🇳', capital: 'Dakar',    currency: 'XOF', avgSeaDays: 30, avgAirDays:  9, customsDuty: '20–30%' },
  mali:        { label: 'Mali',           flag: '🇲🇱', capital: 'Bamako',   currency: 'XOF', avgSeaDays: 42, avgAirDays: 12, customsDuty: '25–40%' },
  cote_divoire:{ label: "Côte d'Ivoire",  flag: '🇨🇮', capital: 'Abidjan',  currency: 'XOF', avgSeaDays: 32, avgAirDays: 10, customsDuty: '20–35%' },
  niger:       { label: 'Niger',          flag: '🇳🇪', capital: 'Niamey',   currency: 'XOF', avgSeaDays: 45, avgAirDays: 14, customsDuty: '25–40%' },
  cameroun:    { label: 'Cameroun',       flag: '🇨🇲', capital: 'Douala',   currency: 'XAF', avgSeaDays: 33, avgAirDays: 10, customsDuty: '20–35%' },
}

export interface ProductData {
  name: string
  price: number
  moq: number
  supplierName: string
  supplierYears: number
  rating?: number
  description: string
  reviews: number
  sales?: number
  images: string[]
  platform?: string
  sourceUrl?: string
  dataSource?: 'onebound' | 'scrapingbee' | 'ai_estimate' | 'fallback' | 'image'
}

export interface AIAnalysisResult {
  confidenceScore: number
  confidenceBreakdown?: {
    positifs: string[]
    negatifs: string[]
  }
  // Legacy
  confidenceReason?: string
  priceAnalysis?: {
    marketAverage: number
    percentageDiff?: number
    evaluation?: string
    targetMin?: number
    targetMax?: number
    // Legacy fields
    comparison?: string
    targetPrice?: number
  }
  warnings: string[]
  contactMessage: string
  contactTranslation?: string
  summary: string
  negotiationTactics?: string[]
  openingOffer?: number
  walkAwayPrice?: number
  // Legacy
  negotiationStrategy?: {
    openingOffer: number
    walkAwayPrice: number
    tactics: string[]
  }
}

