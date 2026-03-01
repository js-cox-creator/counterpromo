'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Sparkles, Pencil, Check } from 'lucide-react'
import { apiClient, type BrandKit } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  // Reds / Oranges
  '#ef4444', '#dc2626', '#b91c1c', '#f97316', '#ea580c', '#c2410c',
  // Yellows / Ambers
  '#f59e0b', '#d97706', '#b45309', '#eab308', '#ca8a04',
  // Greens
  '#22c55e', '#16a34a', '#15803d', '#10b981', '#059669', '#14b8a6',
  // Blues
  '#3b82f6', '#2563eb', '#1d4ed8', '#0ea5e9', '#0891b2', '#0e7490',
  // Indigos / Purples
  '#6366f1', '#4f46e5', '#4338ca', '#8b5cf6', '#7c3aed', '#6d28d9',
  // Pinks
  '#ec4899', '#db2777', '#be185d', '#f43f5e', '#e11d48',
  // Neutrals
  '#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8',
  '#cbd5e1', '#e2e8f0', '#f1f5f9', '#ffffff',
  // Browns / Warm
  '#78350f', '#92400e', '#7c2d12', '#431407',
  '#000000',
]

// Popular fonts — Google Fonts + system fallbacks
const FONT_LIST = [
  // Sans Serif — modern
  'Inter', 'Outfit', 'Plus Jakarta Sans', 'DM Sans', 'Manrope', 'Figtree',
  'Epilogue', 'Hanken Grotesk', 'Albert Sans', 'Sora', 'Space Grotesk',
  // Sans Serif — classic
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito',
  'Source Sans 3', 'Raleway', 'Ubuntu', 'Work Sans', 'Fira Sans',
  'Barlow', 'Cabin', 'Josefin Sans', 'Quicksand', 'Exo 2',
  'Varela Round', 'Nunito Sans', 'Noto Sans', 'Mulish', 'Lexend',
  'Rubik', 'Karla', 'Jost', 'Libre Franklin', 'Public Sans',
  'Red Hat Display', 'Archivo', 'PT Sans', 'Oswald', 'Oxanium',
  'Mukta', 'Hind', 'Titillium Web',
  // Serif
  'Playfair Display', 'Merriweather', 'Lora', 'EB Garamond',
  'Cormorant Garamond', 'Libre Baskerville', 'Crimson Text', 'Domine',
  'Spectral', 'DM Serif Display', 'Bodoni Moda', 'Cardo', 'Vollkorn',
  'Alegreya', 'Bitter', 'Zilla Slab', 'Arvo', 'Rokkitt',
  'Source Serif 4', 'Cinzel', 'Fraunces', 'Cormorant',
  // Display
  'Bebas Neue', 'Anton', 'Righteous', 'Fredoka', 'Pacifico',
  'Lobster', 'Black Han Sans', 'Alfa Slab One', 'Boogaloo', 'Lilita One',
  // Handwriting
  'Dancing Script', 'Sacramento', 'Great Vibes', 'Satisfy', 'Parisienne',
  'Allura', 'Alex Brush', 'Pinyon Script',
  // System / web-safe
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana',
  'Tahoma', 'Trebuchet MS', 'Impact', 'Courier New',
]

// Google Fonts only (not system fonts — these need to be loaded)
const SYSTEM_FONTS = new Set([
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana',
  'Tahoma', 'Trebuchet MS', 'Impact', 'Courier New',
])
const GOOGLE_FONTS = FONT_LIST.filter((f) => !SYSTEM_FONTS.has(f))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function swatchTextColor(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) || 0
  const g = parseInt(h.slice(2, 4), 16) || 0
  const b = parseInt(h.slice(4, 6), 16) || 0
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1e293b' : '#ffffff'
}

function loadGoogleFonts() {
  const id = 'cp-branding-fonts'
  if (typeof document === 'undefined' || document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  const families = GOOGLE_FONTS.map((f) => `family=${encodeURIComponent(f)}:wght@400;700`).join('&')
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`
  document.head.appendChild(link)
}

// ─── Color Picker Input ───────────────────────────────────────────────────────

function ColorPickerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const normalised = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'

  return (
    <div className="space-y-3">
      {/* Large swatch — click to open native OS color picker */}
      <div className="relative h-14 rounded-xl overflow-hidden border border-slate-200 cursor-pointer">
        <div className="absolute inset-0" style={{ backgroundColor: normalised }} />
        <input
          type="color"
          value={normalised}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-mono font-semibold drop-shadow" style={{ color: swatchTextColor(normalised) }}>
            {normalised.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Preset swatches */}
      <div className="grid grid-cols-11 gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            className={`w-6 h-6 rounded border transition-transform hover:scale-110 ${
              c.toLowerCase() === value.toLowerCase() ? 'border-slate-900 ring-1 ring-slate-900 scale-110' : 'border-black/10'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Manual hex */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded border border-slate-200 shrink-0" style={{ backgroundColor: normalised }} />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="h-7 font-mono text-xs"
        />
      </div>
    </div>
  )
}

// ─── Font Picker ──────────────────────────────────────────────────────────────

function FontPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (f: string) => void
}) {
  const [search, setSearch] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(
    () =>
      FONT_LIST.filter((f) => f.toLowerCase().includes(search.toLowerCase())),
    [search],
  )

  // Scroll selected item into view on open
  useEffect(() => {
    if (!value || !listRef.current) return
    const idx = filtered.findIndex((f) => f === value)
    if (idx < 0) return
    const item = listRef.current.children[idx] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [value, filtered])

  return (
    <div className="space-y-2">
      <Input
        placeholder="Search fonts…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
        autoFocus
      />
      <div ref={listRef} className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-50">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-400 text-center">No fonts found</p>
        ) : (
          filtered.map((font) => (
            <button
              key={font}
              type="button"
              onClick={() => onChange(font)}
              className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition-colors ${
                value === font ? 'bg-indigo-50' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="text-xl leading-none text-slate-800 shrink-0"
                  style={{ fontFamily: font }}
                >
                  Aa
                </span>
                <span className="text-sm text-slate-700 truncate">{font}</span>
              </div>
              {value === font && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Inline Text Editor ───────────────────────────────────────────────────────

function InlineEdit({
  value,
  placeholder,
  onSave,
  className = '',
}: {
  value: string
  placeholder: string
  onSave: (v: string) => Promise<void>
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function commit() {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  function cancel() { setDraft(value); setEditing(false) }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') cancel() }}
          className="h-7 text-sm py-0"
          disabled={saving}
        />
        <button onClick={() => void commit()} disabled={saving} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap">
          {saving ? '…' : 'Save'}
        </button>
        <button onClick={cancel} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
      </div>
    )
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className={`group flex items-center gap-1.5 text-left ${className}`}>
      <span>{value || <span className="text-slate-400 italic">{placeholder}</span>}</span>
      <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  )
}

// ─── Logo Square ──────────────────────────────────────────────────────────────

function LogoSquare({ brandKit, accountName, onEdit }: { brandKit: BrandKit; accountName: string; onEdit: () => void }) {
  return (
    <div
      className="group relative w-1/2 aspect-square rounded-xl border border-slate-200 bg-white flex items-center justify-center cursor-pointer overflow-hidden"
      onClick={onEdit}
    >
      {brandKit.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brandKit.logoUrl} alt={accountName} className="max-w-[75%] max-h-[75%] object-contain" />
      ) : (
        <span className="text-sm text-slate-400">No logo</span>
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
        <span className="flex items-center gap-1.5 text-white text-sm font-semibold">
          <Pencil className="h-4 w-4" /> Edit
        </span>
      </div>
    </div>
  )
}

// ─── Color Circle ─────────────────────────────────────────────────────────────

function ColorCircle({ color, label, onEdit }: { color: string; label: string; onEdit: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="group relative w-14 h-14 rounded-full shadow-sm border border-black/10 cursor-pointer flex items-center justify-center"
        style={{ backgroundColor: color }}
        onClick={onEdit}
      >
        <span className="text-xs font-mono font-bold" style={{ color: swatchTextColor(color) }}>Aa</span>
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Pencil className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-semibold text-slate-600">{label}</p>
        <p className="text-[10px] font-mono text-slate-400">{color}</p>
      </div>
    </div>
  )
}

// ─── Font Sample ──────────────────────────────────────────────────────────────

function FontSample({ fontName, label, onEdit }: { fontName: string; label: string; onEdit: () => void }) {
  return (
    <div className="group relative rounded-lg px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={onEdit}>
      <div className="flex items-baseline justify-center gap-2 mb-1">
        <span className="text-3xl font-bold text-slate-800 leading-none" style={{ fontFamily: fontName }}>Aa</span>
        <div className="text-left">
          <p className="text-xs font-semibold text-slate-700">{label}</p>
          <p className="text-[10px] text-slate-400">{fontName}</p>
        </div>
      </div>
      <p className="text-sm text-slate-500 text-center" style={{ fontFamily: fontName }}>
        The quick brown fox jumps over the lazy dog.
      </p>
      <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="flex items-center gap-1.5 text-white text-sm font-semibold">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </span>
      </div>
    </div>
  )
}

// ─── Logo Dialog ──────────────────────────────────────────────────────────────

function LogoDialog({ open, initial, onClose, onSave }: { open: boolean; initial: string; onClose: () => void; onSave: (url: string) => Promise<void> }) {
  const [url, setUrl] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { if (open) { setUrl(initial); setErr(null) } }, [open, initial])

  async function handleSave() {
    setSaving(true); setErr(null)
    try { await onSave(url); onClose() } catch (e) { setErr((e as Error).message) } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Logo</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Logo URL</Label>
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/logo.png" />
          </div>
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex items-center justify-center h-24">
              <img src={url} alt="Preview" className="max-h-16 object-contain" />
            </div>
          )}
          {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Colors Dialog ────────────────────────────────────────────────────────────

function ColorsDialog({
  open, title, initial, onClose, onSave,
}: {
  open: boolean; title: string; initial: string[]; onClose: () => void; onSave: (colors: string[]) => Promise<void>
}) {
  const [tab, setTab] = useState<'primary' | 'secondary'>('primary')
  const [primary, setPrimary] = useState(initial[0] ?? '#000000')
  const [secondary, setSecondary] = useState(initial[1] ?? '#000000')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setPrimary(initial[0] ?? '#000000'); setSecondary(initial[1] ?? '#000000'); setErr(null); setTab('primary') }
  }, [open, initial])

  async function handleSave() {
    setSaving(true); setErr(null)
    try { await onSave([primary, secondary].filter(Boolean)); onClose() } catch (e) { setErr((e as Error).message) } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {/* Tab switcher */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            {(['primary', 'secondary'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 font-medium transition-colors capitalize ${
                  tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full border border-black/10"
                  style={{ backgroundColor: t === 'primary' ? primary : secondary }}
                />
                {t}
              </button>
            ))}
          </div>

          <ColorPickerInput
            value={tab === 'primary' ? primary : secondary}
            onChange={tab === 'primary' ? setPrimary : setSecondary}
          />

          {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Fonts Dialog ─────────────────────────────────────────────────────────────

function FontsDialog({
  open, initial, onClose, onSave,
}: {
  open: boolean; initial: string[]; onClose: () => void; onSave: (fonts: string[]) => Promise<void>
}) {
  const [tab, setTab] = useState<'primary' | 'secondary'>('primary')
  const [primary, setPrimary] = useState(initial[0] ?? '')
  const [secondary, setSecondary] = useState(initial[1] ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPrimary(initial[0] ?? '')
      setSecondary(initial[1] ?? '')
      setErr(null)
      setTab('primary')
      loadGoogleFonts()
    }
  }, [open, initial])

  async function handleSave() {
    setSaving(true); setErr(null)
    try { await onSave([primary, secondary].filter(Boolean)); onClose() } catch (e) { setErr((e as Error).message) } finally { setSaving(false) }
  }

  const currentValue = tab === 'primary' ? primary : secondary
  const setCurrentValue = tab === 'primary' ? setPrimary : setSecondary

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Edit Fonts</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {/* Tab switcher */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            {(['primary', 'secondary'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 py-2 font-medium transition-colors capitalize ${
                  tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span style={{ fontFamily: t === 'primary' ? primary : secondary }}>
                  {t === 'primary' ? (primary || 'Primary') : (secondary || 'Secondary')}
                </span>
              </button>
            ))}
          </div>

          {/* Selected preview */}
          {currentValue && (
            <div className="rounded-lg border border-slate-200 px-4 py-3 text-center bg-slate-50">
              <p className="text-2xl font-bold text-slate-800" style={{ fontFamily: currentValue }}>Aa</p>
              <p className="text-xs text-slate-400 mt-0.5">{currentValue}</p>
            </div>
          )}

          <FontPicker value={currentValue} onChange={setCurrentValue} />

          {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BrandingPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const { data: brandKitData, isLoading, error } = useQuery({
    queryKey: ['brand-kit'],
    queryFn: async () => { const token = await getToken(); return apiClient(token!).brandKit.get() },
  })
  const { data: accountData } = useQuery({
    queryKey: ['account-me'],
    queryFn: async () => { const token = await getToken(); return apiClient(token!).accounts.me() },
  })

  const brandKit = brandKitData?.data
  const accountName = accountData?.data?.name ?? ''
  const role = accountData?.data?.currentUser?.role
  const canEdit = role === 'owner' || role === 'admin'

  const [logoDialog, setLogoDialog] = useState(false)
  const [bgColorsDialog, setBgColorsDialog] = useState(false)
  const [fontColorsDialog, setFontColorsDialog] = useState(false)
  const [fontsDialog, setFontsDialog] = useState(false)

  const [scraping, setScraping] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  function refresh() { void queryClient.invalidateQueries({ queryKey: ['brand-kit'] }) }

  async function save(data: Parameters<ReturnType<typeof apiClient>['brandKit']['save']>[0]) {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    await apiClient(token).brandKit.save(data)
    refresh()
  }

  async function handleScrape() {
    if (!brandKit?.websiteUrl) return
    setScraping(true); setScrapeMsg(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      await apiClient(token).brandKit.bootstrapFromUrl(brandKit.websiteUrl)
      setScrapeMsg('Extracting — refreshing shortly…')
      setTimeout(() => { refresh(); setScrapeMsg(null) }, 4000)
    } catch (e) {
      setScrapeMsg((e as Error).message ?? 'Failed.')
    } finally {
      setScraping(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true); setGenError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      await apiClient(token).brandKit.generateDescription()
      refresh()
    } catch (e) {
      setGenError((e as Error).message ?? 'Generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const colors = brandKit?.colors ?? []
  const textColors = brandKit?.textColors ?? []
  const fonts = brandKit?.fonts ?? []

  return (
    <div className="px-8 py-8 w-full space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Branding</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your brand identity, colors, and typography.</p>
        </div>
        {canEdit && brandKit && (
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleScrape()}
              disabled={scraping || !brandKit.websiteUrl}
              title={!brandKit.websiteUrl ? 'Add a website URL first' : `Re-scrape ${brandKit.websiteUrl}`}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scraping ? 'animate-spin' : ''}`} />
              {scraping ? 'Scraping…' : 'Refresh brand'}
            </Button>
            {scrapeMsg && <p className="text-xs text-blue-600">{scrapeMsg}</p>}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-12">
          <div className="space-y-4">
            <Skeleton className="w-1/2 aspect-square rounded-xl" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-5 w-28" />
            <div className="flex justify-center gap-8"><Skeleton className="h-14 w-14 rounded-full" /><Skeleton className="h-14 w-14 rounded-full" /></div>
            <Skeleton className="h-5 w-28" />
            <div className="flex justify-center gap-8"><Skeleton className="h-14 w-14 rounded-full" /><Skeleton className="h-14 w-14 rounded-full" /></div>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      ) : error ? (
        <p className="px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">Failed to load brand kit. Please refresh.</p>
      ) : brandKit ? (
        <>
          <div className="grid grid-cols-2 gap-12">

            {/* ── Left: Identity ── */}
            <div className="space-y-6">
              {/* Logo */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">Logo</h3>
                <LogoSquare brandKit={brandKit} accountName={accountName} onEdit={canEdit ? () => setLogoDialog(true) : () => undefined} />
              </div>

              {/* Website */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-700">Website</h3>
                {canEdit ? (
                  <InlineEdit
                    value={brandKit.websiteUrl ?? ''}
                    placeholder="Add website URL…"
                    onSave={(v) => save({ websiteUrl: v || undefined })}
                    className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  />
                ) : brandKit.websiteUrl ? (
                  <a href={brandKit.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:text-indigo-600 block truncate">
                    {brandKit.websiteUrl.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  <p className="text-sm text-slate-400 italic">Not set</p>
                )}
              </div>

              {/* Strapline */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-700">Strapline</h3>
                {canEdit ? (
                  <InlineEdit
                    value={brandKit.strapline ?? ''}
                    placeholder="Add strapline…"
                    onSave={(v) => save({ strapline: v || undefined })}
                    className="text-sm font-medium text-slate-600 italic leading-snug"
                  />
                ) : brandKit.strapline ? (
                  <p className="text-sm font-medium text-slate-600 italic">&ldquo;{brandKit.strapline}&rdquo;</p>
                ) : (
                  <p className="text-sm text-slate-400 italic">Not set</p>
                )}
              </div>

              {/* Overview */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">Overview</h3>
                {brandKit.aiDescription ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600 leading-relaxed">{brandKit.aiDescription}</p>
                    {canEdit && (
                      <button type="button" onClick={() => void handleGenerate()} disabled={generating}
                        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition-colors">
                        <Sparkles className="h-3 w-3" />
                        {generating ? 'Regenerating…' : 'Regenerate'}
                      </button>
                    )}
                  </div>
                ) : canEdit ? (
                  <Button variant="outline" size="sm" onClick={() => void handleGenerate()} disabled={generating} className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {generating ? 'Generating…' : 'Generate AI description'}
                  </Button>
                ) : (
                  <p className="text-sm text-slate-400 italic">Not generated yet.</p>
                )}
                {genError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{genError}</p>}
              </div>
            </div>

            {/* ── Right: Colors + Typography ── */}
            <div className="space-y-8 flex flex-col items-center">

              {/* Font Colors */}
              <div className="w-full">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 text-center">Font Colors</h3>
                <div className="flex justify-center gap-10">
                  {textColors[0]
                    ? <ColorCircle color={textColors[0]} label="Primary" onEdit={canEdit ? () => setFontColorsDialog(true) : () => undefined} />
                    : canEdit && <button onClick={() => setFontColorsDialog(true)} className="text-xs text-slate-400 hover:text-indigo-600 italic">+ Add font colors</button>}
                  {textColors[1] && <ColorCircle color={textColors[1]} label="Secondary" onEdit={canEdit ? () => setFontColorsDialog(true) : () => undefined} />}
                </div>
              </div>

              {/* Background Colors */}
              <div className="w-full">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 text-center">Background Colors</h3>
                <div className="flex justify-center gap-10">
                  {colors[0]
                    ? <ColorCircle color={colors[0]} label="Primary" onEdit={canEdit ? () => setBgColorsDialog(true) : () => undefined} />
                    : canEdit && <button onClick={() => setBgColorsDialog(true)} className="text-xs text-slate-400 hover:text-indigo-600 italic">+ Add background colors</button>}
                  {colors[1] && <ColorCircle color={colors[1]} label="Secondary" onEdit={canEdit ? () => setBgColorsDialog(true) : () => undefined} />}
                </div>
              </div>

              {/* Typography */}
              <div className="w-full">
                <h3 className="text-sm font-semibold text-slate-700 mb-2 text-center">Typography</h3>
                {fonts.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {fonts[0] && <FontSample fontName={fonts[0]} label="Primary" onEdit={canEdit ? () => setFontsDialog(true) : () => undefined} />}
                    {fonts[1] && <FontSample fontName={fonts[1]} label="Secondary" onEdit={canEdit ? () => setFontsDialog(true) : () => undefined} />}
                  </div>
                ) : canEdit ? (
                  <button onClick={() => setFontsDialog(true)} className="w-full text-center text-xs text-slate-400 hover:text-indigo-600 italic py-3">
                    + Add fonts
                  </button>
                ) : (
                  <p className="text-center text-xs text-slate-400 py-3">No fonts set</p>
                )}
              </div>
            </div>
          </div>

          {!canEdit && (
            <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-md">
              Only account owners and admins can update the brand kit.
            </p>
          )}

          <LogoDialog open={logoDialog} initial={brandKit.logoUrl ?? ''} onClose={() => setLogoDialog(false)} onSave={(url) => save({ logoUrl: url || undefined })} />
          <ColorsDialog open={bgColorsDialog} title="Edit Background Colors" initial={colors} onClose={() => setBgColorsDialog(false)} onSave={(c) => save({ colors: c })} />
          <ColorsDialog open={fontColorsDialog} title="Edit Font Colors" initial={textColors} onClose={() => setFontColorsDialog(false)} onSave={(c) => save({ textColors: c })} />
          <FontsDialog open={fontsDialog} initial={fonts} onClose={() => setFontsDialog(false)} onSave={(f) => save({ fonts: f })} />
        </>
      ) : (
        <div className="grid grid-cols-2 gap-12">
          <div className="w-1/2 aspect-square rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center">
            <p className="text-sm text-slate-400">No brand kit yet</p>
          </div>
          <div className="flex items-center justify-center text-sm text-slate-400 text-center">
            Add a website URL and click Refresh brand to extract your colors and fonts automatically.
          </div>
        </div>
      )}
    </div>
  )
}
