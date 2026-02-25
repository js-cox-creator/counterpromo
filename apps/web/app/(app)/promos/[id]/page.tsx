'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Upload, Plus, Trash2, FileDown, ImageIcon } from 'lucide-react'
import { apiClient, type PromoItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEMPLATES = [
  { id: 'classic', label: 'Classic', description: 'Clean grid layout' },
  { id: 'modern', label: 'Modern', description: 'Bold headers with accent colors' },
  { id: 'bold', label: 'Bold', description: 'High-impact promotional style' },
]

type UploadState = 'idle' | 'uploading' | 'parsing' | 'done' | 'error'
type RenderState = 'idle' | 'rendering' | 'done'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusVariant(status: string): string {
  if (status === 'ready') return 'bg-green-100 text-green-800 border-green-200'
  if (status === 'draft') return 'bg-slate-100 text-slate-700 border-slate-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

function formatPrice(price: string | number): string {
  if (typeof price === 'number') return price.toFixed(2)
  return price
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PromoEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  // ----- Template state -----
  const [selectedTemplate, setSelectedTemplate] = useState<string>('classic')
  const [templateSaving, setTemplateSaving] = useState(false)

  // ----- Upload state -----
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [parseJobId, setParseJobId] = useState<string | null>(null)

  // ----- Add item dialog state -----
  const [dialogOpen, setDialogOpen] = useState(false)
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [itemSku, setItemSku] = useState('')
  const [itemUnit, setItemUnit] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  // ----- Render / export state -----
  const [renderState, setRenderState] = useState<RenderState>('idle')
  const [previewJobId, setPreviewJobId] = useState<string | null>(null)
  const [pdfJobId, setPdfJobId] = useState<string | null>(null)
  const [assets, setAssets] = useState<Array<{ id: string; type: string; url: string; createdAt: string }>>([])

  // ----- Query -----
  const { data, isLoading, error } = useQuery({
    queryKey: ['promo', id],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).promos.get(id)
    },
    enabled: Boolean(id),
  })

  const promo = data?.data

  // Initialise selectedTemplate once promo data is available
  useEffect(() => {
    if (promo?.templateId) {
      setSelectedTemplate(promo.templateId)
    }
  }, [promo?.templateId])

  // ----- Parse job polling -----
  useEffect(() => {
    if (!parseJobId) return

    const interval = setInterval(async () => {
      try {
        const token = await getToken()
        const res = await apiClient(token!).jobs.get(parseJobId)
        const job = res.data
        if (job.status === 'completed' || job.status === 'done') {
          setUploadState('done')
          setParseJobId(null)
          void queryClient.invalidateQueries({ queryKey: ['promo', id] })
          clearInterval(interval)
        } else if (job.status === 'failed') {
          setUploadState('error')
          setUploadError(job.errorMsg ?? 'Parsing failed')
          setParseJobId(null)
          clearInterval(interval)
        }
      } catch {
        // keep polling on transient errors
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [parseJobId, getToken, id, queryClient])

  // ----- Render job polling -----
  useEffect(() => {
    if (!previewJobId && !pdfJobId) return
    if (renderState !== 'rendering') return

    const interval = setInterval(async () => {
      try {
        const token = await getToken()
        const client = apiClient(token!)

        const [previewRes, pdfRes] = await Promise.all([
          previewJobId ? client.jobs.get(previewJobId) : Promise.resolve(null),
          pdfJobId ? client.jobs.get(pdfJobId) : Promise.resolve(null),
        ])

        const previewDone =
          !previewJobId ||
          previewRes?.data.status === 'completed' ||
          previewRes?.data.status === 'done'
        const pdfDone =
          !pdfJobId ||
          pdfRes?.data.status === 'completed' ||
          pdfRes?.data.status === 'done'

        if (previewDone && pdfDone) {
          const assetsRes = await client.promos.getAssets(id)
          setAssets(assetsRes.data)
          setRenderState('done')
          clearInterval(interval)
        }
      } catch {
        // keep polling
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [previewJobId, pdfJobId, renderState, getToken, id])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleTemplateSelect(templateId: string) {
    setSelectedTemplate(templateId)
    setTemplateSaving(true)
    try {
      const token = await getToken()
      await apiClient(token!).promos.patch(id, { templateId })
    } catch {
      // silently fail — local state is updated already
    } finally {
      setTemplateSaving(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadState('uploading')
    setUploadError(null)

    try {
      const token = await getToken()
      const client = apiClient(token!)

      // Step 1: Get presigned upload URL
      const { data: uploadMeta } = await client.promos.getUploadUrl(id, {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
      })

      // Step 2: PUT file directly to S3 (no auth header)
      const s3Res = await fetch(uploadMeta.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      })

      if (!s3Res.ok) {
        throw new Error('Upload to storage failed')
      }

      // Step 3: Trigger parse job
      setUploadState('parsing')
      const { data: parseRes } = await client.promos.triggerParse(id, {
        uploadId: uploadMeta.uploadId,
        s3Key: uploadMeta.s3Key,
      })

      setParseJobId(parseRes.jobId)
    } catch (err) {
      setUploadState('error')
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function resetAddItemDialog() {
    setItemName('')
    setItemPrice('')
    setItemSku('')
    setItemUnit('')
    setAddingItem(false)
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!itemName.trim() || !itemPrice) return

    setAddingItem(true)
    try {
      const token = await getToken()
      const client = apiClient(token!)

      const currentItems = promo?.items ?? []
      const newItems = [
        ...currentItems.map((item) => ({
          name: item.name,
          price: parseFloat(String(item.price)),
          sku: item.sku ?? undefined,
          unit: item.unit ?? undefined,
          category: item.category ?? undefined,
          vendor: item.vendor ?? undefined,
          imageUrl: item.imageUrl ?? undefined,
          sortOrder: item.sortOrder,
        })),
        {
          name: itemName.trim(),
          price: parseFloat(itemPrice),
          sku: itemSku.trim() || undefined,
          unit: itemUnit.trim() || undefined,
          sortOrder: currentItems.length,
        },
      ]

      await client.promos.bulkItems(id, newItems)
      await queryClient.invalidateQueries({ queryKey: ['promo', id] })
      setDialogOpen(false)
      resetAddItemDialog()
    } catch {
      // leave dialog open on error
      setAddingItem(false)
    }
  }

  async function handleDeleteItem(itemId: string) {
    // Optimistic update
    queryClient.setQueryData(['promo', id], (old: typeof data) => {
      if (!old) return old
      return {
        ...old,
        data: {
          ...old.data,
          items: old.data.items.filter((item: PromoItem) => item.id !== itemId),
        },
      }
    })

    try {
      const token = await getToken()
      await apiClient(token!).promos.deleteItem(id, itemId)
    } catch {
      // Revert on failure
      void queryClient.invalidateQueries({ queryKey: ['promo', id] })
    }
  }

  async function handleRender() {
    setRenderState('rendering')
    setAssets([])
    try {
      const token = await getToken()
      const { data: renderData } = await apiClient(token!).promos.render(id)
      const previewJob = renderData.jobs.find((j) => j.type === 'render_preview')
      const pdfJob = renderData.jobs.find((j) => j.type === 'render_pdf')
      setPreviewJobId(previewJob?.jobId ?? null)
      setPdfJobId(pdfJob?.jobId ?? null)
    } catch {
      setRenderState('idle')
    }
  }

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl">
        <Skeleton className="h-5 w-32 mb-6" />
        <Skeleton className="h-8 w-64 mb-3" />
        <Skeleton className="h-5 w-48 mb-8" />
        <Skeleton className="h-48 w-full rounded-xl mb-4" />
        <Skeleton className="h-48 w-full rounded-xl mb-4" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !promo) {
    return (
      <div className="p-8 max-w-4xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <div className="px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
          Failed to load promo. Please try again.
        </div>
      </div>
    )
  }

  const items = promo.items ?? []

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-8 max-w-4xl">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{promo.title}</h1>
          {promo.subhead && (
            <p className="text-slate-500 mt-1">{promo.subhead}</p>
          )}
          {promo.cta && (
            <p className="text-sm text-slate-400 mt-1">CTA: {promo.cta}</p>
          )}
        </div>
        <Badge
          className={`shrink-0 capitalize border ${statusVariant(promo.status)}`}
          variant="outline"
        >
          {promo.status}
        </Badge>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Template                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Template
            {templateSaving && (
              <span className="text-xs font-normal text-slate-400">Saving…</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {TEMPLATES.map((tpl) => {
              const isSelected = selectedTemplate === tpl.id
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => void handleTemplateSelect(tpl.id)}
                  className={[
                    'rounded-lg border p-4 text-left transition-all cursor-pointer',
                    isSelected
                      ? 'ring-2 ring-blue-500 border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <p className="text-sm font-medium text-slate-900">{tpl.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{tpl.description}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Items                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Items ({items.length})</CardTitle>
            <div className="flex items-center gap-2">
              {/* CSV/XLSX upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => void handleFileChange(e)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadState === 'uploading' || uploadState === 'parsing'}
              >
                <Upload className="h-4 w-4" />
                Upload CSV / XLSX
              </Button>

              {/* Add item */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Upload status banner */}
          {uploadState !== 'idle' && (
            <div
              className={[
                'mb-4 rounded-lg px-4 py-2.5 text-sm flex items-center gap-2',
                uploadState === 'uploading' && 'bg-blue-50 text-blue-700',
                uploadState === 'parsing' && 'bg-amber-50 text-amber-700',
                uploadState === 'done' && 'bg-green-50 text-green-700',
                uploadState === 'error' && 'bg-red-50 text-red-700',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {uploadState === 'uploading' && 'Uploading file…'}
              {uploadState === 'parsing' && 'Parsing file — this may take a moment…'}
              {uploadState === 'done' && 'File parsed successfully. Items updated below.'}
              {uploadState === 'error' && (uploadError ?? 'Upload failed. Please try again.')}
              {(uploadState === 'done' || uploadState === 'error') && (
                <button
                  type="button"
                  className="ml-auto text-xs underline opacity-70 hover:opacity-100"
                  onClick={() => {
                    setUploadState('idle')
                    setUploadError(null)
                  }}
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {/* Items table */}
          {items.length === 0 ? (
            <p className="text-sm text-slate-400">
              No items yet — upload a CSV/XLSX or add items manually.
            </p>
          ) : (
            <div className="rounded-lg border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Price</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">SKU</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Unit</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Category</th>
                    <th className="w-10 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-slate-700">{formatPrice(item.price)}</td>
                      <td className="px-4 py-3 text-slate-500">{item.sku ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{item.unit ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{item.category ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void handleDeleteItem(item.id)}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded"
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Export                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Export</CardTitle>
        </CardHeader>
        <CardContent>
          {renderState === 'idle' && (
            <Button onClick={() => void handleRender()} disabled={items.length === 0}>
              <FileDown className="h-4 w-4" />
              Render &amp; Export
            </Button>
          )}

          {renderState === 'rendering' && (
            <div className="flex items-center gap-3">
              <Button disabled>
                <span className="animate-pulse">Rendering…</span>
              </Button>
              <p className="text-sm text-slate-500">
                Generating your preview and PDF — this takes about 15–30 seconds.
              </p>
            </div>
          )}

          {renderState === 'done' && (
            <div className="space-y-3">
              <p className="text-sm text-green-700 font-medium">Render complete.</p>

              {assets.length === 0 ? (
                <p className="text-sm text-slate-500">No assets found — try re-rendering.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {assets
                    .filter((a) => a.type === 'preview')
                    .map((asset) => (
                      <a
                        key={asset.id}
                        href={asset.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        <ImageIcon className="h-4 w-4" />
                        Download Preview (PNG)
                      </a>
                    ))}
                  {assets
                    .filter((a) => a.type === 'pdf')
                    .map((asset) => (
                      <a
                        key={asset.id}
                        href={asset.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        <FileDown className="h-4 w-4" />
                        Download PDF
                      </a>
                    ))}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRenderState('idle')
                  setPreviewJobId(null)
                  setPdfJobId(null)
                  setAssets([])
                }}
              >
                Re-render
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Add item dialog                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetAddItemDialog()
          setDialogOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add item</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleAddItem(e)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Name *</Label>
              <Input
                id="item-name"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Widget Pro"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-price">Price *</Label>
              <Input
                id="item-price"
                type="number"
                step="0.01"
                min="0"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                placeholder="e.g. 9.99"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-sku">SKU</Label>
                <Input
                  id="item-sku"
                  value={itemSku}
                  onChange={(e) => setItemSku(e.target.value)}
                  placeholder="e.g. WGT-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-unit">Unit</Label>
                <Input
                  id="item-unit"
                  value={itemUnit}
                  onChange={(e) => setItemUnit(e.target.value)}
                  placeholder="e.g. each"
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetAddItemDialog()
                  setDialogOpen(false)
                }}
                disabled={addingItem}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addingItem || !itemName.trim() || !itemPrice}>
                {addingItem ? 'Adding…' : 'Add item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
