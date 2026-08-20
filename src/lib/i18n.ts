import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import commonFr from '@/locales/fr/common.json'
import commonEn from '@/locales/en/common.json'
import landingFr from '@/locales/fr/landing.json'
import landingEn from '@/locales/en/landing.json'

export type AppLanguage = 'fr' | 'en'
export const STORAGE_KEY = 'bizkey-language'

function isLanguage(value: string | null): value is AppLanguage {
  return value === 'fr' || value === 'en'
}

// French is BizKey's home market and always the default — mirrors
// theme-provider's own localStorage-first, no-browser-detection pattern
// rather than guessing from navigator.language.
const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
const initialLanguage: AppLanguage = isLanguage(stored) ? stored : 'fr'

i18n.use(initReactI18next).init({
  resources: {
    fr: { common: commonFr, landing: landingFr },
    en: { common: commonEn, landing: landingEn },
  },
  lng: initialLanguage,
  fallbackLng: 'fr',
  ns: ['common', 'landing'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
})

i18n.on('languageChanged', (lng) => {
  if (isLanguage(lng)) localStorage.setItem(STORAGE_KEY, lng)
})

export default i18n
