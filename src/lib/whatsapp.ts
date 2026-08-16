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
