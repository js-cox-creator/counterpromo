'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Upload, Plus, Trash2, FileDown, ImageIcon, Archive, Mail, ChevronDown, ChevronUp, Copy, Link as LinkIcon, Bookmark, BookmarkCheck, GitBranch, DollarSign } from 'lucide-react'
import { apiClient, type PromoItem, type ProductSnippet, type Branch, type ImportMapping, type CoopItemUpdate } from '@/lib/api'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TemplateCategory = 'general' | 'seasonal' | 'vendor' | 'clearance'

type CategoryTab = 'all' | TemplateCategory

const CATEGORY_TABS: { id: CategoryTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'general', label: 'General' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'clearance', label: 'Clearance' },
]

const TEMPLATES: { id: string; label: string; description: string; category: TemplateCategory }[] = [
  { id: 'classic', label: 'Classic', description: 'Clean grid layout', category: 'general' },
  { id: 'modern', label: 'Modern', description: 'Bold headers with accent colors', category: 'general' },
  { id: 'bold', label: 'Bold', description: 'High-impact promotional style', category: 'general' },
  { id: 'monthly-specials', label: 'Monthly Specials', description: 'List-style with price emphasis', category: 'seasonal' },
  { id: 'vendor-spotlight', label: 'Vendor Spotlight', description: '2-column with vendor branding', category: 'vendor' },
  { id: 'clearance', label: 'Clearance', description: 'Sale layout with badges', category: 'clearance' },
]

type UploadState = 'idle' | 'uploading' | 'parsing' | 'done' | 'error'
type RenderState = 'idle' | 'rendering' | 'done' | 'error'
type ZipState = 'idle' | 'running' | 'done' | 'error'
type EmailState = 'idle' | 'running' | 'done' | 'error'
type ScrapeState = 'idle' | 'submitting' | 'polling' | 'done' | 'error'
type BranchPackState = 'idle' | 'running' | 'done' | 'error'
type CoopSaveState = 'idle' | 'saving' | 'saved' | 'error'
type CoopReportState = 'idle' | 'running' | 'done' | 'error'

interface BranchJobSet {
  branchId: string
  branchName: string
  jobs: { preview: string; pdf: string; social: string; email: string }
  done: boolean
  error: string | null
}

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
  const router = useRouter()
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  // ----- Template state -----
  const [selectedTemplate, setSelectedTemplate] = useState<string>('classic')
  const [templateSaving, setTemplateSaving] = useState(false)
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('all')

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
  const [renderError, setRenderError] = useState<string | null>(null)
  const [previewJobId, setPreviewJobId] = useState<string | null>(null)
  const [pdfJobId, setPdfJobId] = useState<string | null>(null)
  const [socialJobId, setSocialJobId] = useState<string | null>(null)
  const [assets, setAssets] = useState<Array<{ id: string; type: string; url: string; createdAt: string }>>([])
  const [socialCaptions, setSocialCaptions] = useState<{ facebook: string; instagram: string; linkedin: string } | null>(null)
  const [captionsOpen, setCaptionsOpen] = useState(false)

  // ----- ZIP state -----
  const [zipState, setZipState] = useState<ZipState>('idle')
  const [zipJobId, setZipJobId] = useState<string | null>(null)
  const [zipUrl, setZipUrl] = useState<string | null>(null)
  const [zipError, setZipError] = useState<string | null>(null)

  // ----- Email state -----
  const [emailState, setEmailState] = useState<EmailState>('idle')
  const [emailJobId, setEmailJobId] = useState<string | null>(null)
  const [emailUrl, setEmailUrl] = useState<string | null>(null)
  const [emailSubject, setEmailSubject] = useState<string | null>(null)
  const [emailPreheader, setEmailPreheader] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  // ----- URL scrape state -----
  const [urlInputVisible, setUrlInputVisible] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [urlScrapeState, setUrlScrapeState] = useState<ScrapeState>('idle')
  const [urlScrapeJobId, setUrlScrapeJobId] = useState<string | null>(null)
  const [urlScrapeError, setUrlScrapeError] = useState<string | null>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)

  // ----- Snippets state -----
  const [snippetsPopoverOpen, setSnippetsPopoverOpen] = useState(false)
  const [savedItemIds, setSavedItemIds] = useState<Set<string>>(new Set())
  const [addingSnippetId, setAddingSnippetId] = useState<string | null>(null)

  // ----- Branch state -----
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [branchSaving, setBranchSaving] = useState(false)

  // ----- Mapping picker state -----
  const [selectedMappingId, setSelectedMappingId] = useState<string>('')

  // ----- Branch export pack state -----
  const [branchPackState, setBranchPackState] = useState<BranchPackState>('idle')
  const [branchPackError, setBranchPackError] = useState<string | null>(null)
  const [branchJobs, setBranchJobs] = useState<BranchJobSet[]>([])
  const [branchPackOpen, setBranchPackOpen] = useState(false)

  // ----- Co-op state -----
  const [coopOpen, setCoopOpen] = useState(false)
  const [coopEdits, setCoopEdits] = useState<Record<string, { vendor: string; amount: string; note: string }>>({})
  const [coopSaveState, setCoopSaveState] = useState<CoopSaveState>('idle')
  const [coopSaveError, setCoopSaveError] = useState<string | null>(null)
  const [coopReportState, setCoopReportState] = useState<CoopReportState>('idle')
  const [coopReportJobId, setCoopReportJobId] = useState<string | null>(null)
  const [coopReportUrl, setCoopReportUrl] = useState<string | null>(null)
  const [coopReportError, setCoopReportError] = useState<string | null>(null)

  // ----- Duplicate -----
  const duplicate = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      return apiClient(token!).promos.duplicate(id)
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['promos'] })
      router.push(`/promos/${res.data.id}`)
    },
  })

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

  const { data: snippetsData } = useQuery({
    queryKey: ['snippets'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).snippets.list()
    },
  })
  const snippets: ProductSnippet[] = snippetsData?.data ?? []

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).branches.list()
    },
  })
  const branches: Branch[] = branchesData?.data ?? []

  const { data: mappingsData } = useQuery({
    queryKey: ['import-mappings'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).importMappings.list()
    },
  })
  const importMappings: ImportMapping[] = mappingsData?.data ?? []

  const { data: coopData } = useQuery({
    queryKey: ['coop-items', id],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).coop.getItems(id)
    },
    enabled: coopOpen,
  })
  const coopItems = coopData?.data ?? []

  const { data: coopReportAssetData } = useQuery({
    queryKey: ['coop-report-asset', id],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).coop.getReportAsset(id)
    },
    enabled: coopOpen,
  })

  // Initialise selectedTemplate once promo data is available
  useEffect(() => {
    if (promo?.templateId) {
      setSelectedTemplate(promo.templateId)
    }
  }, [promo?.templateId])

  // Initialise selectedBranchId from promo
  useEffect(() => {
    setSelectedBranchId(promo?.branchId ?? null)
  }, [promo?.branchId])

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

  // ----- URL scrape job polling -----
  useEffect(() => {
    if (!urlScrapeJobId || urlScrapeState !== 'polling') return

    const interval = setInterval(async () => {
      try {
        const token = await getToken()
        const res = await apiClient(token!).jobs.get(urlScrapeJobId)
        const job = res.data
        if (job.status === 'completed' || job.status === 'done') {
          void queryClient.invalidateQueries({ queryKey: ['promo', id] })
          setUrlScrapeState('done')
          setUrlScrapeJobId(null)
          setUrlInputVisible(false)
          setUrlValue('')
          clearInterval(interval)
        } else if (job.status === 'failed') {
          setUrlScrapeState('error')
          setUrlScrapeError(job.errorMsg ?? 'Scrape failed')
          setUrlScrapeJobId(null)
          clearInterval(interval)
        }
      } catch {
        // keep polling on transient errors
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [urlScrapeJobId, urlScrapeState, getToken, id, queryClient])

  // ----- Branch pack polling -----
  useEffect(() => {
    if (branchPackState !== 'running' || branchJobs.length === 0) return

    const interval = setInterval(async () => {
      try {
        const token = await getToken()
        const client = apiClient(token!)

        const updated = await Promise.all(
          branchJobs.map(async (b) => {
            if (b.done || b.error) return b
            const [p, pdf, s, e] = await Promise.all([
              client.jobs.get(b.jobs.preview),
              client.jobs.get(b.jobs.pdf),
              client.jobs.get(b.jobs.social),
              client.jobs.get(b.jobs.email),
            ])
            const statuses = [p.data.status, pdf.data.status, s.data.status, e.data.status]
            const anyFailed = statuses.some((st) => st === 'failed')
            const allDone = statuses.every((st) => st === 'done' || st === 'completed')
            if (anyFailed) {
              const failedMsg = [p, pdf, s, e].find((r) => r.data.status === 'failed')?.data.errorMsg
              return { ...b, done: false, error: failedMsg ?? 'Render failed' }
            }
            return { ...b, done: allDone, error: null }
          }),
        )

        setBranchJobs(updated)

        const allSettled = updated.every((b) => b.done || b.error !== null)
        if (allSettled) {
          setBranchPackState('done')
          clearInterval(interval)
        }
      } catch {
        // keep polling on transient errors
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [branchPackState, branchJobs, getToken])

  // ----- Co-op report polling -----
  useEffect(() => {
    if (!coopReportJobId || coopReportState !== 'running') return

    const interval = setInterval(async () => {
      try {
        const token = await getToken()
        const res = await apiClient(token!).jobs.get(coopReportJobId)
        const job = res.data
        if (job.status === 'completed' || job.status === 'done') {
          const assetRes = await apiClient(token!).coop.getReportAsset(id)
          setCoopReportUrl(assetRes.data.url)
          setCoopReportState('done')
          setCoopReportJobId(null)
          clearInterval(interval)
        } else if (job.status === 'failed') {
          setCoopReportError(job.errorMsg ?? 'Report generation failed')
          setCoopReportState('error')
          setCoopReportJobId(null)
          clearInterval(interval)
        }
      } catch {
        // keep polling on transient errors
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [coopReportJobId, coopReportState, getToken, id])

  // ----- Render job polling -----
  useEffect(() => {
    if (!previewJobId && !pdfJobId && !socialJobId) return
    if (renderState !== 'rendering') return

    const interval = setInterval(async () => {
      try {
        const token = await getToken()
        const client = apiClient(token!)

        const [previewRes, pdfRes, socialRes] = await Promise.all([
          previewJobId ? client.jobs.get(previewJobId) : Promise.resolve(null),
          pdfJobId ? client.jobs.get(pdfJobId) : Promise.resolve(null),
          socialJobId ? client.jobs.get(socialJobId) : Promise.resolve(null),
        ])

        const previewStatus = previewRes?.data.status
        const pdfStatus = pdfRes?.data.status
        const socialStatus = socialRes?.data.status

        const previewDone = !previewJobId || previewStatus === 'completed' || previewStatus === 'done'
        const pdfDone = !pdfJobId || pdfStatus === 'completed' || pdfStatus === 'done'
        const socialDone = !socialJobId || socialStatus === 'completed' || socialStatus === 'done'
        const anyFailed = previewStatus === 'failed' || pdfStatus === 'failed' || socialStatus === 'failed'

        if (anyFailed) {
          const failedMsg =
            previewStatus === 'failed'
              ? previewRes?.data.errorMsg
              : pdfStatus === 'failed'
                ? pdfRes?.data.errorMsg
                : socialRes?.data.errorMsg
          setRenderError(failedMsg ?? 'Render job failed — check worker logs.')
          setRenderState('error')
          clearInterval(interval)
        } else if (previewDone && pdfDone && socialDone) {
          const assetsRes = await client.promos.getAssets(id)
          setAssets(assetsRes.data)

          // Extract social captions from the social job result
          if (socialRes?.data.result) {
            const result = socialRes.data.result as { captions?: { facebook: string; instagram: string; linkedin: string } }
            if (result.captions) {
              setSocialCaptions(result.captions)
            }
          }

          setRenderState('done')
          clearInterval(interval)
        }
      } catch {
        // keep polling on transient errors
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [previewJobId, pdfJobId, socialJobId, renderState, getToken, id])

  // ----- ZIP job polling -----
  useEffect(() => {
    if (!zipJobId || zipState !== 'running') return

    const interval = setInterval(async () => {
      try {
        const token = await getToken()
        const res = await apiClient(token!).jobs.get(zipJobId)
        const job = res.data
        if (job.status === 'completed' || job.status === 'done') {
          // Fetch fresh assets to get the ZIP download URL
          const assetsRes = await apiClient(token!).promos.getAssets(id)
          const zipAsset = assetsRes.data.find((a) => a.type === 'zip')
          setZipUrl(zipAsset?.url ?? null)
          setZipState('done')
          setZipJobId(null)
          clearInterval(interval)
        } else if (job.status === 'failed') {
          setZipError(job.errorMsg ?? 'ZIP export failed')
          setZipState('error')
          setZipJobId(null)
          clearInterval(interval)
        }
      } catch {
        // keep polling on transient errors
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [zipJobId, zipState, getToken, id])

  // ----- Email job polling -----
  useEffect(() => {
    if (!emailJobId || emailState !== 'running') return

    const interval = setInterval(async () => {
      try {
        const token = await getToken()
        const res = await apiClient(token!).jobs.get(emailJobId)
        const job = res.data
        if (job.status === 'completed' || job.status === 'done') {
          const result = job.result as { subject?: string; preheader?: string } | null
          setEmailSubject(result?.subject ?? null)
          setEmailPreheader(result?.preheader ?? null)
          // Fetch fresh assets to get the email HTML download URL
          const assetsRes = await apiClient(token!).promos.getAssets(id)
          const emailAsset = assetsRes.data.find((a) => a.type === 'email_html')
          setEmailUrl(emailAsset?.url ?? null)
          setEmailState('done')
          setEmailJobId(null)
          clearInterval(interval)
        } else if (job.status === 'failed') {
          setEmailError(job.errorMsg ?? 'Email generation failed')
          setEmailState('error')
          setEmailJobId(null)
          clearInterval(interval)
        }
      } catch {
        // keep polling on transient errors
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [emailJobId, emailState, getToken, id])

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
        ...(selectedMappingId ? { mappingId: selectedMappingId } : {}),
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
    setRenderError(null)
    setAssets([])
    setSocialCaptions(null)
    setCaptionsOpen(false)
    setZipState('idle')
    setZipUrl(null)
    setEmailState('idle')
    setEmailUrl(null)
    setEmailSubject(null)
    setEmailPreheader(null)
    try {
      const token = await getToken()
      const { data: renderData } = await apiClient(token!).promos.render(id)
      const previewJob = renderData.jobs.find((j) => j.type === 'render_preview')
      const pdfJob = renderData.jobs.find((j) => j.type === 'render_pdf')
      const socialJob = renderData.jobs.find((j) => j.type === 'render_social_image')
      setPreviewJobId(previewJob?.jobId ?? null)
      setPdfJobId(pdfJob?.jobId ?? null)
      setSocialJobId(socialJob?.jobId ?? null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start render'
      setRenderError(msg)
      setRenderState('error')
    }
  }

  async function handleExportZip() {
    setZipState('running')
    setZipError(null)
    setZipUrl(null)
    try {
      const token = await getToken()
      const { data: jobData } = await apiClient(token!).promos.exportZip(id)
      setZipJobId(jobData.jobId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start ZIP export'
      setZipError(msg)
      setZipState('error')
    }
  }

  async function handleGenerateEmail() {
    setEmailState('running')
    setEmailError(null)
    setEmailUrl(null)
    setEmailSubject(null)
    setEmailPreheader(null)
    try {
      const token = await getToken()
      const { data: jobData } = await apiClient(token!).promos.renderEmail(id)
      setEmailJobId(jobData.jobId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start email generation'
      setEmailError(msg)
      setEmailState('error')
    }
  }

  async function handleUrlScrape(e: React.FormEvent) {
    e.preventDefault()
    if (!urlValue.trim()) return

    setUrlScrapeState('submitting')
    setUrlScrapeError(null)

    try {
      const token = await getToken()
      const { data: scrapeData } = await apiClient(token!).promos.itemFromUrl(id, { url: urlValue.trim() })
      void queryClient.invalidateQueries({ queryKey: ['promo', id] })
      setUrlScrapeJobId(scrapeData.jobId)
      setUrlScrapeState('polling')
    } catch (err) {
      setUrlScrapeState('error')
      setUrlScrapeError(err instanceof Error ? err.message : 'Failed to start scrape')
    }
  }

  async function handleSaveAsSnippet(item: PromoItem) {
    try {
      const token = await getToken()
      await apiClient(token!).snippets.create({
        name: item.name,
        price: parseFloat(String(item.price)),
        sku: item.sku ?? undefined,
        unit: item.unit ?? undefined,
        category: item.category ?? undefined,
        vendor: item.vendor ?? undefined,
        imageUrl: item.imageUrl ?? undefined,
      })
      void queryClient.invalidateQueries({ queryKey: ['snippets'] })
      setSavedItemIds((prev) => new Set(prev).add(item.id))
      setTimeout(() => {
        setSavedItemIds((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
      }, 2000)
    } catch {
      // silently fail
    }
  }

  async function handleAddFromSnippet(snippet: ProductSnippet) {
    setAddingSnippetId(snippet.id)
    try {
      const token = await getToken()
      await apiClient(token!).promos.itemFromSnippet(id, snippet.id)
      void queryClient.invalidateQueries({ queryKey: ['promo', id] })
      setSnippetsPopoverOpen(false)
    } catch {
      // silently fail
    } finally {
      setAddingSnippetId(null)
    }
  }

  async function handleBranchChange(branchId: string) {
    const newVal = branchId === '__none__' ? null : branchId
    setSelectedBranchId(newVal)
    setBranchSaving(true)
    try {
      const token = await getToken()
      await apiClient(token!).promos.patch(id, { branchId: newVal })
    } catch {
      // silently fail — local state updated already
    } finally {
      setBranchSaving(false)
    }
  }

  async function handleRenderBranchPack() {
    setBranchPackState('running')
    setBranchPackError(null)
    setBranchJobs([])
    try {
      const token = await getToken()
      const { data } = await apiClient(token!).promos.renderBranchPack(id)
      setBranchJobs(
        data.branches.map((b) => ({ ...b, done: false, error: null })),
      )
      setBranchPackOpen(true)
    } catch (err) {
      setBranchPackError(err instanceof Error ? err.message : 'Failed to start branch render')
      setBranchPackState('error')
    }
  }

  function setCoopField(itemId: string, field: 'vendor' | 'amount' | 'note', value: string) {
    setCoopEdits((prev) => {
      const current = prev[itemId] ?? { vendor: '', amount: '', note: '' }
      return { ...prev, [itemId]: { ...current, [field]: value } }
    })
  }

  function getCoopField(item: { id: string; coopVendor: string | null; coopAmount: string | null; coopNote: string | null }, field: 'vendor' | 'amount' | 'note'): string {
    const edit = coopEdits[item.id]
    if (field === 'vendor') return edit?.vendor ?? item.coopVendor ?? ''
    if (field === 'amount') return edit?.amount ?? (item.coopAmount ? String(parseFloat(item.coopAmount)) : '')
    return edit?.note ?? item.coopNote ?? ''
  }

  async function handleSaveCoopData() {
    setCoopSaveState('saving')
    setCoopSaveError(null)
    try {
      const token = await getToken()
      const updates: CoopItemUpdate[] = coopItems.map((item) => ({
        itemId: item.id,
        coopVendor: getCoopField(item, 'vendor') || undefined,
        coopAmount: getCoopField(item, 'amount') ? parseFloat(getCoopField(item, 'amount')) : undefined,
        coopNote: getCoopField(item, 'note') || undefined,
      }))
      await apiClient(token!).coop.updateItems(id, updates)
      void queryClient.invalidateQueries({ queryKey: ['coop-items', id] })
      setCoopEdits({})
      setCoopSaveState('saved')
      setTimeout(() => setCoopSaveState('idle'), 2000)
    } catch (err) {
      setCoopSaveError(err instanceof Error ? err.message : 'Failed to save co-op data')
      setCoopSaveState('error')
    }
  }

  async function handleGenerateCoopReport() {
    setCoopReportState('running')
    setCoopReportError(null)
    setCoopReportUrl(null)
    try {
      const token = await getToken()
      const { data } = await apiClient(token!).coop.generateReport(id)
      setCoopReportJobId(data.jobId)
    } catch (err) {
      setCoopReportError(err instanceof Error ? err.message : 'Failed to start report')
      setCoopReportState('error')
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
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {branches.length > 0 && (
            <div className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedBranchId ?? '__none__'}
                onChange={(e) => void handleBranchChange(e.target.value)}
                disabled={branchSaving}
                className="text-sm border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="__none__">No branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => duplicate.mutate()}
            disabled={duplicate.isPending}
          >
            <Copy className="h-4 w-4" />
            {duplicate.isPending ? 'Duplicating…' : 'Duplicate'}
          </Button>
          <Badge
            className={`capitalize border ${statusVariant(promo.status)}`}
            variant="outline"
          >
            {promo.status}
          </Badge>
        </div>
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
          {/* Category filter tabs */}
          <div className="flex gap-1 mb-4 border-b border-slate-100 pb-3">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryTab(tab.id)}
                className={[
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  categoryTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Template grid */}
          <div className="grid grid-cols-3 gap-3">
            {TEMPLATES.filter((tpl) => categoryTab === 'all' || tpl.category === categoryTab).map((tpl) => {
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
              {importMappings.length > 0 && (
                <select
                  value={selectedMappingId}
                  onChange={(e) => setSelectedMappingId(e.target.value)}
                  className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Column mapping profile"
                >
                  <option value="">Auto-detect columns</option>
                  {importMappings.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadState === 'uploading' || uploadState === 'parsing'}
              >
                <Upload className="h-4 w-4" />
                Upload CSV / XLSX
              </Button>

              {/* Add from URL */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUrlInputVisible((v) => !v)
                  setUrlScrapeState('idle')
                  setUrlScrapeError(null)
                  setUrlValue('')
                }}
              >
                <LinkIcon className="h-4 w-4" />
                Add from URL
              </Button>

              {/* From snippets popover */}
              <Popover open={snippetsPopoverOpen} onOpenChange={setSnippetsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Bookmark className="h-4 w-4" />
                    From snippets
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-2">
                  {snippets.length === 0 ? (
                    <p className="text-sm text-slate-400 px-2 py-1">No snippets saved yet.</p>
                  ) : (
                    <div className="space-y-0.5 max-h-64 overflow-y-auto">
                      {snippets.map((snippet) => (
                        <button
                          key={snippet.id}
                          type="button"
                          disabled={addingSnippetId === snippet.id}
                          onClick={() => void handleAddFromSnippet(snippet)}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 transition-colors disabled:opacity-50"
                        >
                          <p className="text-sm font-medium text-slate-900 truncate">{snippet.name}</p>
                          <p className="text-xs text-slate-500">
                            ${parseFloat(String(snippet.price)).toFixed(2)}
                            {snippet.unit ? ` / ${snippet.unit}` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>

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
          {/* Inline URL input */}
          {urlInputVisible && (
            <form onSubmit={(e) => void handleUrlScrape(e)} className="mb-4 flex items-center gap-2">
              <Input
                ref={urlInputRef}
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://example.com/product"
                className="flex-1"
                autoFocus
                disabled={urlScrapeState === 'submitting' || urlScrapeState === 'polling'}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!urlValue.trim() || urlScrapeState === 'submitting' || urlScrapeState === 'polling'}
              >
                {urlScrapeState === 'submitting' || urlScrapeState === 'polling' ? 'Loading…' : 'Go'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setUrlInputVisible(false)
                  setUrlScrapeState('idle')
                  setUrlScrapeError(null)
                  setUrlValue('')
                }}
              >
                Cancel
              </Button>
            </form>
          )}
          {urlScrapeError && urlInputVisible && (
            <p className="mb-3 text-sm text-red-600">{urlScrapeError}</p>
          )}

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
                    <th className="w-20 px-4 py-2.5" />
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
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleSaveAsSnippet(item)}
                            className={`p-1 transition-colors rounded ${savedItemIds.has(item.id) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}
                            aria-label={`Save ${item.name} as snippet`}
                          >
                            {savedItemIds.has(item.id) ? (
                              <BookmarkCheck className="h-4 w-4" />
                            ) : (
                              <Bookmark className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteItem(item.id)}
                            className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded"
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
          {(renderState === 'idle' || renderState === 'error') && (
            <div className="space-y-3">
              <Button onClick={() => void handleRender()} disabled={items.length === 0}>
                <FileDown className="h-4 w-4" />
                Render &amp; Export
              </Button>
              {renderError && (
                <p className="text-sm text-red-600">{renderError}</p>
              )}
            </div>
          )}

          {renderState === 'rendering' && (
            <div className="flex items-center gap-3">
              <Button disabled>
                <span className="animate-pulse">Rendering…</span>
              </Button>
              <p className="text-sm text-slate-500">
                Generating preview, PDF, and social image — this takes about 30–60 seconds.
              </p>
            </div>
          )}

          {renderState === 'done' && (
            <div className="space-y-4">
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
                  {assets
                    .filter((a) => a.type === 'social_image')
                    .map((asset) => (
                      <a
                        key={asset.id}
                        href={asset.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        <ImageIcon className="h-4 w-4" />
                        Download Social Image (1080×1080)
                      </a>
                    ))}
                </div>
              )}

              {/* Social captions */}
              {socialCaptions && (socialCaptions.facebook || socialCaptions.instagram || socialCaptions.linkedin) && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCaptionsOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Social captions (AI-generated)
                    {captionsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {captionsOpen && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {socialCaptions.facebook && (
                        <div className="px-4 py-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Facebook</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{socialCaptions.facebook}</p>
                        </div>
                      )}
                      {socialCaptions.instagram && (
                        <div className="px-4 py-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Instagram</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{socialCaptions.instagram}</p>
                        </div>
                      )}
                      {socialCaptions.linkedin && (
                        <div className="px-4 py-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">LinkedIn</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{socialCaptions.linkedin}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Branch export pack */}
              {branches.length > 0 && (
                <div className="pt-1 border-t border-slate-100">
                  {branchPackState === 'idle' && (
                    <Button variant="outline" size="sm" onClick={() => void handleRenderBranchPack()}>
                      <GitBranch className="h-4 w-4" />
                      Render for all branches
                    </Button>
                  )}
                  {branchPackState === 'running' && (
                    <p className="text-sm text-slate-500 animate-pulse">Rendering branch pack…</p>
                  )}
                  {(branchPackState === 'running' || branchPackState === 'done') && branchJobs.length > 0 && (
                    <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setBranchPackOpen((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Branch downloads ({branchJobs.filter((b) => b.done).length}/{branchJobs.length} ready)
                        {branchPackOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {branchPackOpen && (
                        <div className="border-t border-slate-100 divide-y divide-slate-50">
                          {branchJobs.map((branch) => (
                            <div key={branch.branchId} className="px-4 py-3">
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{branch.branchName}</p>
                              {branch.error ? (
                                <p className="text-xs text-red-600">{branch.error}</p>
                              ) : branch.done ? (
                                <p className="text-xs text-green-600">Ready — refresh assets to download</p>
                              ) : (
                                <p className="text-xs text-slate-400 animate-pulse">Rendering…</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {branchPackState === 'error' && (
                    <p className="text-sm text-red-600 mt-1">{branchPackError ?? 'Branch render failed.'}</p>
                  )}
                </div>
              )}

              {/* ZIP download */}
              <div className="pt-1 border-t border-slate-100">
                {zipState === 'idle' && (
                  <Button variant="outline" size="sm" onClick={() => void handleExportZip()}>
                    <Archive className="h-4 w-4" />
                    Download all as ZIP
                  </Button>
                )}
                {zipState === 'running' && (
                  <p className="text-sm text-slate-500 animate-pulse">Bundling ZIP…</p>
                )}
                {zipState === 'done' && zipUrl && (
                  <a
                    href={zipUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    <Archive className="h-4 w-4" />
                    Download ZIP
                  </a>
                )}
                {zipState === 'error' && (
                  <p className="text-sm text-red-600">{zipError ?? 'ZIP export failed.'}</p>
                )}
              </div>

              {/* Email generation */}
              <div className="pt-1 border-t border-slate-100">
                {emailState === 'idle' && (
                  <Button variant="outline" size="sm" onClick={() => void handleGenerateEmail()}>
                    <Mail className="h-4 w-4" />
                    Generate Email
                  </Button>
                )}
                {emailState === 'running' && (
                  <p className="text-sm text-slate-500 animate-pulse">Generating email…</p>
                )}
                {emailState === 'done' && (
                  <div className="space-y-2">
                    {emailSubject && (
                      <div className="bg-slate-50 rounded-lg px-4 py-3 space-y-1">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</p>
                        <p className="text-sm text-slate-800 font-medium">{emailSubject}</p>
                        {emailPreheader && (
                          <>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-2">Preheader</p>
                            <p className="text-sm text-slate-600">{emailPreheader}</p>
                          </>
                        )}
                      </div>
                    )}
                    {emailUrl && (
                      <a
                        href={emailUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        <Mail className="h-4 w-4" />
                        Download Email HTML
                      </a>
                    )}
                  </div>
                )}
                {emailState === 'error' && (
                  <p className="text-sm text-red-600">{emailError ?? 'Email generation failed.'}</p>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRenderState('idle')
                  setRenderError(null)
                  setPreviewJobId(null)
                  setPdfJobId(null)
                  setSocialJobId(null)
                  setAssets([])
                  setSocialCaptions(null)
                  setCaptionsOpen(false)
                  setZipState('idle')
                  setZipUrl(null)
                  setEmailState('idle')
                  setEmailUrl(null)
                  setEmailSubject(null)
                  setEmailPreheader(null)
                  setBranchPackState('idle')
                  setBranchPackError(null)
                  setBranchJobs([])
                  setBranchPackOpen(false)
                }}
              >
                Re-render
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Co-op Tracking                                           */}
      {/* ------------------------------------------------------------------ */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <button
            type="button"
            onClick={() => setCoopOpen((v) => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-slate-400" />
              Co-op Tracking
            </CardTitle>
            {coopOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
        </CardHeader>
        {coopOpen && (
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">Add items to the promo first.</p>
            ) : (
              <>
                <div className="rounded-lg border border-slate-100 overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-slate-600">Item</th>
                        <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-36">Vendor</th>
                        <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-28">Amount ($)</th>
                        <th className="text-left px-4 py-2.5 font-medium text-slate-600">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {coopItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-slate-900 truncate max-w-[160px]">{item.name}</td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              value={getCoopField(item, 'vendor')}
                              onChange={(e) => setCoopField(item.id, 'vendor', e.target.value)}
                              placeholder="e.g. Trex"
                              className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={getCoopField(item, 'amount')}
                              onChange={(e) => setCoopField(item.id, 'amount', e.target.value)}
                              placeholder="0.00"
                              className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              value={getCoopField(item, 'note')}
                              onChange={(e) => setCoopField(item.id, 'note', e.target.value)}
                              placeholder="Optional note"
                              className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => void handleSaveCoopData()}
                    disabled={coopSaveState === 'saving'}
                  >
                    {coopSaveState === 'saving' ? 'Saving…' : coopSaveState === 'saved' ? 'Saved ✓' : 'Save co-op data'}
                  </Button>

                  {coopSaveState === 'error' && (
                    <span className="text-sm text-red-600">{coopSaveError}</span>
                  )}

                  {coopReportState === 'idle' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleGenerateCoopReport()}
                    >
                      <FileDown className="h-4 w-4" />
                      Generate Report
                    </Button>
                  )}
                  {coopReportState === 'running' && (
                    <p className="text-sm text-slate-500 animate-pulse">Generating report…</p>
                  )}
                  {coopReportState === 'done' && coopReportUrl && (
                    <a
                      href={coopReportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      <FileDown className="h-4 w-4" />
                      Download CSV Report
                    </a>
                  )}
                  {coopReportState === 'error' && (
                    <span className="text-sm text-red-600">{coopReportError}</span>
                  )}
                  {coopReportState === 'idle' && coopReportAssetData?.data.url && (
                    <a
                      href={coopReportAssetData.data.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate-500 hover:text-slate-700 underline"
                    >
                      Previous report
                    </a>
                  )}
                </div>
              </>
            )}
          </CardContent>
        )}
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
