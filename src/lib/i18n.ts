import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export type AppLanguage = 'fr' | 'en'
export const STORAGE_KEY = 'bizkey-language'

function isLanguage(value: string | null): value is AppLanguage {
  return value === 'fr' || value === 'en'
}

// Auto-discovers every namespace JSON under src/locales/{fr,en}/*.json rather
// than a manually maintained import list — translating a new page only ever
// needs its two locale files added, never an edit here to register them.
const modules = import.meta.glob<{ default: Record<string, unknown> }>('../locales/*/*.json', { eager: true })

const resources: Record<AppLanguage, Record<string, Record<string, unknown>>> = { fr: {}, en: {} }
const namespaces = new Set<string>()

for (const path in modules) {
  const match = path.match(/\.\.\/locales\/(fr|en)\/([^/]+)\.json$/)
  if (!match) continue
  const [, lang, ns] = match
  resources[lang as AppLanguage][ns] = modules[path].default
  namespaces.add(ns)
}

// French is BizKey's home market and always the default — mirrors
// theme-provider's own localStorage-first, no-browser-detection pattern
// rather than guessing from navigator.language.
const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
const initialLanguage: AppLanguage = isLanguage(stored) ? stored : 'fr'

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'fr',
  ns: Array.from(namespaces),
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
})

i18n.on('languageChanged', (lng) => {
  if (isLanguage(lng)) localStorage.setItem(STORAGE_KEY, lng)
})

export default i18n
