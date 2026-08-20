import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

interface AnalysisQualityRow {
  id: string
  product_name: string | null
  data_source: string | null
  ai_source: string | null
  quality_tier: string | null
  fallback_reason: string | null
  confidence_score: number | null
  created_at: string
}

export default function AdminAIQuality() {
  const { t } = useTranslation('adminAiQuality')
  const [rows, setRows] = useState<AnalysisQualityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('analyses')
          .select('id, product_name, data_source, ai_source, quality_tier, fallback_reason, confidence_score, created_at')
          .order('created_at', { ascending: false })
          .limit(100)

        if (error) throw new Error(error.message)
        setRows((data ?? []) as AnalysisQualityRow[])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const fallbackRows = useMemo(
    () => rows.filter(r => r.data_source === 'fallback' || r.ai_source === 'fallback'),
    [rows],
  )

  const fallbackRate = rows.length > 0 ? ((fallbackRows.length / rows.length) * 100).toFixed(2) : '0.00'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('stats.observed')}</p>
            <p className="text-2xl font-bold mt-2">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('stats.fallbackCases')}</p>
            <p className="text-2xl font-bold mt-2">{fallbackRows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('stats.fallbackRate')}</p>
            <p className="text-2xl font-bold mt-2">{fallbackRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {t('recentFallback')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {fallbackRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noRecentFallback')}</p>
          ) : (
            fallbackRows.map((row) => (
              <div key={row.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{row.product_name ?? t('unnamedProduct')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(row.created_at).toLocaleString('fr')} · {t('reason')}: {row.fallback_reason ?? 'n/a'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Badge variant="outline">{row.data_source ?? t('unknown')}</Badge>
                  <Badge variant="outline">{row.ai_source ?? t('unknown')}</Badge>
                  <Badge>{row.quality_tier ?? t('unknown')}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
