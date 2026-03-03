'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import {
  ChevronDown, ChevronUp, Upload, Plus, Trash2, Link as LinkIcon,
  Bookmark, BookmarkCheck, GitBranch, DollarSign, Copy, X, Pencil,
} from 'lucide-react'
import { type Promo, type PromoItem, type ProductSnippet, type Branch, type ImportMapping } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { type UploadState, type ScrapeState, type BranchPackState, type CoopSaveState, type CoopReportState, type BranchJobSet } from './use-promo-editor'

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RightPanelProps {
  promo: Promo & { items: PromoItem[] }
  branches: Branch[]
  snippets: ProductSnippet[]
  importMappings: ImportMapping[]
  coopItems: Array<{ id: string; name: string; coopVendor: string | null; coopAmount: string | null; coopNote: string | null }>
  coopReportAssetData?: { data: { url: string | null; createdAt: string | null } } | null

  // details
  localTitle: string
  localSubhead: string
  localCta: string
  setLocalTitle: (v: string) => void
  setLocalSubhead: (v: string) => void
  setLocalCta: (v: string) => void
  handlePatchPromo: (data: { title?: string; subhead?: string | null; cta?: string | null }) => void

  // keywords
  keywords: string[]
  handleKeywordsChange: (kws: string[]) => void

  // upload
  fileInputRef: React.RefObject<HTMLInputElement | null>
  uploadState: UploadState
  uploadError: string | null
  setUploadState: (v: UploadState) => void
  setUploadError: (v: string | null) => void
  selectedMappingId: string
  setSelectedMappingId: (v: string) => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void

  // url scrape
  urlInputVisible: boolean
  setUrlInputVisible: (v: boolean) => void
  urlValue: string
  setUrlValue: (v: string) => void
  urlScrapeState: ScrapeState
  urlScrapeError: string | null
  urlInputRef: React.RefObject<HTMLInputElement | null>
  handleUrlScrape: (e: React.FormEvent) => void

  // snippets
  snippetsPopoverOpen: boolean
  setSnippetsPopoverOpen: (v: boolean) => void
  addingSnippetId: string | null
  handleAddFromSnippet: (s: ProductSnippet) => void

  // items
  savedItemIds: Set<string>
  handleDeleteItem: (id: string) => void
  handleSaveAsSnippet: (item: PromoItem) => void
  openEditItemDialog: (item: PromoItem) => void
  setDialogOpen: (v: boolean) => void

  // branch
  selectedBranchId: string | null
  branchSaving: boolean
  handleBranchChange: (id: string) => void

  // branch pack
  branchPackState: BranchPackState
  branchPackError: string | null
  branchJobs: BranchJobSet[]
  branchPackOpen: boolean
  setBranchPackOpen: (v: boolean) => void
  handleRenderBranchPack: () => void

  // coop
  coopOpen: boolean
  setCoopOpen: (v: boolean) => void
  coopSaveState: CoopSaveState
  coopSaveError: string | null
  coopReportState: CoopReportState
  coopReportUrl: string | null
  coopReportError: string | null
  getCoopField: (item: { id: string; coopVendor: string | null; coopAmount: string | null; coopNote: string | null }, field: 'vendor' | 'amount' | 'note') => string
  setCoopField: (itemId: string, field: 'vendor' | 'amount' | 'note', value: string) => void
  handleSaveCoopData: () => void
  handleGenerateCoopReport: () => void
  blobDownload: (url: string, filename: string) => void

  // duplicate
  duplicate: { mutate: () => void; isPending: boolean }
}

function formatPrice(price: string | number): string {
  if (typeof price === 'number') return price.toFixed(2)
  return price
}

// ---------------------------------------------------------------------------
// TagInput
// ---------------------------------------------------------------------------

function TagInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (kws: string[]) => void
}) {
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(raw: string) {
    const tag = raw.trim().replace(/,+$/, '').trim()
    if (!tag || value.includes(tag)) { setInputVal(''); return }
    onChange([...value, tag])
    setInputVal('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputVal)
    } else if (e.key === 'Backspace' && !inputVal && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-[36px] border border-slate-200 rounded-md px-2 py-1.5 bg-white cursor-text focus-within:ring-2 focus-within:ring-blue-500"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
            className="text-slate-400 hover:text-slate-700 transition-colors"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputVal.trim()) addTag(inputVal) }}
        placeholder={value.length === 0 ? 'Type and press Enter…' : ''}
        className="flex-1 min-w-[80px] text-xs bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RightPanel({
  promo,
  branches,
  snippets,
  importMappings,
  coopItems,
  coopReportAssetData,
  localTitle, localSubhead, localCta,
  setLocalTitle, setLocalSubhead, setLocalCta,
  handlePatchPromo,
  keywords, handleKeywordsChange,
  fileInputRef,
  uploadState, uploadError, setUploadState, setUploadError,
  selectedMappingId, setSelectedMappingId,
  handleFileChange,
  urlInputVisible, setUrlInputVisible,
  urlValue, setUrlValue,
  urlScrapeState, urlScrapeError,
  urlInputRef,
  handleUrlScrape,
  snippetsPopoverOpen, setSnippetsPopoverOpen,
  addingSnippetId,
  handleAddFromSnippet,
  savedItemIds,
  handleDeleteItem,
  handleSaveAsSnippet,
  openEditItemDialog,
  setDialogOpen,
  selectedBranchId, branchSaving,
  handleBranchChange,
  branchPackState, branchPackError, branchJobs, branchPackOpen, setBranchPackOpen,
  handleRenderBranchPack,
  coopOpen, setCoopOpen,
  coopSaveState, coopSaveError,
  coopReportState, coopReportUrl, coopReportError,
  getCoopField, setCoopField,
  handleSaveCoopData,
  handleGenerateCoopReport,
  blobDownload,
  duplicate,
}: RightPanelProps) {
  const items = promo.items ?? []

  return (
    <div className="w-80 shrink-0 border-l border-slate-200 bg-white overflow-y-auto">

      {/* ---- Details ---- */}
      <Section title="Details">
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-slate-500 mb-1">Title</Label>
            <Input
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={() => { if (localTitle !== promo.title) handlePatchPromo({ title: localTitle }) }}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-1">Subhead</Label>
            <Input
              value={localSubhead}
              onChange={(e) => setLocalSubhead(e.target.value)}
              onBlur={() => { if (localSubhead !== (promo.subhead ?? '')) handlePatchPromo({ subhead: localSubhead || null }) }}
              placeholder="Optional tagline"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-1">CTA</Label>
            <Input
              value={localCta}
              onChange={(e) => setLocalCta(e.target.value)}
              onBlur={() => { if (localCta !== (promo.cta ?? '')) handlePatchPromo({ cta: localCta || null }) }}
              placeholder="e.g. Visit us today"
              className="h-8 text-sm"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-slate-500 h-7 text-xs"
            onClick={() => duplicate.mutate()}
            disabled={duplicate.isPending}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            {duplicate.isPending ? 'Duplicating…' : 'Duplicate promo'}
          </Button>
        </div>
      </Section>

      {/* ---- Keywords ---- */}
      <Section title="Keywords" defaultOpen={false}>
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Used by AI to generate copy in custom templates.</p>
          <TagInput value={keywords} onChange={(kws) => void handleKeywordsChange(kws)} />
        </div>
      </Section>

      {/* ---- Branch ---- */}
      <Section title="Branch" defaultOpen={branches.length > 0}>
        {branches.length === 0 ? (
          <p className="text-xs text-slate-400">No branches configured. Add branches in Settings.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-500 mb-1">Active branch</Label>
              <select
                value={selectedBranchId ?? '__none__'}
                onChange={(e) => void handleBranchChange(e.target.value)}
                disabled={branchSaving}
                className="w-full text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="__none__">No branch (default)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Branch pack */}
            <div className="pt-1 border-t border-slate-100">
              {branchPackState === 'idle' && (
                <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => void handleRenderBranchPack()}>
                  <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                  Render for all branches
                </Button>
              )}
              {branchPackState === 'running' && (
                <p className="text-xs text-slate-500 animate-pulse text-center py-1">Rendering branch pack…</p>
              )}
              {(branchPackState === 'running' || branchPackState === 'done') && branchJobs.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setBranchPackOpen(!branchPackOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Branch downloads ({branchJobs.filter((b) => b.done).length}/{branchJobs.length} ready)
                    {branchPackOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {branchPackOpen && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {branchJobs.map((branch) => (
                        <div key={branch.branchId} className="px-3 py-2">
                          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1">{branch.branchName}</p>
                          {branch.error ? (
                            <p className="text-[10px] text-red-600">{branch.error}</p>
                          ) : branch.done ? (
                            <p className="text-[10px] text-green-600">Ready</p>
                          ) : (
                            <p className="text-[10px] text-slate-400 animate-pulse">Rendering…</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {branchPackState === 'error' && (
                <p className="text-xs text-red-600 mt-1">{branchPackError ?? 'Branch render failed.'}</p>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* ---- Products ---- */}
      <Section title={`Products (${items.length})`}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef as React.RefObject<HTMLInputElement>}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
        />

        {/* Add tools */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {importMappings.length > 0 && (
            <select
              value={selectedMappingId}
              onChange={(e) => setSelectedMappingId(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
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
            className="h-7 text-xs flex-1"
            onClick={() => (fileInputRef as React.RefObject<HTMLInputElement>).current?.click()}
            disabled={uploadState === 'uploading' || uploadState === 'parsing'}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            CSV / XLSX
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => {
              setUrlInputVisible(!urlInputVisible)
              setUrlValue('')
            }}
          >
            <LinkIcon className="h-3.5 w-3.5 mr-1" />
            From URL
          </Button>

          <Popover open={snippetsPopoverOpen} onOpenChange={setSnippetsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
                <Bookmark className="h-3.5 w-3.5 mr-1" />
                Snippets
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="left" className="w-64 p-2">
              {snippets.length === 0 ? (
                <p className="text-xs text-slate-400 px-2 py-1">No snippets saved yet.</p>
              ) : (
                <div className="space-y-0.5 max-h-56 overflow-y-auto">
                  {snippets.map((snippet) => (
                    <button
                      key={snippet.id}
                      type="button"
                      disabled={addingSnippetId === snippet.id}
                      onClick={() => void handleAddFromSnippet(snippet)}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                      <p className="text-xs font-medium text-slate-900 truncate">{snippet.name}</p>
                      <p className="text-[10px] text-slate-500">
                        ${parseFloat(String(snippet.price)).toFixed(2)}
                        {snippet.unit ? ` / ${snippet.unit}` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add item
          </Button>
        </div>

        {/* URL input */}
        {urlInputVisible && (
          <form onSubmit={(e) => void handleUrlScrape(e)} className="mb-3 space-y-1.5">
            <Input
              ref={urlInputRef as React.RefObject<HTMLInputElement>}
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://example.com/product"
              className="h-8 text-xs"
              autoFocus
              disabled={urlScrapeState === 'submitting' || urlScrapeState === 'polling'}
            />
            <div className="flex gap-1.5">
              <Button
                type="submit"
                size="sm"
                className="flex-1 h-7 text-xs"
                disabled={!urlValue.trim() || urlScrapeState === 'submitting' || urlScrapeState === 'polling'}
              >
                {urlScrapeState === 'submitting' || urlScrapeState === 'polling' ? 'Loading…' : 'Add'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setUrlInputVisible(false); setUrlValue('') }}
              >
                Cancel
              </Button>
            </div>
            {urlScrapeError && <p className="text-xs text-red-600">{urlScrapeError}</p>}
          </form>
        )}

        {/* Upload status */}
        {uploadState !== 'idle' && (
          <div
            className={[
              'mb-3 rounded-lg px-3 py-2 text-xs flex items-center gap-2',
              uploadState === 'uploading' && 'bg-blue-50 text-blue-700',
              uploadState === 'parsing' && 'bg-amber-50 text-amber-700',
              uploadState === 'done' && 'bg-green-50 text-green-700',
              uploadState === 'error' && 'bg-red-50 text-red-700',
            ].filter(Boolean).join(' ')}
          >
            <span className="flex-1">
              {uploadState === 'uploading' && 'Uploading…'}
              {uploadState === 'parsing' && 'Parsing file…'}
              {uploadState === 'done' && 'Items updated.'}
              {uploadState === 'error' && (uploadError ?? 'Upload failed.')}
            </span>
            {(uploadState === 'done' || uploadState === 'error') && (
              <button
                type="button"
                className="text-[10px] underline opacity-70 hover:opacity-100 shrink-0"
                onClick={() => { setUploadState('idle'); setUploadError(null) }}
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* Items list */}
        {items.length === 0 ? (
          <p className="text-xs text-slate-400">No items yet.</p>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 truncate">{item.name}</p>
                  <p className="text-[10px] text-slate-500">
                    ${formatPrice(item.price)}
                    {item.rrp && (
                      <span className="ml-1 line-through text-slate-400">${formatPrice(item.rrp)}</span>
                    )}
                    {item.unit ? ` / ${item.unit}` : ''}
                    {item.sku ? ` · ${item.sku}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditItemDialog(item)}
                    className="p-1 rounded text-slate-300 hover:text-slate-600 transition-colors"
                    aria-label="Edit item"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveAsSnippet(item)}
                    className={`p-1 rounded transition-colors ${savedItemIds.has(item.id) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}
                    aria-label="Save as snippet"
                  >
                    {savedItemIds.has(item.id) ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteItem(item.id)}
                    className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors"
                    aria-label="Delete item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ---- Co-op ---- */}
      {items.length > 0 && (
        <Section title="Co-op" defaultOpen={false}>
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-slate-500"
              onClick={() => setCoopOpen(!coopOpen)}
            >
              <DollarSign className="h-3.5 w-3.5 mr-1.5" />
              {coopOpen ? 'Hide co-op fields' : 'Edit co-op data'}
            </Button>

            {coopOpen && (
              <>
                {coopItems.length === 0 ? (
                  <p className="text-xs text-slate-400">No items with co-op data yet.</p>
                ) : (
                  <div className="space-y-4">
                    {coopItems.map((item) => (
                      <div key={item.id}>
                        <p className="text-xs font-medium text-slate-700 mb-1.5 truncate">{item.name}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <Input
                            value={getCoopField(item, 'vendor')}
                            onChange={(e) => setCoopField(item.id, 'vendor', e.target.value)}
                            placeholder="Vendor"
                            className="h-7 text-xs"
                          />
                          <Input
                            value={getCoopField(item, 'amount')}
                            onChange={(e) => setCoopField(item.id, 'amount', e.target.value)}
                            placeholder="$ Amount"
                            type="number"
                            className="h-7 text-xs"
                          />
                          <Input
                            value={getCoopField(item, 'note')}
                            onChange={(e) => setCoopField(item.id, 'note', e.target.value)}
                            placeholder="Note"
                            className="col-span-2 h-7 text-xs"
                          />
                        </div>
                      </div>
                    ))}

                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => void handleSaveCoopData()}
                        disabled={coopSaveState === 'saving'}
                      >
                        {coopSaveState === 'saving' ? 'Saving…' : coopSaveState === 'saved' ? 'Saved!' : 'Save co-op data'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => void handleGenerateCoopReport()}
                        disabled={coopReportState === 'running'}
                      >
                        {coopReportState === 'running' ? 'Generating…' : 'Generate report'}
                      </Button>
                    </div>

                    {coopSaveError && <p className="text-xs text-red-600">{coopSaveError}</p>}
                    {coopReportError && <p className="text-xs text-red-600">{coopReportError}</p>}
                    {coopReportState === 'done' && coopReportUrl && (
                      <button
                        type="button"
                        className="text-xs text-blue-600 underline"
                        onClick={() => blobDownload(coopReportUrl, 'coop-report.csv')}
                      >
                        Download co-op report
                      </button>
                    )}
                    {coopReportAssetData?.data?.url && (
                      <button
                        type="button"
                        className="text-xs text-slate-500 underline"
                        onClick={() => blobDownload(coopReportAssetData.data.url!, 'coop-report.csv')}
                      >
                        Download previous report
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}
