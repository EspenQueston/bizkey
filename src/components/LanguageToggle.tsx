import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AppLanguage } from '@/lib/i18n'

const FLAGS: Record<AppLanguage, string> = { fr: '🇫🇷', en: '🇬🇧' }

export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const current = (i18n.language as AppLanguage) === 'en' ? 'en' : 'fr'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t('language.toggle')}>
          <span className="text-base leading-none">{FLAGS[current]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => i18n.changeLanguage('fr')} className="gap-2">
          <span>🇫🇷</span> {t('language.french')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => i18n.changeLanguage('en')} className="gap-2">
          <span>🇬🇧</span> {t('language.english')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
