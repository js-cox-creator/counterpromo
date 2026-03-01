'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Code2, Copy } from 'lucide-react'
import { apiClient, type CustomTemplate } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// ---------------------------------------------------------------------------
// Variable reference panel
// ---------------------------------------------------------------------------

const VAR_GROUPS = [
  {
    title: 'Colours (inline style injection)',
    items: [
      { cls: 'counterpromo-bg-primary', desc: 'background-color → brand primary' },
      { cls: 'counterpromo-bg-secondary', desc: 'background-color → brand secondary' },
      { cls: 'counterpromo-text-primary', desc: 'color → brand primary' },
      { cls: 'counterpromo-text-secondary', desc: 'color → brand secondary' },
      { cls: 'counterpromo-border-primary', desc: 'border-color → brand primary' },
      { cls: 'counterpromo-border-secondary', desc: 'border-color → brand secondary' },
    ],
  },
  {
    title: 'Brand & promo text slots',
    items: [
      { cls: 'counterpromo-brand-name', desc: 'Text → brand name' },
      { cls: 'counterpromo-brand-logo', desc: '<img> src → brand logo URL; removed if no logo' },
      { cls: 'counterpromo-promo-title', desc: 'Text → promo title' },
      { cls: 'counterpromo-promo-subhead', desc: 'Text → promo subhead; removed if null' },
      { cls: 'counterpromo-promo-cta', desc: 'Text → promo CTA or "Contact us today"' },
    ],
  },
  {
    title: 'Branch slots',
    items: [
      { cls: 'counterpromo-branch-name', desc: 'Text → branch name' },
      { cls: 'counterpromo-branch-phone', desc: 'Text → branch phone' },
      { cls: 'counterpromo-branch-email', desc: 'Text → branch email' },
      { cls: 'counterpromo-branch-address', desc: 'Text → branch address' },
    ],
  },
  {
    title: 'Product repeater',
    items: [
      { cls: 'counterpromo-product', desc: 'Container — cloned once per item' },
      { cls: 'counterpromo-product-name', desc: 'Text → item name' },
      { cls: 'counterpromo-product-price', desc: 'Text → formatted price e.g. $12.99' },
      { cls: 'counterpromo-product-price-whole', desc: 'Text → whole dollars e.g. 12' },
      { cls: 'counterpromo-product-price-cents', desc: 'Text → cents e.g. 99' },
      { cls: 'counterpromo-product-image', desc: '<img> src → item image; removed if none' },
      { cls: 'counterpromo-product-category', desc: 'Text → item category' },
      { cls: 'counterpromo-product-vendor', desc: 'Text → item vendor' },
      { cls: 'counterpromo-product-sku', desc: 'Text → item SKU' },
      { cls: 'counterpromo-product-unit', desc: 'Text → item unit' },
    ],
  },
  {
    title: 'Conditionals (element removed when false)',
    items: [
      { cls: 'counterpromo-if-logo', desc: 'Removed when brand has no logo' },
      { cls: 'counterpromo-if-branch', desc: 'Removed when no branch is set' },
      { cls: 'counterpromo-if-subhead', desc: 'Removed when subhead is null' },
    ],
  },
  {
    title: 'AI-generated copy',
    items: [
      { cls: 'counterpromo-gen', desc: 'Element text is a Gemini prompt; replaced with AI copy' },
    ],
  },
]

function VarReference() {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-slate-200 rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors rounded-lg"
      >
        <span className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-slate-400" />
          Variable Reference
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-200 divide-y divide-slate-100">
          {VAR_GROUPS.map((group) => (
            <div key={group.title} className="px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{group.title}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.cls} className="flex gap-3">
                    <code className="text-[11px] font-mono bg-slate-100 text-blue-700 px-1.5 py-0.5 rounded shrink-0">{item.cls}</code>
                    <span className="text-xs text-slate-500">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Template card
// ---------------------------------------------------------------------------

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onFork,
}: {
  template: CustomTemplate
  onEdit: (t: CustomTemplate) => void
  onDelete: (t: CustomTemplate) => void
  onFork?: (t: CustomTemplate) => void
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 truncate">{template.name}</p>
            {template.isSystem && (
              <Badge variant="secondary" className="text-[10px] shrink-0">System</Badge>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{template.description}</p>
          )}
          <p className="text-[10px] text-slate-400 mt-1">
            {template.htmlContent.length.toLocaleString()} chars
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {template.isSystem ? (
            onFork && (
              <button
                type="button"
                onClick={() => onFork(template)}
                className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors rounded"
                aria-label={`Fork ${template.name}`}
                title="Fork — copy HTML into a new custom template"
              >
                <Copy className="h-4 w-4" />
              </button>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={() => onEdit(template)}
                className="p-1.5 text-slate-300 hover:text-slate-600 transition-colors rounded"
                aria-label={`Edit ${template.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(template)}
                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded"
                aria-label={`Delete ${template.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TemplatesPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const { data: templatesData, isLoading, error } = useQuery({
    queryKey: ['custom-templates'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).customTemplates.list()
    },
  })

  const templates: CustomTemplate[] = templatesData?.data ?? []
  const myTemplates = templates.filter((t) => !t.isSystem)
  const systemTemplates = templates.filter((t) => t.isSystem)

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CustomTemplate | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formHtml, setFormHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<CustomTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openNewEditor() {
    setEditingTemplate(null)
    setFormName('')
    setFormDescription('')
    setFormHtml('')
    setSaveError(null)
    setEditorOpen(true)
  }

  function openEditEditor(t: CustomTemplate) {
    setEditingTemplate(t)
    setFormName(t.name)
    setFormDescription(t.description ?? '')
    setFormHtml(t.htmlContent)
    setSaveError(null)
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditingTemplate(null)
    setSaveError(null)
  }

  function handleFork(t: CustomTemplate) {
    setEditingTemplate(null)
    setFormName(`${t.name} (fork)`)
    setFormDescription(t.description ?? '')
    setFormHtml(t.htmlContent)
    setSaveError(null)
    setEditorOpen(true)
  }

  async function handleSave() {
    if (!formName.trim()) { setSaveError('Name is required.'); return }
    if (!formHtml.trim()) { setSaveError('HTML content is required.'); return }
    setSaving(true)
    setSaveError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      if (editingTemplate) {
        await apiClient(token).customTemplates.update(editingTemplate.id, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          htmlContent: formHtml,
        })
      } else {
        await apiClient(token).customTemplates.create({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          htmlContent: formHtml,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['custom-templates'] })
      closeEditor()
    } catch (err) {
      setSaveError((err as Error).message ?? 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      await apiClient(token).customTemplates.delete(deleteTarget.id)
      await queryClient.invalidateQueries({ queryKey: ['custom-templates'] })
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError((err as Error).message ?? 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Templates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload custom HTML templates using <code className="text-xs bg-slate-100 px-1 rounded">counterpromo-*</code> class slots.
          </p>
        </div>
        <Button onClick={openNewEditor} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          Upload Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
          Failed to load templates. Please refresh.
        </div>
      ) : (
        <>
          {/* My Templates */}
          <section>
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">My Templates</h2>
            {myTemplates.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl py-10 text-center">
                <p className="text-sm text-slate-400">No custom templates yet.</p>
                <button
                  type="button"
                  onClick={openNewEditor}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  Upload your first template
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {myTemplates.map((t) => (
                  <TemplateCard key={t.id} template={t} onEdit={openEditEditor} onDelete={setDeleteTarget} />
                ))}
                <button
                  type="button"
                  onClick={openNewEditor}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New template
                </button>
              </div>
            )}
          </section>

          {/* System Templates */}
          {systemTemplates.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">System Templates</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {systemTemplates.map((t) => (
                  <TemplateCard key={t.id} template={t} onEdit={openEditEditor} onDelete={setDeleteTarget} onFork={handleFork} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Template Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={(open) => { if (!open) closeEditor() }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Upload Template'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name *</Label>
              <Input
                id="tpl-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Spring Sale Flyer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Description</Label>
              <Input
                id="tpl-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional short description"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-html">HTML Content *</Label>
              <textarea
                id="tpl-html"
                value={formHtml}
                onChange={(e) => setFormHtml(e.target.value)}
                placeholder={'<!DOCTYPE html>\n<html>...</html>'}
                rows={16}
                className="w-full font-mono text-xs border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y bg-slate-50 text-slate-800"
              />
            </div>

            <VarReference />

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{saveError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteError(null) } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 py-2">
            &ldquo;{deleteTarget?.name}&rdquo; will be permanently deleted. Any promos using it will fall back to the default template.
          </p>
          {deleteError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteTarget(null); setDeleteError(null) }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
