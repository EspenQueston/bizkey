import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ONEBOUND_KEY = Deno.env.get("ONEBOUND_KEY")
const ONEBOUND_SECRET = Deno.env.get("ONEBOUND_SECRET")

const MAX_RESULTS = 3
const CANDIDATE_POOL_SIZE = 20
const DEEP_VERIFY_COUNT = 6 // how many coarse-ranked candidates get a full item_get lookup

// ─── Types ──────────────────────────────────────────────────────────────────

interface Candidate {
  numIid: string
  title: string
  picUrl: string
  price: number
  sales: number
  detailUrl: string
  certified: boolean // best-effort — see readCertified()
}

interface EnrichedCandidate extends Candidate {
  reviews: number | null
  favorites: number | null
  supplierYears: number | null
  supplierName: string
  rating: number | null
  moq: number
}

interface ScoredProduct {
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
  match_score: number // 0-100
  score_breakdown: { label: string; value: string; weight_pct: number }[]
  insight: string
}

// ─── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })

  try {
    if (!ONEBOUND_KEY || !ONEBOUND_SECRET) {
      return json({ error: "Onebound non configuré" }, 503)
    }

    const body = await req.json()
    const { type, value, base64, mimeType } = body as { type: "keyword" | "image"; value?: string; base64?: string; mimeType?: string }

    let pool: Candidate[]
    if (type === "keyword") {
      const keyword = (value ?? "").trim()
      if (keyword.length < 2) return json({ error: "Mot-clé trop court (2 caractères minimum)" }, 400)
      pool = await searchByKeyword(keyword)
    } else if (type === "image") {
      if (!base64) return json({ error: "Image base64 manquante" }, 400)
      pool = await searchByImage(base64, mimeType ?? "image/jpeg")
    } else {
      return json({ error: "type doit être 'keyword' ou 'image'" }, 400)
    }

    if (pool.length === 0) {
      return json({ results: [], total_candidates: 0 })
    }

    // ── Coarse rank on list-level signal (sales, price sanity) ───────────────
    const coarseRanked = [...pool].sort((a, b) => b.sales - a.sales).slice(0, DEEP_VERIFY_COUNT)

    // ── Deep-verify the coarse finalists via item_get (real reviews/seller data) ──
    const enriched = await Promise.all(coarseRanked.map(enrichCandidate))

    const scored = scoreAndRank(enriched).slice(0, MAX_RESULTS)

    return json({ results: scored, total_candidates: pool.length })
  } catch (err) {
    console.error("find-best-products error:", err)
    return json({ error: err instanceof Error ? err.message : "Erreur interne" }, 500)
  }
})

// ─── Candidate search ───────────────────────────────────────────────────────

async function searchByKeyword(keyword: string): Promise<Candidate[]> {
  const apiUrl = `https://api-gw.onebound.cn/1688global/item_search/?key=${ONEBOUND_KEY}&secret=${ONEBOUND_SECRET}&q=${encodeURIComponent(keyword)}&page=1&page_size=${CANDIDATE_POOL_SIZE}&lang=cn`
  return fetchCandidates(apiUrl)
}

async function searchByImage(base64: string, mimeType: string): Promise<Candidate[]> {
  // Confirmed via live testing: upload_img silently fails (item.name stays
  // null) unless imgcode carries a "data:<mime>;base64," prefix — raw base64
  // alone is rejected without any error_code signal. The response is also
  // nested under items.item, not top-level, which the earlier version read
  // from the wrong path.
  const uploadUrl = `https://api-gw.onebound.cn/1688global/upload_img/?key=${ONEBOUND_KEY}&secret=${ONEBOUND_SECRET}`
  const dataUri = `data:${mimeType || "image/jpeg"};base64,${base64}`
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ imgcode: dataUri }),
    signal: AbortSignal.timeout(20000),
  })
  if (!uploadRes.ok) {
    console.warn("upload_img HTTP error:", uploadRes.status)
    return []
  }
  const uploadData = await uploadRes.json()
  const imgId = uploadData?.items?.item?.name
  if (!imgId) {
    console.warn("upload_img returned no image id:", JSON.stringify(uploadData).slice(0, 300))
    return []
  }

  const apiUrl = `https://api-gw.onebound.cn/1688global/item_search_img/?key=${ONEBOUND_KEY}&secret=${ONEBOUND_SECRET}&imgid=${encodeURIComponent(String(imgId))}&sort=_sale&page=1&page_size=${CANDIDATE_POOL_SIZE}`
  return fetchCandidates(apiUrl)
}

async function fetchCandidates(apiUrl: string): Promise<Candidate[]> {
  try {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BizKeyBot/1.0)" },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = await res.json()
    // deno-lint-ignore no-explicit-any
    const items: any[] = data?.items?.item ?? []

    return items
      .map((item): Candidate | null => {
        const numIid = String(item.num_iid ?? item.offer_id ?? "")
        const title = String(item.title ?? "").trim()
        if (!numIid || !title) return null
        return {
          numIid,
          title: title.slice(0, 200),
          picUrl: fixImageUrl(String(item.pic_url ?? "")),
          price: parseFloat(String(item.promotion_price ?? item.price ?? "0")) || 0,
          sales: parseInt(String(item.sales ?? "0")) || 0,
          detailUrl: String(item.detail_url ?? `https://detail.1688.com/offer/${numIid}.html`),
          certified: readCertified(item),
        }
      })
      .filter((c): c is Candidate => c !== null)
  } catch (err) {
    console.warn("fetchCandidates error:", err)
    return []
  }
}

// ─── Deep verification via item_get ────────────────────────────────────────

async function enrichCandidate(candidate: Candidate): Promise<EnrichedCandidate> {
  const fallback: EnrichedCandidate = {
    ...candidate,
    reviews: null,
    favorites: null,
    supplierYears: null,
    supplierName: "",
    rating: null,
    moq: 1,
  }

  try {
    // 1688's plain "1688" namespace item_get is dead ("接口已停用") — the
    // separate "1688global" namespace works, confirmed live.
    const apiUrl = `https://api-gw.onebound.cn/1688global/item_get/?key=${ONEBOUND_KEY}&secret=${ONEBOUND_SECRET}&num_iid=${encodeURIComponent(candidate.numIid)}&lang=cn&cache=1&async=0`
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BizKeyBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return fallback

    const data = await res.json()
    const item = data?.item ?? data?.result ?? null
    if (!item) return fallback

    // Real field names confirmed via live testing: seller_info.composite_score
    // (0-5 scale) is the actual rating field — item_rating/score/dsr_score
    // don't exist on this endpoint. sales_info.comment_num is the reviews
    // path, though many listings leave it empty. No real "favorites" or
    // "years on platform" field is exposed — stay null (honest) rather than
    // read field names that don't exist in the actual response.
    const sellerInfo = item.seller_info ?? item.company_info ?? {}
    const salesInfo = item.sales_info ?? {}

    const reviews = firstFiniteNumber(salesInfo.comment_num, item.comment_count, item.comment_num)
    const favorites = firstFiniteNumber(item.collect_num, item.favitem_count, item.wants_count)
    const supplierYears = firstFiniteNumber(sellerInfo.experience, sellerInfo.years, sellerInfo.member_years)
    const rating = firstFiniteNumber(sellerInfo.composite_score, sellerInfo.item_score)
    const moq = parseInt(String(item.min_order ?? item.min_num ?? "1").match(/(\d+)/)?.[1] ?? "1") || 1
    // NOTE: seller_info.zhuy is confirmed (via live testing) to be a URL, not
    // a name — deliberately excluded here.
    const supplierName = String(sellerInfo.shop_name || sellerInfo.title || sellerInfo.company_name || item.nick || "").slice(0, 100)

    return {
      ...candidate,
      certified: candidate.certified || readCertified(item) || readCertified(sellerInfo),
      reviews,
      favorites,
      supplierYears,
      supplierName,
      rating: rating !== null ? Math.min(5, rating) : null,
      moq,
    }
  } catch (err) {
    console.warn(`enrichCandidate(${candidate.numIid}) error:`, err)
    return fallback
  }
}

/** Best-effort read of a "verified/certified supplier" flag across the field names 1688-gateway payloads commonly use. Returns false (never fabricated true) when absent. */
// deno-lint-ignore no-explicit-any
function readCertified(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false
  return Boolean(
    obj.is_jxhy === true || obj.is_jxhy === "true" ||
    obj.tp_member === true || obj.tp_member === "true" ||
    obj.trade_assurance === true || obj.trade_assurance === "true" ||
    obj.is_supplier_cert === true || obj.is_supplier_cert === "true" ||
    obj.gold_supplier === true,
  )
}

function firstFiniteNumber(...values: unknown[]): number | null {
  for (const v of values) {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""))
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

// ─── Scoring ────────────────────────────────────────────────────────────────
//
// Weighted composite score built from whatever real signal Onebound actually
// returns for each candidate. Onebound's search endpoints only return
// sales/price; item_get (called above for the top few candidates) adds
// reviews, seller tenure and rating when the listing has them — favorites
// and "certified" flags aren't guaranteed present on every listing. Rather
// than fabricate values for missing factors, each factor's weight is
// redistributed proportionally across whatever factors DO have data across
// the candidate batch, so the score stays meaningful either way.

const FACTOR_WEIGHTS = {
  sales: 25,
  reviews: 20,
  rating: 15,
  supplierYears: 15,
  favorites: 10,
  certified: 10,
  price: 5,
} as const

function scoreAndRank(candidates: EnrichedCandidate[]): ScoredProduct[] {
  if (candidates.length === 0) return []

  const salesNorm = normalizeLog(candidates.map((c) => c.sales))
  const reviewsNorm = normalizeLogNullable(candidates.map((c) => c.reviews))
  const favoritesNorm = normalizeLogNullable(candidates.map((c) => c.favorites))
  const yearsNorm = candidates.map((c) => (c.supplierYears !== null ? Math.min(1, c.supplierYears / 10) * 100 : null))
  const ratingNorm = candidates.map((c) => (c.rating !== null ? scoreRating(c.rating) : null))
  const priceNorm = normalizePriceCompetitiveness(candidates.map((c) => c.price))
  const certifiedNorm = candidates.map((c) => (c.certified ? 100 : 0))

  const hasAnyData = (values: (number | null)[]) => values.some((v) => v !== null)

  const activeWeights: Partial<Record<keyof typeof FACTOR_WEIGHTS, number>> = {
    sales: FACTOR_WEIGHTS.sales, // always present
    price: FACTOR_WEIGHTS.price, // always present
  }
  if (hasAnyData(reviewsNorm)) activeWeights.reviews = FACTOR_WEIGHTS.reviews
  if (hasAnyData(favoritesNorm)) activeWeights.favorites = FACTOR_WEIGHTS.favorites
  if (hasAnyData(yearsNorm)) activeWeights.supplierYears = FACTOR_WEIGHTS.supplierYears
  if (hasAnyData(ratingNorm)) activeWeights.rating = FACTOR_WEIGHTS.rating
  if (candidates.some((c) => c.certified)) activeWeights.certified = FACTOR_WEIGHTS.certified

  const totalActiveWeight = Object.values(activeWeights).reduce((a, b) => a + (b ?? 0), 0)
  const scale = totalActiveWeight > 0 ? 100 / totalActiveWeight : 1

  const results = candidates.map((c, i) => {
    const parts: { key: keyof typeof FACTOR_WEIGHTS; value: number | null; label: string; display: string }[] = [
      { key: "sales", value: salesNorm[i], label: "Ventes", display: `${c.sales.toLocaleString()} ventes` },
      { key: "reviews", value: reviewsNorm[i], label: "Avis clients", display: c.reviews !== null ? `${c.reviews.toLocaleString()} avis` : "non communiqué" },
      { key: "rating", value: ratingNorm[i], label: "Note vendeur", display: c.rating !== null ? `${c.rating.toFixed(1)}/5` : "non communiquée" },
      { key: "supplierYears", value: yearsNorm[i], label: "Ancienneté fournisseur", display: c.supplierYears !== null ? `${c.supplierYears} an(s)` : "non communiquée" },
      { key: "favorites", value: favoritesNorm[i], label: "Favoris", display: c.favorites !== null ? `${c.favorites.toLocaleString()} favoris` : "non communiqué" },
      { key: "certified", value: certifiedNorm[i], label: "Certification plateforme", display: c.certified ? "Vérifié" : "non vérifié" },
      { key: "price", value: priceNorm[i], label: "Compétitivité prix", display: `¥${c.price.toFixed(2)}` },
    ]

    let weightedSum = 0
    const breakdown: ScoredProduct["score_breakdown"] = []
    for (const part of parts) {
      const weight = activeWeights[part.key]
      if (weight === undefined) continue
      const value = part.value ?? 0
      weightedSum += (value / 100) * weight
      breakdown.push({ label: part.label, value: part.display, weight_pct: Math.round(weight * scale) })
    }

    const matchScore = Math.round(Math.min(100, weightedSum * scale))

    const product: ScoredProduct = {
      offer_id: c.numIid,
      title: c.title,
      image_url: c.picUrl,
      detail_url: c.detailUrl,
      price: c.price,
      moq: c.moq,
      supplier_name: c.supplierName || "Fournisseur 1688",
      supplier_years: c.supplierYears,
      sales: c.sales,
      reviews: c.reviews,
      favorites: c.favorites,
      rating: c.rating,
      certified: c.certified,
      match_score: matchScore,
      score_breakdown: breakdown.sort((a, b) => b.weight_pct - a.weight_pct),
      insight: buildInsight(c),
    }
    return product
  })

  return results.sort((a, b) => b.match_score - a.match_score)
}

/**
 * One-sentence, deterministic takeaway built from the candidate's own real
 * signals (no AI call — every clause maps to a field that was actually
 * returned by Onebound). Leads with the strongest real strengths, then
 * flags the seller-rating pass/fail against the 4.0/5 bar, then flags a
 * genuine data gap if reviews/favorites are both unavailable.
 */
function buildInsight(c: EnrichedCandidate): string {
  const strengths: string[] = []
  if (c.sales >= 100) strengths.push(`${c.sales.toLocaleString()} ventes déjà réalisées`)
  if (c.reviews !== null && c.reviews >= 10) strengths.push(`${c.reviews.toLocaleString()} avis clients`)
  if (c.favorites !== null && c.favorites >= 50) strengths.push(`${c.favorites.toLocaleString()} favoris`)
  if (c.certified) strengths.push("fournisseur certifié sur la plateforme")
  if (c.supplierYears !== null && c.supplierYears >= 2) strengths.push(`${c.supplierYears} ans d'ancienneté`)

  let ratingClause: string
  if (c.rating !== null) {
    ratingClause = c.rating >= 4.0
      ? `note vendeur ${c.rating.toFixed(1)}/5 (au-dessus du seuil recommandé de 4.0)`
      : `⚠ note vendeur ${c.rating.toFixed(1)}/5 — sous le seuil recommandé de 4.0, à négocier avec prudence`
  } else {
    ratingClause = "note vendeur non communiquée par la plateforme"
  }

  const parts: string[] = []
  if (strengths.length > 0) {
    parts.push(strengths.slice(0, 2).join(" et "))
  }
  parts.push(ratingClause)
  if (c.reviews === null && c.favorites === null) {
    parts.push("peu de retours clients visibles, demandez des photos réelles avant commande")
  }

  const sentence = parts.join(", ")
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + "."
}

/** Seller rating scoring: the platform's own "above 4.0/5" bar is the pass line — below it is penalized more steeply than a linear scale would. */
function scoreRating(rating: number): number {
  if (rating >= 4.0) return 70 + ((rating - 4.0) / 1.0) * 30 // 4.0->70, 5.0->100
  return (rating / 4.0) * 70 // steep dropoff below the 4.0 bar
}

function normalizeLog(values: number[]): number[] {
  const logs = values.map((v) => Math.log1p(Math.max(0, v)))
  const min = Math.min(...logs)
  const max = Math.max(...logs)
  if (max === min) return values.map(() => 100)
  return logs.map((v) => ((v - min) / (max - min)) * 100)
}

function normalizeLogNullable(values: (number | null)[]): (number | null)[] {
  const present = values.filter((v): v is number => v !== null)
  if (present.length === 0) return values.map(() => null)
  const normalized = normalizeLog(present)
  let cursor = 0
  return values.map((v) => (v === null ? null : normalized[cursor++]))
}

/** Lower price relative to the candidate batch scores higher (better deal), scaled gently so it never dominates quality signal. */
function normalizePriceCompetitiveness(prices: number[]): number[] {
  const valid = prices.filter((p) => p > 0)
  if (valid.length === 0) return prices.map(() => 50)
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  if (max === min) return prices.map(() => 100)
  return prices.map((p) => (p > 0 ? 100 - ((p - min) / (max - min)) * 100 : 50))
}

function fixImageUrl(url: string): string {
  if (!url) return ""
  const lastHttps = url.lastIndexOf("https://")
  if (lastHttps > 0) return url.slice(lastHttps)
  if (url.startsWith("//")) return "https:" + url
  return url
}
