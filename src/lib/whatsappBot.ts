import type { WhatsAppAutoReply, WhatsAppKbArticle } from './supabase'

const GREETING_PATTERNS = ['bonjour', 'bonsoir', 'salut', 'bjr', 'hello', 'hi', 'coucou', 'cc']

export interface BotMatchResult {
  rule: WhatsAppAutoReply
  responseText: string
  matchedVia: 'greeting' | 'keyword' | 'fallback'
}

function resolveResponseText(rule: WhatsAppAutoReply, kbArticles: WhatsAppKbArticle[]): string | null {
  if (rule.response_text) return rule.response_text
  if (rule.kb_article_id) {
    return kbArticles.find(a => a.id === rule.kb_article_id && a.is_active)?.answer ?? null
  }
  return null
}

/**
 * Deterministic keyword-matching engine for BizKey Assistant's auto-replies.
 * Pure function so it can run identically from the admin simulator today and
 * from a real WhatsApp webhook handler later — no live API account exists
 * yet, so this is the part of the product that's testable without one.
 *
 * Priority: greeting rules first, then keyword rules (in sort_order), then
 * a single fallback rule if nothing else matched.
 */
export function matchAutoReply(
  incomingMessage: string,
  rules: WhatsAppAutoReply[],
  kbArticles: WhatsAppKbArticle[]
): BotMatchResult | null {
  const normalized = incomingMessage.trim().toLowerCase()
  if (!normalized) return null

  const active = [...rules].filter(r => r.is_active).sort((a, b) => a.sort_order - b.sort_order)

  const isGreeting = GREETING_PATTERNS.some(g => normalized.includes(g))
  if (isGreeting) {
    for (const rule of active.filter(r => r.trigger_type === 'greeting')) {
      const text = resolveResponseText(rule, kbArticles)
      if (text) return { rule, responseText: text, matchedVia: 'greeting' }
    }
  }

  for (const rule of active.filter(r => r.trigger_type === 'keyword')) {
    if (!rule.trigger_value) continue
    if (normalized.includes(rule.trigger_value.trim().toLowerCase())) {
      const text = resolveResponseText(rule, kbArticles)
      if (text) return { rule, responseText: text, matchedVia: 'keyword' }
    }
  }

  const fallback = active.find(r => r.trigger_type === 'fallback')
  if (fallback) {
    const text = resolveResponseText(fallback, kbArticles)
    if (text) return { rule: fallback, responseText: text, matchedVia: 'fallback' }
  }

  return null
}
