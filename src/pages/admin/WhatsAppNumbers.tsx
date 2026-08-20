import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Save, Smartphone, Trash2, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getWhatsAppNumbers, createWhatsAppNumber, updateWhatsAppNumber, deleteWhatsAppNumber } from '@/lib/db'
import type { WhatsAppNumber, WhatsAppNumberStatus } from '@/lib/supabase'
import { toast } from 'sonner'

const EMPTY = { label: '', phone_number: '', status: 'pending' as WhatsAppNumberStatus, business_account_id: '' }

export default function WhatsAppNumbersPage() {
  const { t } = useTranslation('adminWhatsappNumbers')
  const STATUS_META: Record<WhatsAppNumberStatus, { label: string; color: string; icon: string }> = {
    pending:  { label: t('status.pending'), color: 'bg-amber-500/15 text-amber-600',  icon: '⏳' },
    active:   { label: t('status.active'),  color: 'bg-blue-500/15 text-blue-600',    icon: '✅' },
    inactive: { label: t('status.inactive'), color: 'bg-muted text-muted-foreground',  icon: '⏸️' },
  }
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<WhatsAppNumber | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    getWhatsAppNumbers().then(setNumbers).catch(console.error).finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY })
    setShowModal(true)
  }

  function openEdit(n: WhatsAppNumber) {
    setEditing(n)
    setForm({ label: n.label, phone_number: n.phone_number, status: n.status, business_account_id: n.business_account_id ?? '' })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.label.trim() || !form.phone_number.trim()) return
    setSaving(true)
    try {
      const payload = {
        label: form.label.trim(),
        phone_number: form.phone_number.trim(),
        status: form.status,
        business_account_id: form.business_account_id.trim() || null,
      }
      if (editing) {
        const updated = await updateWhatsAppNumber(editing.id, payload)
        setNumbers(prev => prev.map(n => n.id === editing.id ? updated : n))
      } else {
        const created = await createWhatsAppNumber(payload)
        setNumbers(prev => [created, ...prev])
      }
      setShowModal(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return
    setDeletingId(id)
    try {
      await deleteWhatsAppNumber(id)
      setNumbers(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : t('deleteError'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('configuredCount', { count: numbers.length })}</p>
        </div>
        <Button onClick={openCreate} className="rounded-full gap-2">
          <Plus className="h-4 w-4" />
          {t('addNumber')}
        </Button>
      </div>

      <Card className="border-blue-500/25 bg-blue-500/5">
        <CardContent className="p-4 text-xs text-muted-foreground leading-relaxed">
          {t('infoBanner')}
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />Chargement...
        </div>
      ) : numbers.length === 0 ? (
        <div className="py-16 text-center">
          <Smartphone className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">{t('empty')}</p>
          <Button onClick={openCreate} size="sm" className="mt-3 rounded-full"><Plus className="h-4 w-4 mr-1" />{t('addNumber')}</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {numbers.map(n => {
            const st = STATUS_META[n.status]
            return (
              <Card key={n.id}>
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{n.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{n.phone_number}</p>
                    </div>
                    <Badge className={`text-xs shrink-0 ${st.color}`}>{st.icon} {st.label}</Badge>
                  </div>
                  {n.business_account_id && (
                    <p className="text-[10px] text-muted-foreground truncate">{t('accountId', { id: n.business_account_id })}</p>
                  )}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg gap-1" onClick={() => openEdit(n)}>
                      <Edit2 className="h-3 w-3" /> {t('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs rounded-lg gap-1 hover:text-destructive"
                      onClick={() => handleDelete(n.id)}
                      disabled={deletingId === n.id}
                    >
                      {deletingId === n.id ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Trash2 className="h-3 w-3" />}
                      {t('delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-serif font-bold">{editing ? t('modal.editTitle') : t('modal.createTitle')}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <Label>{t('modal.label')}</Label>
                <Input placeholder={t('modal.labelPlaceholder')} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('modal.phone')}</Label>
                <Input placeholder="+22900000000" value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('modal.businessAccountId')}</Label>
                <Input placeholder="Meta Business Account ID" value={form.business_account_id} onChange={e => setForm(f => ({ ...f, business_account_id: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('modal.status')}</Label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as WhatsAppNumberStatus }))}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {(Object.keys(STATUS_META) as WhatsAppNumberStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_META[s].icon} {STATUS_META[s].label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-border">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setShowModal(false)}>{t('modal.cancel')}</Button>
              <Button className="flex-1 rounded-full gap-1.5" onClick={handleSave} disabled={saving || !form.label.trim() || !form.phone_number.trim()}>
                {saving ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Save className="h-3.5 w-3.5" />}
                {t('modal.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
