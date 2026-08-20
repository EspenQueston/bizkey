import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Check, X, Loader2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { getAllPromoCodes, createPromoCode, updatePromoCode } from '@/lib/db'
import type { PromoCode } from '@/lib/supabase'
import { toast } from 'sonner'

const EMPTY: Omit<PromoCode, 'id' | 'created_at' | 'used_count'> = {
  code: '',
  discount_type: 'percent',
  discount_value: 10,
  max_uses: null,
  valid_until: null,
  plan_ids: null,
  is_active: true,
}

export default function AdminPromoCodes() {
  const { t } = useTranslation('adminPromoCodes')
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<PromoCode | null>(null)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    getAllPromoCodes()
      .then(setPromos)
      .catch((err) => {
        console.warn('AdminPromoCodes load error:', err)
        setPromos([])
        toast.error(t('loadError'))
      })
      .finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setForm({ ...EMPTY, code: `AFRI${Math.random().toString(36).slice(2, 6).toUpperCase()}` })
    setEditTarget(null)
    setDialog('create')
  }

  function openEdit(promo: PromoCode) {
    setForm({
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      max_uses: promo.max_uses,
      valid_until: promo.valid_until,
      plan_ids: promo.plan_ids,
      is_active: promo.is_active,
    })
    setEditTarget(promo)
    setDialog('edit')
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (dialog === 'create') {
        const created = await createPromoCode({ ...form, code: form.code.toUpperCase() })
        setPromos(p => [created, ...p])
        toast.success(t('createdToast'))
      } else if (editTarget) {
        const updated = await updatePromoCode(editTarget.id, form)
        setPromos(p => p.map(x => x.id === updated.id ? updated : x))
        toast.success(t('updatedToast'))
      }
      setDialog(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('genericError'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(promo: PromoCode) {
    try {
      const updated = await updatePromoCode(promo.id, { is_active: !promo.is_active })
      setPromos(p => p.map(x => x.id === updated.id ? updated : x))
    } catch {
      toast.error(t('genericError'))
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    toast.success(t('copiedToast', { code }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t('newCode')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {promos.length === 0 && (
            <p className="text-center text-muted-foreground py-8">{t('noResults')}</p>
          )}
          {promos.map(promo => (
            <Card key={promo.id} className="border">
              <CardContent className="py-3 flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <code
                    className="font-mono font-bold text-sm bg-muted px-2 py-0.5 rounded cursor-pointer hover:bg-muted/80"
                    onClick={() => copyCode(promo.code)}
                    title={t('copy')}
                  >
                    {promo.code}
                    <Copy className="inline ml-1.5 h-3 w-3 text-muted-foreground" />
                  </code>
                  <Badge variant={promo.is_active ? 'default' : 'secondary'} className="text-xs">
                    {promo.is_active ? t('active') : t('inactive')}
                  </Badge>
                </div>
                <div className="flex-1 text-xs text-muted-foreground space-x-2">
                  <span>
                    {promo.discount_type === 'percent'
                      ? `-${promo.discount_value}%`
                      : promo.discount_type === 'fixed_yuan'
                      ? `-¥${promo.discount_value}`
                      : `-$${promo.discount_value}`}
                  </span>
                  <span>· {promo.max_uses ? t('usedCountWithMax', { count: promo.used_count, max: promo.max_uses }) : t('usedCount', { count: promo.used_count })}</span>
                  {promo.valid_until && <span>· {t('expires', { date: new Date(promo.valid_until).toLocaleDateString('fr') })}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(promo)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleActive(promo)}
                    className={promo.is_active ? 'text-destructive hover:bg-destructive/10' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950'}
                  >
                    {promo.is_active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === 'create' ? t('dialog.createTitle') : t('dialog.editTitle')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label>{t('dialog.code')}</Label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="SUMMER25" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('dialog.type')}</Label>
                <select
                  value={form.discount_type}
                  onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as PromoCode['discount_type'] }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="percent">{t('dialog.typePercent')}</option>
                  <option value="fixed_yuan">{t('dialog.typeFixedYuan')}</option>
                  <option value="fixed_usd">{t('dialog.typeFixedUsd')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t('dialog.value')}</Label>
                <Input type="number" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: +e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('dialog.maxUses')}</Label>
                <Input type="number" value={form.max_uses ?? ''} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value ? +e.target.value : null }))} />
              </div>
              <div className="space-y-1">
                <Label>{t('dialog.expiration')}</Label>
                <Input type="date" value={form.valid_until?.slice(0, 10) ?? ''} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value ? e.target.value + 'T23:59:59Z' : null }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              {t('dialog.activeCheckbox')}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>{t('dialog.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.code}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {dialog === 'create' ? t('dialog.create') : t('dialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
