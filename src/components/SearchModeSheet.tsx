import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, Globe2, Type, Camera, ArrowLeft, ChevronRight } from 'lucide-react'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from '@/components/ui/drawer'
import { buildWhatsAppUrl } from '@/lib/whatsapp'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'channel' | 'site-mode'

function ChoiceButton({ icon: Icon, label, sub, onClick }: {
  icon: React.FC<{ className?: string }>
  label: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition text-left"
    >
      <span className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-sm">{label}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  )
}

/** Two-step "how do you want to search" chooser opened from the mobile bottom nav's Rechercher tab. */
export function SearchModeSheet({ open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('channel')

  function close() {
    onOpenChange(false)
    setTimeout(() => setStep('channel'), 300)
  }

  function goToSite() {
    setStep('site-mode')
  }

  function goToWhatsApp() {
    window.open(buildWhatsAppUrl('Bonjour BizKey, je cherche un produit'), '_blank', 'noopener,noreferrer')
    close()
  }

  function goToTextSearch() {
    navigate('/app/analyze?mode=keyword')
    close()
  }

  function goToImageSearch() {
    navigate('/app/analyze?mode=image')
    close()
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(v) }}>
      <DrawerContent>
        {step === 'channel' ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Rechercher un produit</DrawerTitle>
              <DrawerDescription>Comment voulez-vous procéder ?</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6 space-y-2.5">
              <ChoiceButton
                icon={MessageCircle}
                label="Continuer sur WhatsApp"
                sub="Envoyez une photo ou un lien à notre équipe"
                onClick={goToWhatsApp}
              />
              <ChoiceButton
                icon={Globe2}
                label="Rester sur le site"
                sub="Utilisez l'outil d'analyse BizKey"
                onClick={goToSite}
              />
            </div>
          </>
        ) : (
          <>
            <DrawerHeader>
              <button onClick={() => setStep('channel')} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1 w-fit">
                <ArrowLeft className="h-3.5 w-3.5" /> Retour
              </button>
              <DrawerTitle>Type de recherche</DrawerTitle>
              <DrawerDescription>Vous avez un lien, un mot-clé, ou une photo ?</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6 space-y-2.5">
              <ChoiceButton
                icon={Type}
                label="Recherche texte"
                sub="Lien produit ou mot-clé"
                onClick={goToTextSearch}
              />
              <ChoiceButton
                icon={Camera}
                label="Recherche image"
                sub="Envoyez une photo du produit"
                onClick={goToImageSearch}
              />
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
