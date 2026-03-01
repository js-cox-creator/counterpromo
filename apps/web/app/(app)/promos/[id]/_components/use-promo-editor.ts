'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { apiClient, type PromoItem, type ProductSnippet, type Branch, type ImportMapping, type CoopItemUpdate } from '@/lib/api'

export type UploadState = 'idle' | 'uploading' | 'parsing' | 'done' | 'error'
export type RenderState = 'idle' | 'rendering' | 'done' | 'error'
export type ZipState = 'idle' | 'running' | 'done' | 'error'
export type EmailState = 'idle' | 'running' | 'done' | 'error'
export type ScrapeState = 'idle' | 'submitting' | 'polling' | 'done' | 'error'
export type BranchPackState = 'idle' | 'running' | 'done' | 'error'
export type CoopSaveState = 'idle' | 'saving' | 'saved' | 'error'
export type CoopReportState = 'idle' | 'running' | 'done' | 'error'

export interface BranchJobSet {
  branchId: string
  branchName: string
  jobs: { preview: string; pdf: string; social: string; email: string }
  done: boolean
  error: string | null
}

export function usePromoEditor(id: string) {
  const router = useRouter()
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  // ----- Template state -----
  const [selectedTemplate, setSelectedTemplate] = useState<string>('classic')
  const [templateSaving, setTemplateSaving] = useState(false)

  // ----- Keywords state -----
  const [keywords, setKeywords] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [countFilter, setCountFilter] = useState<string>('any')
  const [pagesFilter, setPagesFilter] = useState<string>('any')

  // ----- Details editing state -----
  const [localTitle, setLocalTitle] = useState('')
  const [localSubhead, setLocalSubhead] = useState('')
  const [localCta, setLocalCta] = useState('')

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
  const [socialCaptions, setSocialCaptions] = useState<{ facebook: string; instagram: string; linkedin: string } | null>(null)

  // ----- ZIP state -----
  const [zipState, setZipState] = useState<ZipState>('idle')
  const [zipJobId, setZipJobId] = useState<string | null>(null)
  const [zipError, setZipError] = useState<string | null>(null)

  // ----- Email state -----
  const [emailState, setEmailState] = useState<EmailState>('idle')
  const [emailJobId, setEmailJobId] = useState<string | null>(null)
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

  // ----- Queries -----
  const { data, isLoading, error } = useQuery({
    queryKey: ['promo', id],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).promos.get(id)
    },
    enabled: Boolean(id),
  })
  const promo = data?.data

  const { data: assetsData } = useQuery({
    queryKey: ['promo-assets', id],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).promos.getAssets(id)
    },
    enabled: Boolean(id),
  })
  const assets = assetsData?.data ?? []

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

  // ----- Init effects -----
  useEffect(() => {
    if (promo?.templateId) setSelectedTemplate(promo.templateId)
  }, [promo?.templateId])

  useEffect(() => {
    setSelectedBranchId(promo?.branchId ?? null)
  }, [promo?.branchId])

  useEffect(() => {
    if (promo) {
      setLocalTitle(promo.title ?? '')
      setLocalSubhead(promo.subhead ?? '')
      setLocalCta(promo.cta ?? '')
      setKeywords(promo.keywords ?? [])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promo?.id]) // only on initial load, not every patch

  // ----- beforeunload warning during renders -----
  useEffect(() => {
    const busy = renderState === 'rendering' || zipState === 'running' || emailState === 'running'
    if (!busy) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [renderState, zipState, emailState])

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
      } catch { /* keep polling */ }
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
      } catch { /* keep polling */ }
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
        if (updated.every((b) => b.done || b.error !== null)) {
          setBranchPackState('done')
          clearInterval(interval)
        }
      } catch { /* keep polling */ }
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
      } catch { /* keep polling */ }
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
          if (socialRes?.data.result) {
            const result = socialRes.data.result as { captions?: { facebook: string; instagram: string; linkedin: string } }
            if (result.captions) setSocialCaptions(result.captions)
          }
          void queryClient.invalidateQueries({ queryKey: ['promo-assets', id] })
          setRenderState('done')
          clearInterval(interval)
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [previewJobId, pdfJobId, socialJobId, renderState, getToken, id, queryClient])

  // ----- ZIP job polling -----
  useEffect(() => {
    if (!zipJobId || zipState !== 'running') return
    const interval = setInterval(async () => {
      try {
        const token = await getToken()
        const res = await apiClient(token!).jobs.get(zipJobId)
        const job = res.data
        if (job.status === 'completed' || job.status === 'done') {
          const assetsRes = await apiClient(token!).promos.getAssets(id)
          const zipAsset = assetsRes.data.find((a) => a.type === 'zip')
          if (zipAsset) blobDownload(zipAsset.url, `${promo?.title ?? 'promo'}.zip`)
          void queryClient.invalidateQueries({ queryKey: ['promo-assets', id] })
          setZipState('done')
          setZipJobId(null)
          clearInterval(interval)
        } else if (job.status === 'failed') {
          setZipError(job.errorMsg ?? 'ZIP export failed')
          setZipState('error')
          setZipJobId(null)
          clearInterval(interval)
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipJobId, zipState, getToken, id, queryClient])

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
          const assetsRes = await apiClient(token!).promos.getAssets(id)
          const emailAsset = assetsRes.data.find((a) => a.type === 'email_html')
          if (emailAsset) blobDownload(emailAsset.url, `${promo?.title ?? 'promo'}-email.html`)
          setEmailState('done')
          setEmailJobId(null)
          clearInterval(interval)
        } else if (job.status === 'failed') {
          setEmailError(job.errorMsg ?? 'Email generation failed')
          setEmailState('error')
          setEmailJobId(null)
          clearInterval(interval)
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailJobId, emailState, getToken, id])

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function blobDownload(url: string, filename: string) {
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = filename
        a.click()
        URL.revokeObjectURL(objectUrl)
      })
      .catch(() => { /* silently fail */ })
  }

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
      // silently fail
    } finally {
      setTemplateSaving(false)
    }
  }

  async function handlePatchPromo(patch: { title?: string; subhead?: string | null; cta?: string | null }) {
    try {
      const token = await getToken()
      await apiClient(token!).promos.patch(id, patch)
      void queryClient.invalidateQueries({ queryKey: ['promo', id] })
    } catch { /* silently fail */ }
  }

  async function handleKeywordsChange(kws: string[]) {
    setKeywords(kws)
    try {
      const token = await getToken()
      await apiClient(token!).promos.patch(id, { keywords: kws })
    } catch { /* silently fail */ }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadState('uploading')
    setUploadError(null)
    try {
      const token = await getToken()
      const client = apiClient(token!)
      const { data: uploadMeta } = await client.promos.getUploadUrl(id, {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
      })
      const s3Res = await fetch(uploadMeta.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
      if (!s3Res.ok) throw new Error('Upload to storage failed')
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
      setAddingItem(false)
    }
  }

  async function handleDeleteItem(itemId: string) {
    queryClient.setQueryData(['promo', id], (old: typeof data) => {
      if (!old) return old
      return { ...old, data: { ...old.data, items: old.data.items.filter((item: PromoItem) => item.id !== itemId) } }
    })
    try {
      const token = await getToken()
      await apiClient(token!).promos.deleteItem(id, itemId)
    } catch {
      void queryClient.invalidateQueries({ queryKey: ['promo', id] })
    }
  }

  async function handleRender() {
    setRenderState('rendering')
    setRenderError(null)
    setSocialCaptions(null)
    setZipState('idle')
    setEmailState('idle')
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
      setRenderError(err instanceof Error ? err.message : 'Failed to start render')
      setRenderState('error')
    }
  }

  async function handleExportZip() {
    setZipState('running')
    setZipError(null)
    try {
      const token = await getToken()
      const { data: jobData } = await apiClient(token!).promos.exportZip(id)
      setZipJobId(jobData.jobId)
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Failed to start ZIP export')
      setZipState('error')
    }
  }

  async function handleGenerateEmail() {
    setEmailState('running')
    setEmailError(null)
    setEmailSubject(null)
    setEmailPreheader(null)
    try {
      const token = await getToken()
      const { data: jobData } = await apiClient(token!).promos.renderEmail(id)
      setEmailJobId(jobData.jobId)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to start email generation')
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
    } catch { /* silently fail */ }
  }

  async function handleAddFromSnippet(snippet: ProductSnippet) {
    setAddingSnippetId(snippet.id)
    try {
      const token = await getToken()
      await apiClient(token!).promos.itemFromSnippet(id, snippet.id)
      void queryClient.invalidateQueries({ queryKey: ['promo', id] })
      setSnippetsPopoverOpen(false)
    } catch { /* silently fail */ } finally {
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
    } catch { /* silently fail */ } finally {
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
      setBranchJobs(data.branches.map((b) => ({ ...b, done: false, error: null })))
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

  function getCoopField(
    item: { id: string; coopVendor: string | null; coopAmount: string | null; coopNote: string | null },
    field: 'vendor' | 'amount' | 'note',
  ): string {
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

  function handleDownloadFlyer() {
    const asset = assets.find((a) => a.type === 'pdf')
    if (asset) blobDownload(asset.url, `${promo?.title ?? 'promo'}-flyer.pdf`)
  }

  function handleDownloadPreview() {
    const asset = assets.find((a) => a.type === 'preview')
    if (asset) blobDownload(asset.url, `${promo?.title ?? 'promo'}-preview.png`)
  }

  function handleDownloadSocial() {
    const asset = assets.find((a) => a.type === 'social_image')
    if (asset) blobDownload(asset.url, `${promo?.title ?? 'promo'}-social.png`)
  }

  return {
    // queries
    promo, isLoading, error,
    assets,
    snippets, branches, importMappings,
    coopItems, coopReportAssetData,
    // template state
    selectedTemplate, templateSaving,
    categoryFilter, setCategoryFilter,
    countFilter, setCountFilter,
    pagesFilter, setPagesFilter,
    // details state
    localTitle, setLocalTitle,
    localSubhead, setLocalSubhead,
    localCta, setLocalCta,
    keywords,
    // upload state
    fileInputRef, urlInputRef,
    uploadState, uploadError,
    setUploadState, setUploadError,
    // dialog state
    dialogOpen, setDialogOpen,
    itemName, setItemName,
    itemPrice, setItemPrice,
    itemSku, setItemSku,
    itemUnit, setItemUnit,
    addingItem,
    // render state
    renderState, renderError,
    socialCaptions,
    // zip state
    zipState, zipError,
    // email state
    emailState, emailSubject, emailPreheader, emailError,
    // scrape state
    urlInputVisible, setUrlInputVisible,
    urlValue, setUrlValue,
    urlScrapeState, urlScrapeError,
    // snippets state
    snippetsPopoverOpen, setSnippetsPopoverOpen,
    savedItemIds, addingSnippetId,
    // branch state
    selectedBranchId, branchSaving,
    selectedMappingId, setSelectedMappingId,
    // branch pack
    branchPackState, branchPackError, branchJobs, branchPackOpen, setBranchPackOpen,
    // coop state
    coopOpen, setCoopOpen,
    coopEdits, coopSaveState, coopSaveError,
    coopReportState, coopReportUrl, coopReportError,
    // mutations
    duplicate,
    // handlers
    handleTemplateSelect,
    handlePatchPromo,
    handleKeywordsChange,
    handleFileChange,
    resetAddItemDialog,
    handleAddItem,
    handleDeleteItem,
    handleRender,
    handleExportZip,
    handleGenerateEmail,
    handleUrlScrape,
    handleSaveAsSnippet,
    handleAddFromSnippet,
    handleBranchChange,
    handleRenderBranchPack,
    setCoopField,
    getCoopField,
    handleSaveCoopData,
    handleGenerateCoopReport,
    handleDownloadFlyer,
    handleDownloadPreview,
    handleDownloadSocial,
    blobDownload,
  }
}
