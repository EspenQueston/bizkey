import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// An agent's reply typed into WhatsAppConversations.tsx used to only ever
// insert a row into whatsapp_messages — nothing told n8n (which owns the
// real Evolution API connection) to actually send it, so the customer's
// real WhatsApp never received it even though the admin panel showed it as
// sent. This forwards it to a new webhook on the n8n side (same shared
// secret whatsapp-sync already uses) so it reaches "WA - Send Reply" the
// same way an AI-generated reply does. Website-channel conversations need
// no forwarding — the widget already serves those messages directly.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })

  try {
    const supabaseAdmin = createClient(getRequiredEnv("SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"))

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Unauthorized" }, 401)
    const token = authHeader.replace("Bearer ", "")
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !caller) return json({ error: "Unauthorized" }, 401)

    const body = await req.json()
    const conversationId = body.conversationId as string
    const replyText = (body.body as string | undefined)?.trim()
    if (!conversationId || !replyText) return json({ error: "conversationId and body are required" }, 400)

    const { data: convo, error: convoError } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("id, client_id, channel, customer_phone, number_id")
      .eq("id", conversationId)
      .maybeSingle()
    if (convoError || !convo) return json({ error: "Conversation not found" }, 404)

    // Access check — mirrors the RLS predicate rather than relying on it,
    // since this call runs on the service-role client.
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles").select("is_admin").eq("id", caller.id).maybeSingle()
    if (!callerProfile?.is_admin) {
      const { data: ownClient } = await supabaseAdmin
        .from("assistant_clients").select("id").eq("profile_id", caller.id).eq("status", "active").maybeSingle()
      if (!ownClient || ownClient.id !== convo.client_id) {
        return json({ error: "Forbidden" }, 403)
      }
    }

    const { data: message, error: msgError } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversationId,
        client_id: convo.client_id,
        direction: "outbound",
        sender_type: "agent",
        body: replyText,
        channel: convo.channel,
      })
      .select()
      .single()
    if (msgError) return json({ error: msgError.message }, 500)

    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId)

    if (convo.channel !== "whatsapp") {
      // Website chat is served directly by whatsapp-website-chat's own
      // polling — nothing external to forward to.
      return json({ message, delivered: true })
    }

    const webhookUrl = Deno.env.get("N8N_AGENT_REPLY_WEBHOOK_URL")
    const webhookSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET")
    if (!webhookUrl || !webhookSecret) {
      return json({ message, delivered: false, deliveryError: "n8n agent-reply webhook is not configured" })
    }

    let businessNumber: string | null = null
    if (convo.number_id) {
      const { data: num } = await supabaseAdmin
        .from("whatsapp_numbers").select("phone_number").eq("id", convo.number_id).maybeSingle()
      businessNumber = num?.phone_number ?? null
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bizkey-webhook-secret": webhookSecret },
        body: JSON.stringify({
          conversationId,
          businessNumber,
          customerPhone: convo.customer_phone,
          message: replyText,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        return json({ message, delivered: false, deliveryError: `n8n webhook returned ${res.status}: ${text.slice(0, 200)}` })
      }
    } catch (err) {
      return json({ message, delivered: false, deliveryError: err instanceof Error ? err.message : "n8n webhook request failed" })
    }

    return json({ message, delivered: true })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
