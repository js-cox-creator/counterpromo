'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft, Download, DollarSign, Save } from 'lucide-react'
import { apiClient, type CoopItemUpdate } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoopItem {
  id: string
  name: string
  sku: string | null
  price: string
  coopVendor: string | null
  coopAmount: string | null
  coopNote: string | null
}

interface CoopRowState {
  coopVendor: string
  coopAmount: string
  coopNote: string
}

type ReportState = 'idle' | 'generating' | 'done' | 'error'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(price: string | number): string {
  const n = typeof price === 'string' ? parseFloat(price) : price
  return isNaN(n) ? String(price) : n.toFixed(2)
}

function calcCoopPct(price: string, coopAmount: string): string {
  const p = parseFloat(price)
  const c = parseFloat(coopAmount)
  if (!isNaN(p) && !isNaN(c) && p > 0) {
    return `${((c / p) * 100).toFixed(1)}%`
  }
  return '—'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CoopPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()

  // ----- Items state -----
  const [items, setItems] = useState<CoopItem[]>([])
  const [rowState, setRowState] = useState<Record<string, CoopRowState>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [promoTitle, setPromoTitle] = useState<string>('')

  // ----- Save state -----
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ----- Report state -----
  const [reportState, setReportState] = useState<ReportState>('idle')
  const [reportJobId, setReportJobId] = useState<string | null>(null)
  const [reportUrl, setReportUrl] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Load items on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return

    async function loadItems() {
      setIsLoading(true)
      setLoadError(null)
      try {
        const token = await getToken()
        const client = apiClient(token!)

        // Load promo details for title and co-op items in parallel
        const [promoRes, coopRes] = await Promise.all([
          client.promos.get(id),
          client.coop.getItems(id),
        ])

        setPromoTitle(promoRes.data.title)
        const coopItems = coopRes.data as CoopItem[]
        setItems(coopItems)

        // Initialise row edit state from existing values
        const initial: Record<string, CoopRowState> = {}
        for (const item of coopItems) {
          initial[item.id] = {
            coopVendor: item.coopVendor ?? '',
            coopAmount: item.coopAmount != null ? formatPrice(item.coopAmount) : '',
            coopNote: item.coopNote ?? '',
          }
        }
        setRowState(initial)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load items')
      } finally {
        setIsLoading(false)
      }
    }

    void loadItems()
  }, [id, getToken])

  // ---------------------------------------------------------------------------
  // Report job polling
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!reportJobId || reportState !== 'generating') return

    const interval = setInterval(async () => {
      try {
        const token = await getToken()
        const client = apiClient(token!)
        const res = await client.jobs.get(reportJobId)
        const job = res.data

        if (job.status === 'completed' || job.status === 'done') {
          // Find the coop_report asset via promos.getAssets
          const assetsRes = await client.promos.getAssets(id)
          const coopAsset = assetsRes.data.find((a) => a.type === 'coop_report')
          setReportUrl(coopAsset?.url ?? null)
          setReportState('done')
          setReportJobId(null)
          clearInterval(interval)
        } else if (job.status === 'failed') {
          setReportError(job.errorMsg ?? 'Report generation failed')
          setReportState('error')
          setReportJobId(null)
          clearInterval(interval)
        }
      } catch {
        // keep polling on transient errors
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [reportJobId, reportState, getToken, id])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function updateRow(itemId: string, field: keyof CoopRowState, value: string) {
    setRowState((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }))
  }

  async function handleSave() {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const token = await getToken()

      const updates: CoopItemUpdate[] = items.map((item) => {
        const row = rowState[item.id]
        const update: CoopItemUpdate = { itemId: item.id }
        if (row) {
          if (row.coopVendor !== '') update.coopVendor = row.coopVendor
          if (row.coopAmount !== '') {
            const parsed = parseFloat(row.coopAmount)
            if (!isNaN(parsed)) update.coopAmount = parsed
          }
          if (row.coopNote !== '') update.coopNote = row.coopNote
        }
        return update
      })

      await apiClient(token!).coop.updateItems(id, updates)
      setSaveMessage({ type: 'success', text: 'Co-op data saved successfully.' })
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save co-op data.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleGenerateReport() {
    setReportState('generating')
    setReportError(null)
    setReportUrl(null)
    try {
      const token = await getToken()
      const res = await apiClient(token!).coop.generateReport(id)
      setReportJobId(res.data.jobId)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to start report generation.')
      setReportState('error')
    }
  }

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl">
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-8 w-56 mb-2" />
        <Skeleton className="h-4 w-40 mb-8" />
        <Skeleton className="h-64 w-full rounded-xl mb-4" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-5xl">
        <Link
          href={`/promos/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to promo
        </Link>
        <div className="px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {loadError}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-8 max-w-5xl">
      {/* Back link */}
      <Link
        href={`/promos/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to promo
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-slate-400" />
          Co-op Tracking
        </h1>
        {promoTitle && (
          <p className="text-slate-500 mt-1 text-sm">{promoTitle}</p>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Items table                                               */}
      {/* ------------------------------------------------------------------ */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Items ({items.length})</CardTitle>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={isSaving || items.length === 0}
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Save status message */}
          {saveMessage && (
            <div
              className={[
                'mb-4 rounded-lg px-4 py-2.5 text-sm flex items-center gap-2',
                saveMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
              ].join(' ')}
            >
              {saveMessage.text}
              <button
                type="button"
                className="ml-auto text-xs underline opacity-70 hover:opacity-100"
                onClick={() => setSaveMessage(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-slate-400">
              No items in this promo yet. Add items on the promo page first.
            </p>
          ) : (
            <div className="rounded-lg border border-slate-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 min-w-[200px]">
                      Product
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-24">
                      Price
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 min-w-[160px]">
                      Co-op Vendor
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-32">
                      Co-op Amount ($)
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-20">
                      Co-op %
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 min-w-[200px]">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((item) => {
                    const row = rowState[item.id] ?? { coopVendor: '', coopAmount: '', coopNote: '' }
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-slate-900">{item.name}</p>
                          {item.sku && (
                            <p className="text-xs text-slate-400 mt-0.5">{item.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">
                          ${formatPrice(item.price)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Input
                            value={row.coopVendor}
                            onChange={(e) => updateRow(item.id, 'coopVendor', e.target.value)}
                            placeholder="Vendor name"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.coopAmount}
                            onChange={(e) => updateRow(item.id, 'coopAmount', e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-sm">
                          {row.coopAmount ? calcCoopPct(item.price, row.coopAmount) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <Input
                            value={row.coopNote}
                            onChange={(e) => updateRow(item.id, 'coopNote', e.target.value)}
                            placeholder="Optional note"
                            className="h-8 text-sm"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Generate report                                           */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">CSV Report</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">
            Generate a CSV summary of all items with co-op vendor data. The report includes
            vendor, product name, SKU, price, co-op amount, co-op percentage, and notes.
          </p>

          {(reportState === 'idle' || reportState === 'error') && (
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => void handleGenerateReport()}
                disabled={items.length === 0}
              >
                <Download className="h-4 w-4" />
                Generate CSV Report
              </Button>
              {reportError && (
                <p className="text-sm text-red-600">{reportError}</p>
              )}
            </div>
          )}

          {reportState === 'generating' && (
            <div className="flex items-center gap-3">
              <Button variant="outline" disabled>
                <span className="animate-pulse">Generating…</span>
              </Button>
              <p className="text-sm text-slate-500">Building your co-op report — this should only take a moment.</p>
            </div>
          )}

          {reportState === 'done' && (
            <div className="space-y-3">
              <p className="text-sm text-green-700 font-medium">Report ready.</p>
              {reportUrl ? (
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  <Download className="h-4 w-4" />
                  Download Co-op Report (CSV)
                </a>
              ) : (
                <p className="text-sm text-slate-500">Report generated but no download link available yet. Try refreshing.</p>
              )}
              <div className="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReportState('idle')
                    setReportUrl(null)
                    setReportError(null)
                  }}
                >
                  Generate Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
