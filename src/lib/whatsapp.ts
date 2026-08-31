/**
 * Shared WhatsApp deep-link builder.
 *
 * Several places in the app previously linked to a bare `https://wa.me/`
 * with no phone number, which just opens WhatsApp's generic composer
 * instead of a conversation with BizKey. Consolidated here so there's one
 * place to drop in the real BizKey business number once it exists.
 */

// BizKey admin WhatsApp Business number (China), in international format
// without the leading 00/+ — wa.me expects country code + number only.
export const WHATSAPP_PHONE = '8613520646854'

export function buildWhatsAppUrl(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_PHONE}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

// The AI cost a business owner sees anywhere in their own dashboard
// (Billing, Analytics) is a display markup over the real OpenAI spend, not
// the actual cost basis — the admin panel (WhatsAppOverview, AssistantClients)
// shows the real, unmarked-up figure from the same usage_events rows.
// Shared here so every customer-facing display of this number agrees.
export const CUSTOMER_AI_COST_MULTIPLIER = 10
