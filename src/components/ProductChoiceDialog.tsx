import { useNavigate } from 'react-router-dom'
import { MessageCircle, Globe2, Bot, Tag, ChevronRight, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { buildWhatsAppUrl } from '@/lib/whatsapp'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: 'sourcing' | 'assistant'
}

function OptionCard({ icon: Icon, title, sub, onClick }: {
  icon: React.FC<{ className?: string }>
  title: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-200 text-left"
    >
      <span className="h-12 w-12 rounded-xl bg-primary/10 grid place-items-center shrink-0 group-hover:bg-primary transition-colors duration-200">
        <Icon className="h-5 w-5 text-primary group-hover:text-primary-foreground transition-colors duration-200" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-sm">{title}</span>
        <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
    </button>
  )
}

/** Centered choice modal opened from the hero's two product buttons — replaces the old bottom drawer for this desktop-first entry point. */
export function ProductChoiceDialog({ open, onOpenChange, product }: Props) {
  const navigate = useNavigate()
  const isSourcing = product === 'sourcing'
  const Icon = isSourcing ? Globe2 : Bot

  function close() {
    onOpenChange(false)
  }
  function goToWhatsApp(message: string) {
    window.open(buildWhatsAppUrl(message), '_blank', 'noopener,noreferrer')
    close()
  }
  function goTo(path: string) {
    navigate(path)
    close()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md p-0 gap-0 overflow-hidden border-0 shadow-2xl">
        <div className="relative bg-gradient-to-br from-[#0A1B33] to-[#162B49] px-6 pt-9 pb-7 text-center">
          <DialogClose className="absolute top-4 right-4 h-8 w-8 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/10 transition-colors outline-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Fermer</span>
          </DialogClose>
          <div className="h-14 w-14 rounded-2xl bg-primary/15 grid place-items-center mx-auto mb-3">
            <Icon className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-white text-xl font-serif font-bold">
            {isSourcing ? 'BizKey Sourcing' : 'BizKey WhatsApp Assistant'}
          </DialogTitle>
          <DialogDescription className="text-white/65 text-sm mt-1.5">
            {isSourcing ? 'Comment veux-tu commencer ?' : 'Comment veux-tu en savoir plus ?'}
          </DialogDescription>
        </div>
        <div className="p-5 space-y-2.5 bg-card">
          {isSourcing ? (
            <>
              <OptionCard
                icon={Globe2}
                title="Rester sur le site"
                sub="Utilise l'outil d'analyse BizKey — gratuit, 3 analyses offertes"
                onClick={() => goTo('/login')}
              />
              <OptionCard
                icon={MessageCircle}
                title="Continuer sur WhatsApp"
                sub="Envoie une photo ou un lien directement à notre équipe"
                onClick={() => goToWhatsApp('Bonjour BizKey, je cherche un produit')}
              />
            </>
          ) : (
            <>
              <OptionCard
                icon={MessageCircle}
                title="Discuter sur WhatsApp"
                sub="Teste l'assistant en conditions réelles, dès maintenant"
                onClick={() => goToWhatsApp("Bonjour, je m'intéresse à BizKey WhatsApp Assistant")}
              />
              <OptionCard
                icon={Tag}
                title="Voir les tarifs & fonctionnalités"
                sub="Numéros, conversations, base de connaissances, rapports"
                onClick={() => goTo('/pricing?product=assistant')}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
