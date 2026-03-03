'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, FileDown, ImageIcon, Mail, Archive,
  Loader2, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePromoEditor } from './_components/use-promo-editor'
import { TemplateStrip } from './_components/template-strip'
import { RightPanel } from './_components/right-panel'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string): string {
  if (status === 'ready') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (status === 'processing') return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

type ViewportTab = 'flyer' | 'social' | 'email'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PromoEditorPage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<ViewportTab>('flyer')
  const [captionsOpen, setCaptionsOpen] = useState(false)

  const editor = usePromoEditor(id)

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (editor.isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="p-4 border-b flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-16 ml-auto" />
        </div>
        <div className="border-b p-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 w-[76px] rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 bg-slate-100 flex items-center justify-center">
            <Skeleton className="w-80 h-[450px] rounded-xl" />
          </div>
          <div className="w-80 border-l p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (editor.error || !editor.promo) {
    return (
      <div className="p-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <div className="px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
          Failed to load promo. Please try again.
        </div>
      </div>
    )
  }

  const promo = editor.promo
  const items = promo.items ?? []
  const isRendering = editor.renderState === 'rendering'

  // Which assets are available
  const previewAsset = editor.assets.find((a) => a.type === 'preview' && !('branchId' in a && a.branchId))
  const pdfAsset = editor.assets.find((a) => a.type === 'pdf' && !('branchId' in a && a.branchId))
  const socialAsset = editor.assets.find((a) => a.type === 'social_image' && !('branchId' in a && a.branchId))

  const hasAnyAsset = Boolean(previewAsset ?? pdfAsset ?? socialAsset)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ------------------------------------------------------------------ */}
      {/* Header bar                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-slate-200 bg-white">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 shrink-0">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="h-4 w-px bg-slate-200 shrink-0" />

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-900 truncate">{promo.title}</h1>
          {promo.subhead && (
            <p className="text-xs text-slate-500 truncate">{promo.subhead}</p>
          )}
        </div>

        <Badge className={`capitalize border shrink-0 ${statusBadgeClass(promo.status)}`} variant="outline">
          {promo.status}
        </Badge>

        {/* Render button */}
        {editor.renderState === 'idle' || editor.renderState === 'error' || editor.renderState === 'done' ? (
          <Button
            onClick={() => void editor.handleRender()}
            disabled={items.length === 0}
            size="sm"
            className="shrink-0"
          >
            {editor.renderState === 'done' ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Re-render
              </>
            ) : (
              <>
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                Render
              </>
            )}
          </Button>
        ) : (
          <Button disabled size="sm" className="shrink-0">
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Rendering…
          </Button>
        )}

        {editor.renderError && (
          <p className="text-xs text-red-600 shrink-0 max-w-48 truncate" title={editor.renderError}>
            {editor.renderError}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Template strip                                                      */}
      {/* ------------------------------------------------------------------ */}
      <TemplateStrip
        selectedTemplate={editor.selectedTemplate}
        templateSaving={editor.templateSaving}
        onTemplateSelect={(id) => void editor.handleTemplateSelect(id)}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Main area: viewport + right panel                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 overflow-hidden">

        {/* Viewport */}
        <div className="flex flex-col flex-1 overflow-hidden bg-slate-100">

          {/* Tab bar */}
          <div className="shrink-0 flex items-center gap-0 border-b border-slate-200 bg-white px-4">
            {([
              { id: 'flyer' as ViewportTab, label: 'Flyer', icon: FileDown },
              { id: 'social' as ViewportTab, label: 'Social', icon: ImageIcon },
              { id: 'email' as ViewportTab, label: 'Email', icon: Mail },
            ] as const).map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={[
                  'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tabId
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Preview area */}
          <div className="flex-1 overflow-auto p-8 flex items-center justify-center relative">
            {isRendering && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-800">Generating assets…</p>
                  <p className="text-xs text-slate-500 mt-1">Please don&apos;t navigate away — this takes 30–60 seconds</p>
                </div>
              </div>
            )}

            {activeTab === 'flyer' && (
              previewAsset ? (
                <img
                  src={previewAsset.url}
                  alt={promo.title}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                  style={{ maxHeight: 'calc(100vh - 280px)' }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-48 h-64 bg-white rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 shadow-sm">
                    <FileDown className="h-8 w-8 text-slate-300" />
                    <p className="text-xs text-slate-400">No preview yet</p>
                  </div>
                  {items.length === 0 && (
                    <p className="text-xs text-slate-400">Add products, then click Render</p>
                  )}
                  {items.length > 0 && editor.renderState !== 'rendering' && (
                    <p className="text-xs text-slate-400">Click Render to generate your flyer</p>
                  )}
                </div>
              )
            )}

            {activeTab === 'social' && (
              socialAsset ? (
                <img
                  src={socialAsset.url}
                  alt={`${promo.title} social`}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                  style={{ maxHeight: 'calc(100vh - 280px)' }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-64 h-64 bg-white rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 shadow-sm">
                    <ImageIcon className="h-8 w-8 text-slate-300" />
                    <p className="text-xs text-slate-400">No social image yet</p>
                    <p className="text-[10px] text-slate-400">1080×1080 generated on render</p>
                  </div>
                </div>
              )
            )}

            {activeTab === 'email' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <Mail className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                  {editor.emailState === 'done' ? (
                    <>
                      <p className="text-sm font-medium text-green-700 mb-1">Email generated!</p>
                      {editor.emailSubject && (
                        <p className="text-xs text-slate-600 mb-1">Subject: <span className="font-medium">{editor.emailSubject}</span></p>
                      )}
                      {editor.emailPreheader && (
                        <p className="text-xs text-slate-500">Preheader: {editor.emailPreheader}</p>
                      )}
                    </>
                  ) : editor.emailState === 'running' ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Generating email HTML…</p>
                      <p className="text-xs text-slate-400 mt-1">Please don&apos;t navigate away</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600 mb-1">Generate an HTML email</p>
                      <p className="text-xs text-slate-400">AI-powered subject & preheader included</p>
                    </>
                  )}
                  {editor.emailError && (
                    <p className="text-xs text-red-600 mt-2">{editor.emailError}</p>
                  )}
                </div>

                {/* Social captions */}
                {editor.socialCaptions && (editor.socialCaptions.facebook || editor.socialCaptions.instagram || editor.socialCaptions.linkedin) && (
                  <div className="w-full max-w-md border border-slate-200 rounded-xl overflow-hidden bg-white">
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
                        {editor.socialCaptions.facebook && (
                          <div className="px-4 py-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Facebook</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{editor.socialCaptions.facebook}</p>
                          </div>
                        )}
                        {editor.socialCaptions.instagram && (
                          <div className="px-4 py-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Instagram</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{editor.socialCaptions.instagram}</p>
                          </div>
                        )}
                        {editor.socialCaptions.linkedin && (
                          <div className="px-4 py-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">LinkedIn</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{editor.socialCaptions.linkedin}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Download bar */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-2.5 flex items-center gap-2 flex-wrap">
            {/* Download Flyer PDF */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => editor.handleDownloadFlyer()}
              disabled={!pdfAsset}
              title={pdfAsset ? 'Download flyer as PDF' : 'Render first to download'}
            >
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              Flyer (PDF)
            </Button>

            {/* Download Preview PNG */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => editor.handleDownloadPreview()}
              disabled={!previewAsset}
              title={previewAsset ? 'Download preview as PNG' : 'Render first to download'}
            >
              <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
              Preview (PNG)
            </Button>

            {/* Download Social PNG */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => editor.handleDownloadSocial()}
              disabled={!socialAsset}
              title={socialAsset ? 'Download social image' : 'Render first to download'}
            >
              <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
              Social (PNG)
            </Button>

            {/* Download Email HTML */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void editor.handleGenerateEmail()}
              disabled={editor.emailState === 'running' || items.length === 0}
              title={items.length === 0 ? 'Add products first' : 'Generate & download email HTML'}
            >
              {editor.emailState === 'running' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Email…
                </>
              ) : (
                <>
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Email (HTML)
                </>
              )}
            </Button>

            {/* Download All ZIP */}
            <Button
              variant={hasAnyAsset ? 'default' : 'outline'}
              size="sm"
              onClick={() => void editor.handleExportZip()}
              disabled={!hasAnyAsset || editor.zipState === 'running'}
              title={hasAnyAsset ? 'Download all assets as ZIP' : 'Render first'}
            >
              {editor.zipState === 'running' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Packaging…
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5 mr-1.5" />
                  All (ZIP)
                </>
              )}
            </Button>

            {editor.zipError && (
              <p className="text-xs text-red-600">{editor.zipError}</p>
            )}
            {editor.emailError && activeTab !== 'email' && (
              <p className="text-xs text-red-600">{editor.emailError}</p>
            )}
          </div>
        </div>

        {/* Right panel */}
        <RightPanel
          promo={promo}
          branches={editor.branches}
          snippets={editor.snippets}
          importMappings={editor.importMappings}
          coopItems={editor.coopItems}
          coopReportAssetData={editor.coopReportAssetData}
          localTitle={editor.localTitle}
          localSubhead={editor.localSubhead}
          localCta={editor.localCta}
          setLocalTitle={editor.setLocalTitle}
          setLocalSubhead={editor.setLocalSubhead}
          setLocalCta={editor.setLocalCta}
          handlePatchPromo={editor.handlePatchPromo}
          keywords={editor.keywords}
          handleKeywordsChange={editor.handleKeywordsChange}
          fileInputRef={editor.fileInputRef}
          uploadState={editor.uploadState}
          uploadError={editor.uploadError}
          setUploadState={editor.setUploadState}
          setUploadError={editor.setUploadError}
          selectedMappingId={editor.selectedMappingId}
          setSelectedMappingId={editor.setSelectedMappingId}
          handleFileChange={editor.handleFileChange}
          urlInputVisible={editor.urlInputVisible}
          setUrlInputVisible={editor.setUrlInputVisible}
          urlValue={editor.urlValue}
          setUrlValue={editor.setUrlValue}
          urlScrapeState={editor.urlScrapeState}
          urlScrapeError={editor.urlScrapeError}
          urlInputRef={editor.urlInputRef}
          handleUrlScrape={editor.handleUrlScrape}
          snippetsPopoverOpen={editor.snippetsPopoverOpen}
          setSnippetsPopoverOpen={editor.setSnippetsPopoverOpen}
          addingSnippetId={editor.addingSnippetId}
          handleAddFromSnippet={editor.handleAddFromSnippet}
          savedItemIds={editor.savedItemIds}
          handleDeleteItem={editor.handleDeleteItem}
          handleSaveAsSnippet={editor.handleSaveAsSnippet}
          openEditItemDialog={editor.openEditItemDialog}
          setDialogOpen={editor.setDialogOpen}
          selectedBranchId={editor.selectedBranchId}
          branchSaving={editor.branchSaving}
          handleBranchChange={editor.handleBranchChange}
          branchPackState={editor.branchPackState}
          branchPackError={editor.branchPackError}
          branchJobs={editor.branchJobs}
          branchPackOpen={editor.branchPackOpen}
          setBranchPackOpen={editor.setBranchPackOpen}
          handleRenderBranchPack={editor.handleRenderBranchPack}
          coopOpen={editor.coopOpen}
          setCoopOpen={editor.setCoopOpen}
          coopSaveState={editor.coopSaveState}
          coopSaveError={editor.coopSaveError}
          coopReportState={editor.coopReportState}
          coopReportUrl={editor.coopReportUrl}
          coopReportError={editor.coopReportError}
          getCoopField={editor.getCoopField}
          setCoopField={editor.setCoopField}
          handleSaveCoopData={editor.handleSaveCoopData}
          handleGenerateCoopReport={editor.handleGenerateCoopReport}
          blobDownload={editor.blobDownload}
          duplicate={{ mutate: () => editor.duplicate.mutate(), isPending: editor.duplicate.isPending }}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Add item dialog                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={editor.dialogOpen} onOpenChange={(open) => {
        editor.setDialogOpen(open)
        if (!open) editor.resetAddItemDialog()
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editor.editingItemId ? 'Edit product' : 'Add product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void editor.handleAddItem(e)} className="space-y-4">
            <div>
              <Label htmlFor="item-name">Name *</Label>
              <Input
                id="item-name"
                value={editor.itemName}
                onChange={(e) => editor.setItemName(e.target.value)}
                placeholder="2×4 Framing Lumber 8ft"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="item-rrp">RRP / MSRP</Label>
                <Input
                  id="item-rrp"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editor.itemRrp}
                  onChange={(e) => editor.setItemRrp(e.target.value)}
                  placeholder="19.99"
                />
              </div>
              <div>
                <Label htmlFor="item-unit">Unit</Label>
                <Input
                  id="item-unit"
                  value={editor.itemUnit}
                  onChange={(e) => editor.setItemUnit(e.target.value)}
                  placeholder="ea, lf, bd ft"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="item-price">Sale price *</Label>
                <Input
                  id="item-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editor.itemPrice}
                  onChange={(e) => editor.setItemPrice(e.target.value)}
                  placeholder="12.99"
                />
              </div>
              <div>
                <Label htmlFor="item-discount">Discount %</Label>
                <Input
                  id="item-discount"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={editor.itemDiscount}
                  onChange={(e) => editor.setItemDiscount(e.target.value)}
                  placeholder="35"
                  disabled={!editor.itemRrp}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="item-sku">SKU</Label>
              <Input
                id="item-sku"
                value={editor.itemSku}
                onChange={(e) => editor.setItemSku(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { editor.setDialogOpen(false); editor.resetAddItemDialog() }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!editor.itemName.trim() || !editor.itemPrice || editor.addingItem}
              >
                {editor.addingItem ? 'Saving…' : editor.editingItemId ? 'Save changes' : 'Add product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
