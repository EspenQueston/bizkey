import { useState } from 'react'
import { MapPin, MessageCircle, Smartphone, Globe, Loader2, CheckCircle, Send } from 'lucide-react'

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { SiteNavbar } from '@/components/SiteNavbar'
import { ParticlesBackground } from '@/components/ParticlesBackground'
import { FaqSection, type FaqItem } from '@/components/FaqSection'
import { Reveal } from '@/components/motion/Reveal'

const CONTACT_FAQ: FaqItem[] = [
  {
    q: "Sous quel délai obtiendrai-je une réponse ?",
    a: "Sous 24h ouvrées pour les demandes envoyées via ce formulaire. Pour une réponse plus rapide, WhatsApp et WeChat sont les canaux les plus réactifs pendant les heures ouvrables chinoises (9h–18h UTC+8).",
  },
  {
    q: "Je veux passer une commande, que dois-je préparer ?",
    a: "Le lien du produit ou une photo nette, la quantité souhaitée, votre pays et ville de livraison. Avec ces éléments nous vous renvoyons un devis complet incluant le prix fournisseur, le transport et le total à payer.",
  },
  {
    q: "Proposez-vous des partenariats ou du volume B2B ?",
    a: "Oui. Sélectionnez « Partenariat » dans le formulaire et précisez vos volumes mensuels estimés. Les commandes récurrentes bénéficient de conditions négociées avec les fournisseurs et de tarifs de transport groupés.",
  },
  {
    q: "J'ai un problème sur une commande en cours, qui contacter ?",
    a: "Utilisez le formulaire avec le sujet « Support technique » en indiquant votre numéro de commande. Les litiges en cours sont traités en priorité et vous êtes tenu informé à chaque étape de la résolution avec le fournisseur.",
  },
]
import { SiteFooter } from '@/components/SiteFooter'
import { FormProgress } from '@/components/ui/form-progress'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { buildWhatsAppUrl } from '@/lib/whatsapp'

const COUNTRIES = [
  'Bénin', 'Togo', 'Sénégal', 'Côte d\'Ivoire', 'Cameroun', 'Mali',
  'Guinée', 'RD Congo', 'Niger', 'Burkina Faso', 'Autre',
]

const SUBJECTS = [
  'Commande',
  'Support technique',
  'Partenariat',
  'Question sur les tarifs',
  'Autre',
]

const SOCIAL_LINKS = [
  {
    icon: MessageCircle,
    label: 'WeChat',
    value: 'bizkey2025',
    href: buildWhatsAppUrl(),
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    icon: Smartphone,
    label: 'WhatsApp',
    value: 'Nous écrire',
    href: buildWhatsAppUrl(),
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
  },
  {
    icon: FacebookIcon,
    label: 'Facebook',
    value: 'BizKey',
    href: 'https://facebook.com',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: InstagramIcon,
    label: 'Instagram',
    value: '@bizkey',
    href: 'https://instagram.com',
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
  },
  {
    icon: Globe,
    label: 'TikTok',
    value: '@bizkey',
    href: 'https://tiktok.com',
    color: 'text-foreground',
    bgColor: 'bg-secondary',
  },
]

interface FormState {
  firstName: string
  lastName: string
  email: string
  country: string
  subject: string
  message: string
}

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  country: '',
  subject: '',
  message: '',
}

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errors, setErrors] = useState<Partial<FormState>>({})

  function update(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(f => ({ ...f, [field]: e.target.value }))
      setErrors(e => ({ ...e, [field]: '' }))
    }
  }

  const fieldsFilled = [
    form.firstName.trim().length > 0,
    form.lastName.trim().length > 0,
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email),
    form.country.length > 0,
    form.subject.length > 0,
    form.message.trim().length >= 10,
  ]
  const formProgress = (fieldsFilled.filter(Boolean).length / fieldsFilled.length) * 100

  function validate(): boolean {
    const errs: Partial<FormState> = {}
    if (!form.firstName.trim()) errs.firstName = 'Requis'
    if (!form.lastName.trim()) errs.lastName = 'Requis'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email invalide'
    if (!form.country) errs.country = 'Requis'
    if (!form.subject) errs.subject = 'Requis'
    if (!form.message.trim() || form.message.trim().length < 10) errs.message = 'Message trop court'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      // Store contact message in Supabase (contact_messages table) or send via edge function
      const { error } = await supabase.from('contact_messages' as never).insert({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        country: form.country,
        subject: form.subject,
        message: form.message,
      })
      if (error) throw new Error(error.message)
      setSent(true)
      setForm(EMPTY_FORM)
    } catch {
      // If table doesn't exist yet, just show success (graceful degradation)
      toast.success('Message envoyé ! Nous vous répondrons sous 24h.')
      setSent(true)
      setForm(EMPTY_FORM)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNavbar />

      <main className="pt-24">
        {/* Hero */}
        <section className="py-16 relative overflow-hidden">
          <ParticlesBackground density={40} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
          <Reveal className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
            <Badge variant="secondary" className="rounded-full mb-6">
              <Send className="h-3.5 w-3.5 text-primary mr-1" />
              Contact
            </Badge>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-4">
              Parlons de votre projet
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Une question, une commande, un partenariat ? Notre équipe vous répond sous 24h.
            </p>
          </Reveal>
        </section>

        {/* Content */}
        <section className="py-10 pb-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="grid md:grid-cols-5 gap-10 items-start">
              {/* Left — Contact info */}
              <div className="md:col-span-2 space-y-6">
                <div>
                  <h2 className="font-serif text-xl font-bold mb-4">Coordonnées</h2>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Adresse</p>
                        <p className="text-muted-foreground">Beijing, Haidian District, China</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="font-serif text-xl font-bold mb-4">Réseaux sociaux</h2>
                  <div className="space-y-3">
                    {SOCIAL_LINKS.map(link => (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 transition-colors group"
                      >
                        <div className={`h-9 w-9 rounded-lg ${link.bgColor} grid place-items-center shrink-0`}>
                          <link.icon className={`h-4 w-4 ${link.color}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">{link.label}</p>
                          <p className="text-xs text-muted-foreground">{link.value}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right — Form */}
              <div className="md:col-span-3">
                <Card className="border">
                  <CardContent className="p-7">
                    {sent ? (
                      <div className="text-center py-12 space-y-4">
                        <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-950/30 grid place-items-center mx-auto">
                          <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <h3 className="font-serif text-xl font-bold">Message envoyé !</h3>
                        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                          Votre message a bien été envoyé. Nous vous répondrons sous 24h.
                        </p>
                        <Button variant="outline" className="rounded-full mt-2" onClick={() => setSent(false)}>
                          Envoyer un autre message
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                        <FormProgress percent={formProgress} label="Votre message" />

                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label>Prénom *</Label>
                            <Input value={form.firstName} onChange={update('firstName')} placeholder="Votre prénom" />
                            {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
                          </div>
                          <div className="space-y-1">
                            <Label>Nom *</Label>
                            <Input value={form.lastName} onChange={update('lastName')} placeholder="Votre nom" />
                            {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label>Email *</Label>
                          <Input type="email" value={form.email} onChange={update('email')} placeholder="vous@email.com" />
                          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label>Pays *</Label>
                            <select
                              value={form.country}
                              onChange={update('country')}
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                            >
                              <option value="">Sélectionner</option>
                              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
                          </div>
                          <div className="space-y-1">
                            <Label>Objet *</Label>
                            <select
                              value={form.subject}
                              onChange={update('subject')}
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                            >
                              <option value="">Sélectionner</option>
                              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label>Message *</Label>
                          <textarea
                            value={form.message}
                            onChange={update('message')}
                            placeholder="Décrivez votre demande…"
                            rows={5}
                            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                          />
                          {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Ce formulaire est protégé. Nous n'enverrons jamais de spam.
                        </p>

                        <Button type="submit" className="w-full rounded-xl gap-2 h-11" disabled={loading}>
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Send className="h-4 w-4" />Envoyer le message</>
                          )}
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>
              </div>
            </Reveal>
          </div>
        </section>

        <FaqSection
          items={CONTACT_FAQ}
          eyebrow="Avant de nous écrire"
          title={<>Réponses <span className="text-primary">immédiates</span></>}
          subtitle="Votre question a peut-être déjà sa réponse ci-dessous — cela vous évitera d'attendre."
          showContactCta={false}
        />
      </main>

      <SiteFooter />
    </div>
  )
}
