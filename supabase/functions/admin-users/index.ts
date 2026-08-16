import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

// Postgres error codes surfaced by the RESTRICT foreign keys left in place
// deliberately (erp_orders/erp_clients/erp_deliveries.user_id) — see
// 20260817230000_profile_deletion_cascade.sql for why those stay blocking
// instead of cascading.
const RESTRICTED_TABLE_LABEL: Record<string, string> = {
  erp_orders: "commande(s)",
  erp_clients: "client(s) CRM",
  erp_deliveries: "livraison(s)",
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

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles").select("is_admin").eq("id", caller.id).maybeSingle()
    if (!callerProfile?.is_admin) return json({ error: "Forbidden — admin only" }, 403)

    const body = await req.json()
    const action = body.action as string
    const targetUserId = body.userId as string
    if (!targetUserId) return json({ error: "userId is required" }, 400)

    if (action === "delete") {
      if (targetUserId === caller.id) {
        return json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, 400)
      }

      // supabase-js's auth.admin.deleteUser() genericizes GoTrue's error body
      // into "Database error deleting user", losing the constraint name the
      // 23503 case needs — call the admin REST endpoint directly instead so
      // the real Postgres message survives.
      const deleteRes = await fetch(`${getRequiredEnv("SUPABASE_URL")}/auth/v1/admin/users/${targetUserId}`, {
        method: "DELETE",
        headers: {
          apikey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
          Authorization: `Bearer ${getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
      })

      if (!deleteRes.ok) {
        const payload = await deleteRes.json().catch(() => ({})) as { message?: string; code?: string }
        const raw = payload.message ?? ""
        // The three deliberately-RESTRICTed FKs (see the cascade migration)
        // surface as a Postgres 23503 here — translate it into something a
        // human can act on instead of a raw constraint name.
        const match = Object.keys(RESTRICTED_TABLE_LABEL).find(t => raw.includes(t))
        if (match) {
          return json({
            error: `Cet utilisateur gère encore des ${RESTRICTED_TABLE_LABEL[match]} dans l'ERP — réassignez-les à un autre membre de l'équipe avant de le supprimer.`,
          }, 409)
        }
        return json({ error: raw || "Échec de la suppression" }, deleteRes.status)
      }

      return json({ success: true })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
