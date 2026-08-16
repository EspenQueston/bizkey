import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { analysisIds } = await req.json()

    if (!analysisIds || analysisIds.length < 2) {
      return new Response(
        JSON.stringify({ error: "Minimum 2 analyses requises pour une comparaison" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Fetch analyses
    const { data: analyses, error: fetchError } = await supabaseAdmin
      .from("analyses")
      .select("*")
      .in("id", analysisIds)
      .eq("user_id", user.id)

    if (fetchError || !analyses || analyses.length < 2) {
      return new Response(
        JSON.stringify({ error: "Analyses introuvables" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // The winner is decided by a deterministic weighted score, not by the AI.
    // That keeps the verdict reproducible and auditable, lets the UI show a
    // per-criterion breakdown, and makes it impossible for the narrative to
    // contradict the highlighted card. The AI only explains the ranking it is
    // given — and the whole feature still works when the AI is unavailable.
    const scoreboard = scoreAnalyses(analyses)
    const winnerId = scoreboard[0].analysis_id
    const winner = analyses.find((a: typeof analyses[0]) => a.id === winnerId) ?? analyses[0]

    let recommendation: string
    try {
      recommendation = await explainWithAI(analyses, scoreboard)
    } catch (err) {
      console.error("AI comparison failed, using deterministic summary:", err)
      recommendation = buildDeterministicSummary(analyses, scoreboard)
    }

    // Save comparison
    const { data: comparison, error: saveError } = await supabaseAdmin
      .from("comparisons")
      .insert({
        user_id: user.id,
        analysis_ids: analysisIds,
        winner_analysis_id: winner.id,
        ai_recommendation: recommendation,
      })
      .select()
      .single()

    if (saveError) {
      console.error("DB save error:", saveError)
      throw saveError
    }

    return new Response(
      JSON.stringify({
        success: true,
        comparison: {
          ...comparison,
          analyses,
          winner,
          scoreboard,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    console.error("Compare error:", err)
    const errMsg = err instanceof Error ? err.message : "Erreur interne du serveur"
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})

// ─── Deterministic multi-criteria scoring ────────────────────────────────────

interface CriterionScore {
  key: string
  label: string
  /** 0-100 normalised score for this candidate. */
  score: number
  /** Effective weight in percent after redistribution. */
  weight_pct: number
  /** Human-readable raw value, e.g. "¥12.50" or "non communiqué". */
  display: string
}

interface ScoredAnalysis {
  analysis_id: string
  product_name: string
  total_score: number
  rank: number
  criteria: CriterionScore[]
  /** Short plain-language reason this candidate ranked where it did. */
  verdict: string
}

const WEIGHTS = {
  confidence: 30,   // supplier trustworthiness dominates — scams cost more than price
  price: 25,        // landed cost per unit
  dataQuality: 15,  // a verdict built on real data beats one built on estimates
  moq: 15,          // lower minimum order = less capital at risk
  valueRatio: 15,   // confidence earned per yuan spent
} as const

const DATA_QUALITY_SCORE: Record<string, number> = {
  onebound: 100,
  ai_estimate: 55,
  fallback: 20,
}

// Plain min-max normalisation turns trivial gaps into full-weight swings — a
// MOQ of 1 vs 2 would score 100 vs 0 and move the ranking by 15 points, even
// though no buyer would actually decide on that. When the spread across the
// batch is immaterial, the criterion is treated as a tie instead.
const MATERIAL_SPREAD = 0.15 // <15% apart => not decision-relevant

/** Lower raw value is better (price, MOQ): best in batch scores 100. */
function normaliseLowerBetter(values: (number | null)[]): (number | null)[] {
  const present = values.filter((v): v is number => v !== null && v > 0)
  if (present.length === 0) return values.map(() => null)
  const min = Math.min(...present)
  const max = Math.max(...present)
  if (max === min || (max - min) / max < MATERIAL_SPREAD) {
    return values.map(v => (v === null || v <= 0 ? null : 100))
  }
  return values.map(v => {
    if (v === null || v <= 0) return null
    return 100 - ((v - min) / (max - min)) * 100
  })
}

/**
 * Absolute MOQ score in capital-at-risk bands. A small importer testing a
 * product cares whether the minimum order is "a handful" or "a container",
 * not whether a rival listing allows one unit fewer.
 */
function scoreMoq(moq: number | null): number | null {
  if (moq === null || moq <= 0) return null
  if (moq <= 10) return 100
  if (moq <= 50) return 85
  if (moq <= 100) return 70
  if (moq <= 300) return 55
  if (moq <= 500) return 40
  if (moq <= 1000) return 25
  return 10
}

/** Higher raw value is better: best in batch scores 100. */
function normaliseHigherBetter(values: (number | null)[]): (number | null)[] {
  const present = values.filter((v): v is number => v !== null && v > 0)
  if (present.length === 0) return values.map(() => null)
  const min = Math.min(...present)
  const max = Math.max(...present)
  if (max === min || (max - min) / max < MATERIAL_SPREAD) {
    return values.map(v => (v === null || v <= 0 ? null : 100))
  }
  return values.map(v => {
    if (v === null || v <= 0) return null
    return ((v - min) / (max - min)) * 100
  })
}

// deno-lint-ignore no-explicit-any
function scoreAnalyses(analyses: any[]): ScoredAnalysis[] {
  const prices = analyses.map(a => (typeof a.price === "number" ? a.price : null))
  const moqs = analyses.map(a => (typeof a.moq === "number" ? a.moq : null))
  const confidences = analyses.map(a => (typeof a.confidence_score === "number" ? a.confidence_score : null))
  const quality = analyses.map(a => DATA_QUALITY_SCORE[String(a.data_source ?? "")] ?? null)
  // Confidence earned per yuan — surfaces the genuine bargain rather than
  // just the cheapest or just the most trusted.
  const valueRatios = analyses.map((a, i) =>
    prices[i] && prices[i]! > 0 && confidences[i] ? confidences[i]! / prices[i]! : null,
  )

  const priceN = normaliseLowerBetter(prices)
  // MOQ is scored on absolute capital-at-risk bands, not against the other
  // candidates: batch-relative scoring would rate a MOQ of 2 at 0/100 simply
  // because a rival allows 1, which is a 15-point swing over a difference no
  // buyer would ever act on. Bands keep the meaning stable and comparable.
  const moqN = moqs.map(scoreMoq)
  const confN = normaliseHigherBetter(confidences)
  const qualN = normaliseHigherBetter(quality)
  const valueN = normaliseHigherBetter(valueRatios)

  // A criterion nobody in the batch has data for is dropped, and its weight is
  // spread over the rest — otherwise every candidate is penalised equally for
  // a gap none of them control, which just adds noise.
  const active: { key: keyof typeof WEIGHTS; values: (number | null)[] }[] = []
  const push = (key: keyof typeof WEIGHTS, values: (number | null)[]) => {
    if (values.some(v => v !== null)) active.push({ key, values })
  }
  push("confidence", confN)
  push("price", priceN)
  push("dataQuality", qualN)
  push("moq", moqN)
  push("valueRatio", valueN)

  const totalActiveWeight = active.reduce((s, a) => s + WEIGHTS[a.key], 0)
  const scale = totalActiveWeight > 0 ? 100 / totalActiveWeight : 0

  const labels: Record<keyof typeof WEIGHTS, string> = {
    confidence: "Confiance fournisseur",
    price: "Prix unitaire",
    dataQuality: "Fiabilité des données",
    moq: "MOQ accessible",
    valueRatio: "Rapport qualité/prix",
  }

  const displays = (i: number): Record<keyof typeof WEIGHTS, string> => ({
    confidence: confidences[i] !== null ? `${confidences[i]}/100` : "non communiqué",
    price: prices[i] !== null ? `¥${prices[i]}` : "non communiqué",
    dataQuality: analyses[i].data_source === "onebound" ? "Données vérifiées"
      : analyses[i].data_source === "ai_estimate" ? "Estimation IA"
      : analyses[i].data_source === "fallback" ? "Données limitées" : "inconnue",
    moq: moqs[i] !== null ? `${moqs[i]} unités` : "non communiqué",
    valueRatio: valueRatios[i] !== null ? `${valueRatios[i]!.toFixed(1)} pts/¥` : "non calculable",
  })

  const scored = analyses.map((a, i) => {
    const criteria: CriterionScore[] = []
    let weighted = 0

    for (const { key, values } of active) {
      const raw = values[i]
      const weight = WEIGHTS[key] * scale
      // A missing value inside an otherwise-available criterion scores 0 for
      // this candidate rather than being silently skipped, so gaps cost you.
      const score = raw ?? 0
      weighted += (score / 100) * weight
      criteria.push({
        key,
        label: labels[key],
        score: Math.round(score),
        weight_pct: Math.round(weight),
        display: displays(i)[key],
      })
    }

    return {
      analysis_id: String(a.id),
      product_name: String(a.product_name ?? "Produit"),
      total_score: Math.round(Math.min(100, weighted)),
      rank: 0,
      criteria: criteria.sort((x, y) => y.weight_pct - x.weight_pct),
      verdict: "",
    } as ScoredAnalysis
  })

  scored.sort((a, b) => b.total_score - a.total_score)
  scored.forEach((s, i) => {
    s.rank = i + 1
    const best = s.criteria.reduce((m, c) => (c.score > m.score ? c : m), s.criteria[0])
    const worst = s.criteria.reduce((m, c) => (c.score < m.score ? c : m), s.criteria[0])
    s.verdict = i === 0
      ? `Meilleur compromis global — se distingue surtout sur : ${best?.label.toLowerCase()}.`
      : `Pénalisé par : ${worst?.label.toLowerCase()} (${worst?.display}).`
  })

  return scored
}

/** Markdown summary used whenever the AI is unavailable. */
// deno-lint-ignore no-explicit-any
function buildDeterministicSummary(analyses: any[], scoreboard: ScoredAnalysis[]): string {
  const win = scoreboard[0]
  let out = `## Recommandation\n\n`
  out += `**${win.product_name}** obtient le meilleur score global (${win.total_score}/100).\n\n`
  out += `### Pourquoi ce choix\n`
  for (const c of win.criteria) {
    out += `- **${c.label}** (${c.weight_pct}% du score) : ${c.display} — ${c.score}/100\n`
  }
  if (scoreboard.length > 1) {
    out += `\n### Classement complet\n`
    for (const s of scoreboard) {
      out += `${s.rank}. **${s.product_name}** — ${s.total_score}/100. ${s.verdict}\n`
    }
  }
  out += `\n### Points de vigilance\n`
  out += `- Demandez systématiquement des échantillons avant une commande en volume\n`
  out += `- Vérifiez les certifications exigées à l'import dans votre pays\n`
  out += `- Confirmez les délais et conditions de paiement par écrit\n`
  return out
}

// ─── AI narrative ────────────────────────────────────────────────────────────
//
// The AI never chooses the winner — it receives the already-computed ranking
// and writes the explanation. This keeps the prose and the highlighted card
// permanently in agreement, and means an AI outage degrades the wording only,
// never the verdict.

// deno-lint-ignore no-explicit-any
async function explainWithAI(analyses: any[], scoreboard: ScoredAnalysis[]): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY")
  if (!openaiKey) return buildDeterministicSummary(analyses, scoreboard)

  const byId = new Map(analyses.map((a) => [String(a.id), a]))
  const ranking = scoreboard.map((s) => {
    const a = byId.get(s.analysis_id)
    const details = s.criteria.map((c) => `${c.label}: ${c.display} (${c.score}/100, poids ${c.weight_pct}%)`).join(", ")
    return `#${s.rank} — ${s.product_name} | score global ${s.total_score}/100 | fournisseur: ${a?.supplier_name ?? "N/A"} | ${details}`
  }).join("\n")

  // The ranking is already decided, so the AI is strictly a nice-to-have.
  // Without a timeout a slow or hanging upstream burns the isolate's wall
  // clock and takes the whole comparison down with it (502) — capping it means
  // a sluggish AI costs us the prose, never the verdict.
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en import/export Chine-Afrique. Tu expliques un classement DÉJÀ CALCULÉ. " +
            "Tu ne dois jamais désigner un autre gagnant que le #1 fourni. Réponds en markdown français, sans backticks.",
        },
        {
          role: "user",
          content:
            `Classement calculé (prix en Yuan ¥) :\n${ranking}\n\n` +
            `Rédige pour un importateur africain :\n` +
            `1. Pourquoi le #1 l'emporte, en t'appuyant sur les critères chiffrés ci-dessus\n` +
            `2. Ce qui pénalise chaque alternative\n` +
            `3. Les points de vigilance concrets avant de commander\n\n` +
            `Le produit recommandé DOIT être "${scoreboard[0].product_name}".`,
        },
      ],
      temperature: 0.4,
    }),
  })

  if (!response.ok) {
    console.error("OpenAI error:", response.status)
    return buildDeterministicSummary(analyses, scoreboard)
  }

  const data = await response.json()
  const content: string = data.choices?.[0]?.message?.content ?? ""
  const clean = content.replace(/^```(?:markdown)?\s*/i, "").replace(/```\s*$/i, "").trim()
  return clean || buildDeterministicSummary(analyses, scoreboard)
}
