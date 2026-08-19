import type { WhatsAppAutoReply, WhatsAppKbArticle, KnowledgeRecord, KnowledgeChunk } from './supabase'

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
 * Priority: keyword rules first (in sort_order), then greeting, then a
 * single fallback rule if nothing else matched. Keyword before greeting is
 * deliberate — a real message is almost never a bare "bonjour", it's
 * "bonjour, combien pour X" or similar, and the specific answer is always
 * more useful than a generic welcome even though the message also contains
 * a greeting word.
 */
export function matchAutoReply(
  incomingMessage: string,
  rules: WhatsAppAutoReply[],
  kbArticles: WhatsAppKbArticle[]
): BotMatchResult | null {
  const normalized = incomingMessage.trim().toLowerCase()
  if (!normalized) return null

  const active = [...rules].filter(r => r.is_active).sort((a, b) => a.sort_order - b.sort_order)

  for (const rule of active.filter(r => r.trigger_type === 'keyword')) {
    if (!rule.trigger_value) continue
    if (normalized.includes(rule.trigger_value.trim().toLowerCase())) {
      const text = resolveResponseText(rule, kbArticles)
      if (text) return { rule, responseText: text, matchedVia: 'keyword' }
    }
  }

  const isGreeting = GREETING_PATTERNS.some(g => normalized.includes(g))
  if (isGreeting) {
    for (const rule of active.filter(r => r.trigger_type === 'greeting')) {
      const text = resolveResponseText(rule, kbArticles)
      if (text) return { rule, responseText: text, matchedVia: 'greeting' }
    }
  }

  const fallback = active.find(r => r.trigger_type === 'fallback')
  if (fallback) {
    const text = resolveResponseText(fallback, kbArticles)
    if (text) return { rule: fallback, responseText: text, matchedVia: 'fallback' }
  }

  return null
}

/**
 * Same deterministic substring/token-overlap scoring as assistant-context's
 * rankKbArticles (ported there too — Deno can't import this module graph),
 * applied to imported catalog rows instead of manual FAQ articles. A shared
 * token in the record's searchable_text counts once; an exact substring
 * match of the whole query counts more, since a customer naming the product
 * verbatim ("le sac noir") is a stronger signal than incidental word overlap.
 */
export function rankKnowledgeRecords(query: string, records: KnowledgeRecord[], limit = 1): KnowledgeRecord[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  const queryTokens = normalized.split(/\s+/).filter(t => t.length > 2)
  if (queryTokens.length === 0) return []

  const scored = records
    .filter(r => r.is_active)
    .map(record => {
      let score = 0
      if (record.searchable_text.includes(normalized)) score += 3
      for (const t of queryTokens) {
        if (record.searchable_text.includes(t)) score += 1
      }
      return { record, score }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map(s => s.record)
}

/** Same scoring as rankKnowledgeRecords, applied to PDF/DOCX text passages instead of structured catalog rows — a chunk quoted back verbatim is the reply, not reformatted like a product card. */
export function rankKnowledgeChunks(query: string, chunks: KnowledgeChunk[], limit = 1): KnowledgeChunk[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  const queryTokens = normalized.split(/\s+/).filter(t => t.length > 2)
  if (queryTokens.length === 0) return []

  const scored = chunks
    .map(chunk => {
      const content = chunk.content.toLowerCase()
      let score = 0
      if (content.includes(normalized)) score += 3
      for (const t of queryTokens) {
        if (content.includes(t)) score += 1
      }
      return { chunk, score }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map(s => s.chunk)
}

/** Formats a matched catalog record into a WhatsApp-ready reply — one consistent shape, reused by the simulator and (ported) assistant-context. */
export function formatKnowledgeRecordReply(record: KnowledgeRecord): string {
  const { name, price, stock, description } = record.data
  const lines = [`*${name}*`]
  if (price != null) lines.push(`Prix : ${price.toLocaleString('fr-FR')} FCFA`)
  if (stock != null) lines.push(stock > 0 ? `Stock : disponible (${stock})` : 'Stock : épuisé')
  if (description) lines.push(description)
  return lines.join('\n')
}
