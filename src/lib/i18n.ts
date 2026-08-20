import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import commonFr from '@/locales/fr/common.json'
import commonEn from '@/locales/en/common.json'
import landingFr from '@/locales/fr/landing.json'
import landingEn from '@/locales/en/landing.json'
import aboutFr from '@/locales/fr/about.json'
import aboutEn from '@/locales/en/about.json'
import servicesFr from '@/locales/fr/services.json'
import servicesEn from '@/locales/en/services.json'
import contactFr from '@/locales/fr/contact.json'
import contactEn from '@/locales/en/contact.json'
import helpFr from '@/locales/fr/help.json'
import helpEn from '@/locales/en/help.json'
import pricingFr from '@/locales/fr/pricing.json'
import pricingEn from '@/locales/en/pricing.json'

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
    fr: { common: commonFr, landing: landingFr, about: aboutFr, services: servicesFr, contact: contactFr, help: helpFr, pricing: pricingFr },
    en: { common: commonEn, landing: landingEn, about: aboutEn, services: servicesEn, contact: contactEn, help: helpEn, pricing: pricingEn },
  },
  lng: initialLanguage,
  fallbackLng: 'fr',
  ns: ['common', 'landing', 'about', 'services', 'contact', 'help', 'pricing'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
})

i18n.on('languageChanged', (lng) => {
  if (isLanguage(lng)) localStorage.setItem(STORAGE_KEY, lng)
})

export default i18n
