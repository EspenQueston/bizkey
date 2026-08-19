import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@^7'

// Notifies a newly-added BizKey Assistant team member by email. Deliberately
// NOT a generic "send any email" function: it takes only a memberId, looks
// up who/what that row actually is with the service-role key, and builds
// the message itself — a client can never supply the recipient or content.
// Without that constraint this would be an open mail relay off
// contact@profitexb2b.com's reputation for any authenticated BizKey account.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const ROLE_LABEL: Record<string, string> = {
  manager: 'Responsable',
  viewer: 'Lecture seule',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  let body: { memberId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json body' }, 400)
  }
  if (!body.memberId) return json({ error: 'memberId is required' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Identifies the caller from their own JWT — this is the only thing taken
  // from the request beyond memberId.
  const callerClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userError } = await callerClient.auth.getUser()
  if (userError || !user) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: member, error: memberError } = await admin
    .from('assistant_client_members')
    .select('id, role, invited_by, client_id, profile:profiles!assistant_client_members_profile_id_fkey(name, email), assistant_clients(company_name)')
    .eq('id', body.memberId)
    .maybeSingle()
  if (memberError) return json({ error: memberError.message }, 500)
  if (!member) return json({ error: 'member not found' }, 404)

  // Authorization: the caller must be the person who created this
  // membership row, an owner of the same business, or a BizKey admin —
  // mirrors exactly who invite_assistant_client_member itself allows to
  // have created the row in the first place.
  const { data: callerProfile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  const isAdmin = callerProfile?.is_admin === true
  const isInviter = member.invited_by === user.id
  let isOwner = false
  if (!isAdmin && !isInviter) {
    const { data: ownerRow } = await admin
      .from('assistant_client_members')
      .select('id')
      .eq('client_id', member.client_id)
      .eq('profile_id', user.id)
      .eq('role', 'owner')
      .maybeSingle()
    isOwner = !!ownerRow
  }
  if (!isAdmin && !isInviter && !isOwner) return json({ error: 'forbidden' }, 403)

  // deno-lint-ignore no-explicit-any
  const profile = member.profile as any
  // deno-lint-ignore no-explicit-any
  const client = member.assistant_clients as any
  const toEmail: string | undefined = profile?.email
  if (!toEmail) return json({ error: 'invited member has no email on file' }, 400)

  const toName: string = profile?.name ?? toEmail
  const companyName: string = client?.company_name ?? 'BizKey'
  const roleLabel = ROLE_LABEL[member.role] ?? member.role

  const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? '465')
  const transport = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOSTNAME'),
    port: smtpPort,
    secure: (Deno.env.get('SMTP_SECURE') ?? 'true') === 'true',
    auth: {
      user: Deno.env.get('SMTP_USERNAME'),
      pass: Deno.env.get('SMTP_PASSWORD'),
    },
  })

  try {
    await transport.sendMail({
      from: Deno.env.get('SMTP_FROM') ?? Deno.env.get('SMTP_USERNAME'),
      to: toEmail,
      subject: `Vous avez été ajouté(e) à l'équipe ${companyName} sur BizKey`,
      text: `Bonjour ${toName},\n\nVous avez été ajouté(e) à l'équipe BizKey Assistant de ${companyName} avec le rôle "${roleLabel}".\n\nConnectez-vous sur BizKey pour y accéder : https://bizkey.app/login\n\n— L'équipe BizKey`,
      html: `<p>Bonjour ${toName},</p><p>Vous avez été ajouté(e) à l'équipe BizKey Assistant de <strong>${companyName}</strong> avec le rôle <strong>${roleLabel}</strong>.</p><p><a href="https://bizkey.app/login">Connectez-vous sur BizKey</a> pour y accéder.</p><p>— L'équipe BizKey</p>`,
    })
  } catch (err) {
    return json({ error: `smtp send failed: ${err instanceof Error ? err.message : String(err)}` }, 502)
  }

  return json({ sent: true })
})
