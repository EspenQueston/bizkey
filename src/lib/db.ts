// This file used to be a single ~1600-line data-access module. It's now a
// barrel that re-exports every function from src/services/<domain>.ts, split
// by the same domain boundaries the rest of the app already uses (Sourcing
// ERP, WhatsApp Assistant conversations/messages/knowledge base, billing,
// etc). Every existing `import { x } from '@/lib/db'` across the app keeps
// working unchanged — this file's public surface (function names, types,
// behavior) is identical to before the split, only the implementation moved.
//
// New code should prefer importing directly from the relevant
// src/services/<domain>.ts module; this barrel exists for the ~40 files
// that already import from here and don't need to churn just to move.
export * from '../services/profiles'
export * from '../services/analyses'
export * from '../services/comparisons'
export * from '../services/negotiations'
export * from '../services/erp'
export * from '../services/quotes'
export * from '../services/plans'
export * from '../services/billing'
export * from '../services/adminStats'
export * from '../services/whatsappNumbers'
export * from '../services/whatsappConversations'
export * from '../services/handoffTickets'
export * from '../services/whatsappUsage'
export * from '../services/whatsappMessages'
export * from '../services/whatsappKnowledgeBase'
export * from '../services/knowledge'
export * from '../services/whatsappAutoReplies'
export * from '../services/assistantClients'
