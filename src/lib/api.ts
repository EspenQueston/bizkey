import { supabase } from './supabase'
import type { AIAnalysisResult, ProductData } from './supabase'

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

// ─── Analyze product via Edge Function ───────────────────────────────────────

export interface AnalyzeResponse {
  success: boolean
  analysis: {
    id: string
    product_url: string
    product_name: string | null
    supplier_name: string | null
    price: number | null
    moq: number | null
    confidence_score: number | null
    ai_analysis: AIAnalysisResult
    raw_product_data: ProductData
    created_at: string
  }
}

export type AnalyzeInput =
  | { type: 'url'; productUrl: string }
  | { type: 'image'; base64: string; fileName: string; mimeType: string }

export async function analyzeProduct(input: AnalyzeInput | string, signal?: AbortSignal): Promise<AnalyzeResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Non authentifié')

  // Backward compat: plain string = URL
  const body: Record<string, unknown> = typeof input === 'string'
    ? { type: 'url', productUrl: input }
    : input

  const response = await fetch(`${EDGE_FUNCTION_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Erreur réseau' }))
    throw new Error(err.error ?? `Erreur ${response.status}`)
  }

  return response.json()
}

// ─── Anonymous free analysis (no auth required) ──────────────────────────────

export interface FreeAnalysisSupplier {
  name: string
  url: string
  price_min: number
  price_max: number
  rating: number
  reviews: number
  moq: number
}

export interface FreeAnalysisReport {
  product_name: string
  category: string
  image_url: string | null
  price_min: number
  price_max: number
  suppliers: FreeAnalysisSupplier[]
  unit_price: number
  bulk_price: number
  moq: number
  sales_volume: string
  avg_rating: number
  total_reviews: number
  trend: 'up' | 'down' | 'stable'
  buy_price: number
  shipping_cost_min: number
  shipping_cost_max: number
  resale_price: number
  margin_percent: number
  verdict: 'good' | 'moderate' | 'bad'
  verdict_reason: string
  best_option: string
  customs_risk: boolean
  counterfeit_risk: boolean
  data_source?: 'api' | 'ai_estimate'
}

export async function analyzeFree(input: { type: 'url'; value: string } | { type: 'image'; base64: string; fileName: string; mimeType: string } | { type: 'keyword'; value: string }): Promise<FreeAnalysisReport> {
  const { data, error } = await supabase.functions.invoke<{ report: FreeAnalysisReport }>('analyze-free', {
    body: input,
  })

  if (error) {
    throw new Error(await getFunctionErrorMessage(error))
  }

  if (!data?.report) {
    throw new Error('Réponse invalide du service d\'analyse')
  }

  return data.report
}

export async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context

  if (context instanceof Response) {
    const payload = await context.clone().json().catch(() => null) as { error?: string; message?: string } | null
    return payload?.error ?? payload?.message ?? `Erreur ${context.status}`
  }

  return error instanceof Error ? error.message : 'Erreur réseau'
}

// ─── Compare analyses via Edge Function ──────────────────────────────────────

export interface CriterionScore {
  key: string
  label: string
  /** 0-100 normalised score for this candidate on this criterion. */
  score: number
  /** Effective weight in percent after redistribution. */
  weight_pct: number
  /** Human-readable raw value, e.g. "¥12.50". */
  display: string
}

export interface ScoredAnalysis {
  analysis_id: string
  product_name: string
  total_score: number
  rank: number
  criteria: CriterionScore[]
  verdict: string
}

export interface CompareResponse {
  success: boolean
  comparison: {
    id: string
    winner_analysis_id: string
    ai_recommendation: string
    /** Deterministic ranking that decided the winner, best-first. */
    scoreboard: ScoredAnalysis[]
  }
}

export async function compareAnalyses(analysisIds: string[]): Promise<CompareResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Non authentifié')

  const response = await fetch(`${EDGE_FUNCTION_URL}/compare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ analysisIds }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Erreur réseau' }))
    throw new Error(err.error ?? `Erreur ${response.status}`)
  }

  return response.json()
}

// ─── Negotiation chat via Edge Function ──────────────────────────────────────

export interface NegotiationChatMessage {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface NegotiateResponse {
  success: boolean
  negotiation: {
    id: string
    messages: NegotiationChatMessage[]
  }
}

async function callNegotiate(body: Record<string, unknown>): Promise<NegotiateResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Non authentifié')

  const response = await fetch(`${EDGE_FUNCTION_URL}/negotiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Erreur réseau' }))
    throw new Error(err.error ?? `Erreur ${response.status}`)
  }

  return response.json()
}

/** Starts a negotiation chat session for an analysis (or resumes the existing one). */
export async function startNegotiationChat(analysisId: string, targetPrice: number): Promise<NegotiateResponse> {
  return callNegotiate({ analysisId, targetPrice })
}

/** Sends a chat message within an existing negotiation session and gets the AI's contextual reply. */
export async function sendNegotiationMessage(negotiationId: string, message: string): Promise<NegotiateResponse> {
  return callNegotiate({ negotiationId, message })
}

// ─── Best-product finder (scored top 3) ───────────────────────────────────────
// Replaces the old unscored "image-search" endpoint — both keyword and image
// search now go through find-best-products so results are always ranked and
// capped at 3, not a raw unranked list.

export interface BestProductMatch {
  offer_id: string
  title: string
  image_url: string
  detail_url: string
  price: number
  moq: number
  supplier_name: string
  supplier_years: number | null
  sales: number
  reviews: number | null
  favorites: number | null
  rating: number | null
  certified: boolean
  match_score: number
  score_breakdown: { label: string; value: string; weight_pct: number }[]
  insight: string
}

export interface FindBestProductsResponse {
  results: BestProductMatch[]
  total_candidates: number
}

export async function findBestProducts(
  input: { type: 'keyword'; value: string } | { type: 'image'; base64: string; mimeType?: string }
): Promise<FindBestProductsResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session) headers['Authorization'] = `Bearer ${session.access_token}`

  const response = await fetch(`${EDGE_FUNCTION_URL}/find-best-products`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Erreur réseau' }))
    throw new Error(err.error ?? `Erreur ${response.status}`)
  }

  return response.json()
}
