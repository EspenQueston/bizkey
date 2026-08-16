import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  created_at: string
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Non authentifié" }, 401)

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return json({ error: "Non authentifié" }, 401)

    const body = await req.json()
    const { negotiationId, analysisId, targetPrice, message } = body as {
      negotiationId?: string
      analysisId?: string
      targetPrice?: number
      message?: string
    }

    // ── Continuing an existing chat: append user message, get AI reply ──────
    if (negotiationId && message) {
      const { data: negotiation, error: negErr } = await supabaseAdmin
        .from("negotiations")
        .select("*, analyses(*)")
        .eq("id", negotiationId)
        .eq("user_id", user.id)
        .single()

      if (negErr || !negotiation) return json({ error: "Session de négociation introuvable" }, 404)

      const analysis = negotiation.analyses as Record<string, unknown>
      const history = (Array.isArray(negotiation.messages) ? negotiation.messages : []) as ChatMessage[]

      const userMsg: ChatMessage = { role: "user", content: message.trim().slice(0, 2000), created_at: new Date().toISOString() }
      const reply = await getAIReply(analysis, negotiation.target_price as number, [...history, userMsg])
      const assistantMsg: ChatMessage = { role: "assistant", content: reply, created_at: new Date().toISOString() }

      const updatedMessages = [...history, userMsg, assistantMsg]

      const { error: updateErr } = await supabaseAdmin
        .from("negotiations")
        .update({ messages: updatedMessages })
        .eq("id", negotiationId)

      if (updateErr) console.error("negotiations update error:", updateErr)

      return json({ success: true, negotiation: { id: negotiationId, messages: updatedMessages } })
    }

    // ── Starting a new chat session for an analysis ──────────────────────────
    if (!analysisId || !targetPrice) {
      return json({ error: "analysisId et targetPrice sont requis" }, 400)
    }

    const { data: analysis, error: fetchError } = await supabaseAdmin
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !analysis) return json({ error: "Analyse introuvable" }, 404)

    // Reuse an existing session for this analysis if one already exists,
    // instead of spawning a fresh disconnected conversation every time.
    const { data: existing } = await supabaseAdmin
      .from("negotiations")
      .select("*")
      .eq("user_id", user.id)
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing && Array.isArray(existing.messages) && existing.messages.length > 0) {
      return json({ success: true, negotiation: { id: existing.id, messages: existing.messages } })
    }

    const opening = await getOpeningMessage(analysis, targetPrice)
    const openingMsg: ChatMessage = { role: "assistant", content: opening, created_at: new Date().toISOString() }

    const { data: saved, error: saveError } = await supabaseAdmin
      .from("negotiations")
      .insert({
        user_id: user.id,
        analysis_id: analysisId,
        target_price: targetPrice,
        strategy: {},
        messages: [openingMsg],
      })
      .select()
      .single()

    if (saveError || !saved) {
      console.error("negotiations insert error:", saveError)
      return json({ success: true, negotiation: { id: crypto.randomUUID(), messages: [openingMsg] } })
    }

    return json({ success: true, negotiation: { id: saved.id, messages: [openingMsg] } })
  } catch (err) {
    console.error("Negotiate error:", err)
    return json({ error: err instanceof Error ? err.message : "Erreur interne du serveur" }, 500)
  }
})

// ─── Context builder ────────────────────────────────────────────────────────
// Re-derives the full product/supplier context on every call (not cached from
// turn 1) so the agent stays grounded even deep into a long conversation.

function buildContext(analysis: Record<string, unknown>, targetPrice: number): string {
  const raw = (analysis.raw_product_data ?? {}) as Record<string, unknown>
  const currentPrice = (analysis.price as number) ?? 0
  const reduction = currentPrice > 0 ? (((currentPrice - targetPrice) / currentPrice) * 100).toFixed(1) : "?"
  const rating = raw.rating as number | undefined
  const sales = raw.sales as number | undefined
  const reviews = raw.reviews as number | undefined

  return `CONTEXTE PRODUIT (à utiliser pour CHAQUE réponse, ne jamais inventer d'autres données) :
- Produit : ${analysis.product_name ?? "produit"}
- Fournisseur : ${analysis.supplier_name ?? "fournisseur"}
- Prix actuel affiché : ¥${currentPrice}/unité
- MOQ : ${analysis.moq ?? "?"} unités
- Prix cible de l'acheteur : ¥${targetPrice}/unité (réduction visée : ${reduction}%)
- Score de confiance IA : ${analysis.confidence_score ?? "?"}/100
- Note vendeur réelle : ${rating != null && rating > 0 ? `${rating.toFixed(1)}/5` : "non communiquée"}
- Ventes réelles : ${sales != null && sales > 0 ? sales : "non communiquées"}
- Avis clients réels : ${reviews != null && reviews > 0 ? reviews : "aucun avis disponible"}
- Lien produit : ${analysis.product_url ?? "?"}

RÔLE : Tu es un agent de négociation IA expert en achat Chine→Afrique, au service d'un importateur africain qui négocie ce produit précis avec ce fournisseur précis. Tu aides l'acheteur à préparer ses messages, anticiper les réponses du fournisseur, et atteindre le meilleur prix possible sans jamais inventer de données qui ne sont pas listées ci-dessus.

RÈGLES :
- Réponds en français, de façon concise et actionnable (pas de blabla).
- Quand c'est utile, propose un message prêt à envoyer en chinois mandarin (précédé de "Message à envoyer :"), avec sa traduction française entre parenthèses.
- Base tes conseils de prix uniquement sur le prix actuel et le prix cible ci-dessus.
- Si l'utilisateur pose une question hors-sujet, recentre poliment sur la négociation de ce produit.`
}

async function getOpeningMessage(analysis: Record<string, unknown>, targetPrice: number): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY")
  if (!openaiKey) return mockOpening(analysis, targetPrice)

  const context = buildContext(analysis, targetPrice)
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: context },
          {
            role: "user",
            content: "Présente-toi en 1 phrase puis propose immédiatement une stratégie d'ouverture concrète : objectif de la première prise de contact, et un premier message prêt à envoyer en chinois avec sa traduction. Reste court.",
          },
        ],
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) return mockOpening(analysis, targetPrice)
    const data = await response.json()
    return data.choices?.[0]?.message?.content ?? mockOpening(analysis, targetPrice)
  } catch (err) {
    console.warn("Opening message generation failed:", err)
    return mockOpening(analysis, targetPrice)
  }
}

async function getAIReply(analysis: Record<string, unknown>, targetPrice: number, history: ChatMessage[]): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY")
  if (!openaiKey) return mockReply(analysis, targetPrice)

  const context = buildContext(analysis, targetPrice)
  const messages = [
    { role: "system", content: context },
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
  ]

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature: 0.7 }),
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) {
      console.warn("OpenAI error:", response.status)
      return mockReply(analysis, targetPrice)
    }
    const data = await response.json()
    return data.choices?.[0]?.message?.content ?? mockReply(analysis, targetPrice)
  } catch (err) {
    console.warn("AI reply failed:", err)
    return mockReply(analysis, targetPrice)
  }
}

function mockOpening(analysis: Record<string, unknown>, targetPrice: number): string {
  const productName = analysis.product_name as string ?? "produit"
  const currentPrice = analysis.price as number ?? 0
  return `Bonjour, je suis votre agent de négociation pour "${productName}". Prix actuel ¥${currentPrice}, cible ¥${targetPrice}.\n\nStratégie d'ouverture : établissez d'abord une relation professionnelle avant de parler prix.\n\nMessage à envoyer :\n您好，我对您的产品很感兴趣，我们在非洲有分销网络，希望建立长期合作关系。请问大量订购有什么优惠？\n(Bonjour, votre produit m'intéresse beaucoup, nous avons un réseau de distribution en Afrique et souhaitons établir une collaboration à long terme. Quelles remises proposez-vous pour les commandes en volume ?)\n\n[Configuration IA manquante — réponse générique. Ajoutez OPENAI_API_KEY pour des réponses contextualisées.]`
}

function mockReply(analysis: Record<string, unknown>, targetPrice: number): string {
  const currentPrice = analysis.price as number ?? 0
  return `[IA indisponible] Continuez à négocier vers votre prix cible de ¥${targetPrice} (prix actuel ¥${currentPrice}). Mettez en avant le volume d'achat et proposez un paiement rapide en échange d'une remise. Ajoutez OPENAI_API_KEY pour des réponses IA contextualisées.`
}
