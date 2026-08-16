import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ─── Platform types ───────────────────────────────────────────────────────────
type Platform = "1688" | "taobao" | "tmall" | "alibaba" | "aliexpress" | "jd" | "pinduoduo"

interface ProductData {
  name: string
  price: number
  moq: number
  supplierName: string
  supplierYears: number
  rating: number
  sales: number
  description: string
  reviews: number
  images: string[]
  sourceUrl: string
  platform: Platform
  dataSource: "onebound" | "fallback" | "image"
}

interface AIAnalysis {
  confidenceScore: number
  confidenceReason: string
  priceAnalysis: {
    marketAverage: number
    comparison: string
    targetPrice: number
  }
  warnings: string[]
  contactMessage: string
  summary: string
  negotiationStrategy: {
    openingOffer: number
    walkAwayPrice: number
    tactics: string[]
  }
}

interface AIResultMeta {
  analysis: AIAnalysis
  aiSource: "openai" | "fallback"
  fallbackReason: string | null
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const startedAt = Date.now()

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  try {
    const supabaseAdmin = createClient(
      getRequiredEnv("SUPABASE_URL"),
      getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    )

    // Auth
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Unauthorized" }, 401)

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return json({ error: "Unauthorized" }, 401)

    // Profile + credits
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles").select("*").eq("id", user.id).single()
    if (profileError || !profile) return json({ error: "Profile not found" }, 404)

    const credits = getCreditSnapshot(profile)
    if (!credits.canAnalyze) {
      return json({ error: "Crédits épuisés. Passez à un plan payant pour continuer." }, 403)
    }

    // Parse body
    const body = await req.json()
    const inputType: "url" | "image" = body.type ?? "url"

    let productData: ProductData
    let resolvedUrl = ""

    if (inputType === "image") {
      // ── Image path ──────────────────────────────────────────────────────────
      const { base64, fileName, mimeType } = body as {
        base64: string
        fileName: string
        mimeType: string
      }
      if (!base64) return json({ error: "base64 manquant" }, 400)

      productData = {
        name: fileName ?? "image-produit",
        price: 0,
        moq: 1,
        supplierName: "",
        supplierYears: 0,
        rating: 0,
        sales: 0,
        description: "",
        reviews: 0,
        images: [`data:${mimeType ?? "image/jpeg"};base64,${base64}`],
        sourceUrl: "",
        platform: "alibaba",
        dataSource: "image",
      }
    } else {
      // ── URL path ────────────────────────────────────────────────────────────
      const rawUrl: string = (body.productUrl ?? body.value ?? "").trim()
      if (!rawUrl) return json({ error: "URL manquante" }, 400)

      resolvedUrl = await resolveShortUrl(rawUrl)
      productData = await scrapeProduct(resolvedUrl)
    }

    // AI analysis
    const aiResult = await analyzeWithAI(productData)
    const qualityTier =
      productData.dataSource === "onebound" && aiResult.aiSource === "openai" ? "high"
      : productData.dataSource === "onebound" ? "medium"
      : "low"

    // Save to DB
    const analysisPayload = {
      user_id: user.id,
      product_url: resolvedUrl || null,
      product_name: productData.name || null,
      supplier_name: productData.supplierName || null,
      price: productData.price || null,
      moq: productData.moq || null,
      confidence_score: Math.round(aiResult.analysis.confidenceScore),
      ai_analysis: aiResult.analysis,
      raw_product_data: productData,
      data_source: productData.dataSource,
      ai_source: aiResult.aiSource,
      quality_tier: qualityTier,
      fallback_reason: aiResult.fallbackReason,
    }

    let savedAnalysis: unknown = null
    const firstInsert = await supabaseAdmin.from("analyses").insert(analysisPayload).select().single()

    if (!firstInsert.error) {
      savedAnalysis = firstInsert.data
    } else {
      const legacyPayload = {
        user_id: user.id,
        product_url: resolvedUrl || null,
        product_name: productData.name || null,
        supplier_name: productData.supplierName || null,
        price: productData.price || null,
        moq: productData.moq || null,
        confidence_score: Math.round(aiResult.analysis.confidenceScore),
        ai_analysis: aiResult.analysis,
        raw_product_data: productData,
      }
      const secondInsert = await supabaseAdmin.from("analyses").insert(legacyPayload).select().single()
      if (secondInsert.error) throw secondInsert.error
      savedAnalysis = secondInsert.data
    }

    // Deduct credits — admins have unlimited platform access and are never
    // charged, regardless of the subscription_tier stored on their profile.
    if (!credits.isAdmin && profile.subscription_tier === "free") {
      await consumeFreeAnalysisCredit(supabaseAdmin, user.id, profile)
    }

    const durationMs = Date.now() - startedAt
    await logSystemEvent(supabaseAdmin, {
      user_id: user.id,
      event_name: "analyze_request",
      service: "analyze",
      status: "ok",
      latency_ms: durationMs,
      source: productData.dataSource,
      metadata: { ai_source: aiResult.aiSource, quality_tier: qualityTier, input_type: inputType },
    })

    return json({ success: true, analysis: savedAnalysis })
  } catch (err) {
    const durationMs = Date.now() - startedAt
    try {
      const supabaseAdmin = createClient(
        getRequiredEnv("SUPABASE_URL"),
        getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      )
      await logSystemEvent(supabaseAdmin, {
        event_name: "analyze_request",
        service: "analyze",
        status: "error",
        latency_ms: durationMs,
        metadata: { error: String(err) },
      })
    } catch (_) { /* ignore */ }
    console.error("Analyze error:", err)
    // String(err) renders Supabase/Postgres error objects as "[object Object]",
    // which hides the actual cause (constraint name, column, hint) and makes
    // these failures far harder to diagnose than they need to be.
    return new Response(JSON.stringify({ error: "Erreur interne du serveur", debug: describeError(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

// ─── URL helpers ──────────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return (
      host.includes("alibaba.com") ||
      host.includes("1688.com") ||
      host.includes("taobao.com") ||
      host.includes("tmall.com") ||
      host.includes("aliexpress.com") ||
      host.includes("e.tb.cn") ||
      host.includes("jd.com") ||
      host.includes("yangkeduo.com") ||
      host.includes("pinduoduo.com")
    )
  } catch {
    return false
  }
}

async function resolveShortUrl(url: string): Promise<string> {
  if (!url.includes("e.tb.cn")) return url
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    })
    const html = await res.text()
    const match = html.match(/var url\s*=\s*'([^']+)'/)
    if (match?.[1]) return match[1]
  } catch (err) {
    console.warn("Short URL resolution failed:", err)
  }
  return url
}

// ─── Platform detection ───────────────────────────────────────────────────────

function detectPlatform(url: string): Platform {
  if (url.includes("1688.com")) return "1688"
  if (url.includes("taobao.com") || url.includes("e.tb.cn")) return "taobao"
  if (url.includes("tmall.com")) return "tmall"
  if (url.includes("aliexpress.com")) return "aliexpress"
  if (url.includes("jd.com")) return "jd"
  if (url.includes("yangkeduo.com") || url.includes("pinduoduo.com")) return "pinduoduo"
  return "alibaba"
}

// ─── Item ID extraction (multi-platform regex) ───────────────────────────────

function extractItemId(url: string, platform: Platform): string | null {
  try {
    const parsed = new URL(url)

    switch (platform) {
      case "1688": {
        // Mobile: detail.m.1688.com/page/index.htm?offerId=810352749783
        const offerId = parsed.searchParams.get("offerId")
        if (offerId) return offerId
        // Desktop: detail.1688.com/offer/810352749783.html
        return (
          url.match(/\/offer\/(\d+)\.html/)?.[1] ??
          url.match(/offerId=(\d+)/)?.[1] ??
          url.match(/\/(\d{10,})(?:\.html)?/)?.[1] ??
          null
        )
      }

      case "taobao":
      case "tmall": {
        // item.taobao.com/item.htm?id=123456789
        return (
          parsed.searchParams.get("id") ??
          parsed.searchParams.get("itemId") ??
          url.match(/[?&]id=(\d+)/)?.[1] ??
          null
        )
      }

      case "aliexpress": {
        // /item/123456789.html or /_123456789.html
        return (
          url.match(/\/item\/(\d+)\.html/)?.[1] ??
          url.match(/_(\d{8,})\.html/)?.[1] ??
          parsed.searchParams.get("productId") ??
          null
        )
      }

      case "alibaba": {
        // /product-detail/name_60846999786.html
        return (
          url.match(/_(\d{8,})\.html/)?.[1] ??
          url.match(/\/(\d{8,})\.html/)?.[1] ??
          null
        )
      }

      case "jd": {
        // item.jd.com/100012345678.html or /100012345678.html
        return (
          url.match(/\/(\d{8,})\.html/)?.[1] ??
          parsed.searchParams.get("sku") ??
          null
        )
      }

      case "pinduoduo": {
        // mobile.yangkeduo.com/goods.html?goods_id=123456
        // pinduoduo.com/goods.html?goods_id=123456
        return (
          parsed.searchParams.get("goods_id") ??
          parsed.searchParams.get("goodsId") ??
          url.match(/goods_id=(\d+)/)?.[1] ??
          null
        )
      }

      default:
        return null
    }
  } catch {
    return null
  }
}

// ─── Product scraping (Onebound + fallback) ───────────────────────────────────

async function scrapeProduct(url: string): Promise<ProductData> {
  const key = Deno.env.get("ONEBOUND_KEY")
  const secret = Deno.env.get("ONEBOUND_SECRET")
  const platform = detectPlatform(url)
  const itemId = extractItemId(url, platform)

  console.log(`scrapeProduct: platform=${platform} itemId=${itemId}`)

  // JD and Pinduoduo: Onebound may not support them — go AI-only with itemId context
  if (platform === "jd" || platform === "pinduoduo") {
    return buildFallbackData(url, platform, itemId)
  }

  if (!itemId || !key || !secret) return buildFallbackData(url, platform, itemId)

  // 1688's plain "1688" namespace's item_get is dead ("接口已停用"), but the
  // separate "1688global" namespace works — confirmed against the live API
  // with a real item ID (returns real title/price/images/seller_info).
  const platformMap: Record<string, string> = {
    "1688": "1688global",
    taobao: "taobao",
    tmall: "taobao",
    alibaba: "alibaba",
    aliexpress: "aliexpress",
  }
  const apiPlatform = platformMap[platform] ?? "taobao"
  const apiUrl = `https://api-gw.onebound.cn/${apiPlatform}/item_get/?key=${key}&secret=${secret}&num_iid=${encodeURIComponent(itemId)}&lang=zh-CN&cache=1&async=0`

  try {
    const response = await fetch(apiUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BizKeyBot/1.0)" },
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) return buildFallbackData(url, platform, itemId)
    const data = await response.json()
    return parseOneboundResponse(data, url, platform, itemId)
  } catch (err) {
    console.warn("Onebound scrape failed, using fallback:", err)
    return buildFallbackData(url, platform, itemId)
  }
}

// deno-lint-ignore no-explicit-any
function parseOneboundResponse(data: any, url: string, platform: Platform, itemId: string | null): ProductData {
  const item = data?.item ?? data?.result ?? {}

  if (data?.error && !item?.title && !item?.name) {
    console.warn("Onebound error:", String(data.error).slice(0, 200))
    return buildFallbackData(url, platform, itemId)
  }

  const name = String(item.title ?? item.name ?? "Produit importé").slice(0, 200)
  const rawPrice = parseFloat(
    String(item.price ?? item.sale_price ?? item.min_price ?? "0").replace(/[^\d.]/g, ""),
  ) || 0
  const moq = parseInt(String(item.min_order ?? item.min_num ?? "1").match(/(\d+)/)?.[1] ?? "1") || 1

  // Real 1688global item_get response confirmed via live testing: seller_info
  // exposes rating scores (item_score/composite_score, 0-5 scale) and
  // sales_info exposes comment_num/total_sold — there's no literal "response
  // rate %" or "years on platform" field, so supplierYears stays honestly at
  // 0 rather than reading made-up field names that don't exist.
  const sellerInfo = item.seller_info ?? {}
  const salesInfo = item.sales_info ?? {}
  // NOTE: seller_info.zhuy is confirmed (via live testing) to be a URL, not
  // a name — deliberately excluded here.
  const supplierName = String(sellerInfo.shop_name || sellerInfo.title || item.nick || "Fournisseur").slice(0, 100)
  const supplierYears = parseInt(String(sellerInfo.experience ?? sellerInfo.years ?? "0")) || 0
  const rating = parseFloat(String(sellerInfo.composite_score ?? sellerInfo.item_score ?? "0")) || 0
  const sales = parseInt(String(item.total_sold ?? salesInfo.total_sold ?? item.sale_count ?? "0")) || 0

  const descRaw = typeof item.desc === "string"
    ? item.desc.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 500)
    : `Produit ${platform} importé depuis la Chine`

  // deno-lint-ignore no-explicit-any
  const images = Array.isArray(item.item_imgs)
    // deno-lint-ignore no-explicit-any
    ? item.item_imgs.slice(0, 5).map((i: any) => fixImageUrl(String(i.url ?? i))).filter(Boolean)
    : []

  return {
    name,
    price: rawPrice,
    moq,
    supplierName,
    supplierYears,
    rating,
    sales,
    description: descRaw,
    reviews: parseInt(String(salesInfo.comment_num ?? item.comment_count ?? item.num_sold30 ?? "0")) || 0,
    images,
    sourceUrl: url,
    platform,
    dataSource: "onebound",
  }
}

function fixImageUrl(url: string): string {
  if (!url) return ""
  const lastHttps = url.lastIndexOf("https://")
  if (lastHttps > 0) return url.slice(lastHttps)
  if (url.startsWith("//")) return "https:" + url
  return url
}

function buildFallbackData(url: string, platform: Platform, itemId: string | null): ProductData {
  const labels: Record<string, string> = {
    alibaba: "Alibaba", aliexpress: "AliExpress", "1688": "1688",
    taobao: "Taobao", tmall: "Tmall", jd: "JD.com", pinduoduo: "Pinduoduo",
  }
  const seed = seededNumber(itemId ?? url)
  const price = Number((5 + (seed % 180) + ((seed % 9) / 10)).toFixed(2))
  const moq = [1, 2, 5, 10, 20, 50][seed % 6]

  return {
    name: `Produit ${labels[platform] ?? "importé"}${itemId ? ` #${itemId}` : ""}`,
    price,
    moq,
    supplierName: "Fournisseur",
    supplierYears: 0,
    rating: 0,
    sales: 0,
    description: `Produit depuis ${url}`,
    reviews: 0,
    images: [],
    sourceUrl: url,
    platform,
    dataSource: "fallback",
  }
}

function seededNumber(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash
}

// ─── AI Analysis (OpenAI — text + vision) ──────────────────────────────────────

async function analyzeWithAI(productData: ProductData): Promise<AIResultMeta> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY")

  if (!openaiKey) {
    return { analysis: getMockAnalysis(productData), aiSource: "fallback", fallbackReason: "openai_key_missing" }
  }

  const isImageInput = productData.dataSource === "image"

  // ── Build messages ──────────────────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  let userContent: any

  if (isImageInput) {
    // Vision: send image as base64 data URL
    const imageDataUrl = productData.images[0] ?? ""
    userContent = [
      {
        type: "image_url",
        image_url: { url: imageDataUrl },
      },
      {
        type: "text",
        text: `Tu es un expert en import/export Chine-Afrique. Analyse ce produit visible sur l'image.

Identifie : le type de produit, la catégorie, une estimation de prix fournisseur en yuan (¥), le MOQ probable, les risques qualité.

Génère un rapport JSON complet :
{
  "confidenceScore": number (0-100),
  "confidenceReason": string,
  "priceAnalysis": {
    "marketAverage": number,
    "comparison": string,
    "targetPrice": number
  },
  "warnings": string[],
  "contactMessage": string (en chinois, pour négocier),
  "summary": string,
  "negotiationStrategy": {
    "openingOffer": number,
    "walkAwayPrice": number,
    "tactics": string[]
  }
}

Réponds UNIQUEMENT avec le JSON, sans markdown.`,
      },
    ]
  } else {
    // Text: product data from API/fallback
    const platformLabels: Record<string, string> = {
      "1688": "1688.com", taobao: "Taobao", tmall: "Tmall",
      alibaba: "Alibaba", aliexpress: "AliExpress", jd: "JD.com", pinduoduo: "Pinduoduo",
    }
    userContent = `Tu es un expert en import/export Chine-Afrique. Analyse ce produit et génère un rapport détaillé.

DONNÉES PRODUIT (source: ${platformLabels[productData.platform] ?? productData.platform}) :
- Nom : ${productData.name}
- Prix : ¥${productData.price}/unité
- MOQ : ${productData.moq}
- Fournisseur : ${productData.supplierName || "Inconnu"}
- Note vendeur : ${productData.rating > 0 ? `${productData.rating.toFixed(1)}/5` : "non communiquée"}
- Ventes réalisées : ${productData.sales > 0 ? productData.sales : "non communiquées"}
- Avis : ${productData.reviews}
- Description : ${productData.description.slice(0, 400) || "(aucune)"}
- URL source : ${productData.sourceUrl}

CONTEXTE : Importation vers l'Afrique francophone (Bénin, Togo, Sénégal, Côte d'Ivoire, Cameroun).

Génère un rapport JSON :
{
  "confidenceScore": number (0-100),
  "confidenceReason": string,
  "priceAnalysis": {
    "marketAverage": number,
    "comparison": string,
    "targetPrice": number
  },
  "warnings": string[],
  "contactMessage": string (en chinois, pour négocier),
  "summary": string,
  "negotiationStrategy": {
    "openingOffer": number,
    "walkAwayPrice": number,
    "tactics": string[]
  }
}

Réponds UNIQUEMENT avec le JSON, sans markdown.`
  }

  // gpt-4o-mini handles both text and vision in one model, so no per-input
  // model selection is needed here (unlike the old OpenRouter setup, which
  // needed a separate vision-capable model for image input).

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Tu es un expert en sourcing et import/export Chine-Afrique. Réponds toujours en JSON valide uniquement, sans markdown.",
          },
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(45000),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      console.warn(`OpenAI error ${response.status}:`, errText.slice(0, 300))
      return {
        analysis: getMockAnalysis(productData),
        aiSource: "fallback",
        fallbackReason: `openai_http_${response.status}`,
      }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? ""
    const parsed = parseJsonObject(content)

    if (!parsed) {
      console.warn("AI JSON parse failed:", content.slice(0, 300))
      return { analysis: getMockAnalysis(productData), aiSource: "fallback", fallbackReason: "openai_invalid_json" }
    }

    return { analysis: normalizeAnalysis(parsed, productData), aiSource: "openai", fallbackReason: null }
  } catch (err) {
    console.warn("AI analysis failed:", err)
    return { analysis: getMockAnalysis(productData), aiSource: "fallback", fallbackReason: "openai_exception" }
  }
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const clean = content.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim()
  try {
    return JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]+\}/)
    if (!match) return null
    try { return JSON.parse(match[0]) } catch { return null }
  }
}

function asNumber(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  const items = value.map((i) => String(i)).filter(Boolean)
  return items.length > 0 ? items : fallback
}

function normalizeAnalysis(parsed: Record<string, unknown>, productData: ProductData): AIAnalysis {
  const fallback = getMockAnalysis(productData)
  const pa = parsed.priceAnalysis as Record<string, unknown> | undefined
  const ns = parsed.negotiationStrategy as Record<string, unknown> | undefined

  return {
    confidenceScore: Math.max(0, Math.min(100, asNumber(parsed.confidenceScore, fallback.confidenceScore))),
    confidenceReason: String(parsed.confidenceReason ?? fallback.confidenceReason),
    priceAnalysis: {
      marketAverage: asNumber(pa?.marketAverage, fallback.priceAnalysis.marketAverage),
      comparison: String(pa?.comparison ?? fallback.priceAnalysis.comparison),
      targetPrice: asNumber(pa?.targetPrice, fallback.priceAnalysis.targetPrice),
    },
    warnings: asStringArray(parsed.warnings, fallback.warnings).slice(0, 8),
    contactMessage: String(parsed.contactMessage ?? fallback.contactMessage),
    summary: String(parsed.summary ?? fallback.summary),
    negotiationStrategy: {
      openingOffer: asNumber(ns?.openingOffer, fallback.negotiationStrategy.openingOffer),
      walkAwayPrice: asNumber(ns?.walkAwayPrice, fallback.negotiationStrategy.walkAwayPrice),
      tactics: asStringArray(ns?.tactics, fallback.negotiationStrategy.tactics).slice(0, 8),
    },
  }
}

function getMockAnalysis(productData: ProductData): AIAnalysis {
  const price = productData.price || 10
  const target = price * 0.75
  return {
    confidenceScore: 68,
    confidenceReason: "Données partielles disponibles. Analyse basée sur les informations du marché.",
    priceAnalysis: {
      marketAverage: price * 1.1,
      comparison: "Prix dans la moyenne du marché",
      targetPrice: parseFloat(target.toFixed(2)),
    },
    warnings: [
      "Demandez un échantillon avant toute commande importante",
      "Vérifiez les certifications du produit (CE, RoHS si applicable)",
      "Négociez les conditions de paiement : 30% avance, 70% avant expédition",
      "Demandez des photos détaillées de l'emballage réel",
      "Clarifiez les délais de production et d'expédition par écrit",
    ],
    contactMessage: "您好！我对您的产品很感兴趣。我是非洲的进口商，有意大量采购。能否给我一个更优惠的价格？期待您的回复！",
    summary: `Produit analysé. Score de confiance : 68/100. Négociation recommandée autour de ¥${target.toFixed(2)}/unité.`,
    negotiationStrategy: {
      openingOffer: parseFloat((price * 0.65).toFixed(2)),
      walkAwayPrice: parseFloat((price * 0.85).toFixed(2)),
      tactics: [
        "Mentionner un volume d'achat potentiel plus important",
        "Comparer avec 2-3 fournisseurs concurrents",
        "Proposer un paiement rapide en échange d'une remise",
        "Demander une remise pour commande récurrente mensuelle",
      ],
    },
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Readable one-line description of any thrown value, including PostgrestError. */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>
    const parts = [e.message, e.code && `code=${e.code}`, e.details, e.hint].filter(Boolean)
    if (parts.length > 0) return parts.join(" | ")
    try { return JSON.stringify(err) } catch { return String(err) }
  }
  return String(err)
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

// deno-lint-ignore no-explicit-any
function getCreditSnapshot(profile: Record<string, any>) {
  const isAdmin = profile.is_admin === true
  const tier = String(profile.subscription_tier ?? "free")
  const legacyCredits = Number(profile.credits_remaining ?? 0)
  const basicCredits = Number(profile.basic_credits_remaining ?? legacyCredits)
  const paygBasicCredits = Number(profile.payg_basic_credits ?? 0)
  return {
    isAdmin,
    tier,
    canAnalyze: isAdmin || tier !== "free" || basicCredits + paygBasicCredits > 0 || legacyCredits > 0,
  }
}

// deno-lint-ignore no-explicit-any
async function consumeFreeAnalysisCredit(supabaseAdmin: any, userId: string, profile: Record<string, any>) {
  const { data, error } = await supabaseAdmin.rpc("consume_basic_credit", {
    p_user_id: userId,
    p_feature: "analyze",
  })
  if (!error && data?.success !== false) return

  const legacyCredits = Number(profile.credits_remaining ?? 0)
  const basicCredits = Number(profile.basic_credits_remaining ?? legacyCredits)
  await supabaseAdmin.from("profiles").update({
    credits_remaining: Math.max(0, legacyCredits - 1),
    basic_credits_remaining: Math.max(0, basicCredits - 1),
    updated_at: new Date().toISOString(),
  }).eq("id", userId)
}

interface SystemEventInput {
  user_id?: string
  event_name: string
  service: string
  status: "ok" | "warn" | "error"
  latency_ms?: number
  source?: string
  metadata?: Record<string, unknown>
}

// deno-lint-ignore no-explicit-any
async function logSystemEvent(supabaseAdmin: any, input: SystemEventInput) {
  try {
    await supabaseAdmin.from("system_events").insert(input)
  } catch (_) { /* non-blocking */ }
}
