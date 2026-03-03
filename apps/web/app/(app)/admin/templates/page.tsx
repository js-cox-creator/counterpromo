'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, ShieldCheck, ChevronDown, ChevronUp, Code2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { apiClient, type CustomTemplate, type Account } from '@/lib/api'
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
// Variable reference (same as /templates page — keep in sync)
// ---------------------------------------------------------------------------

const VAR_GROUPS = [
  {
    title: 'Colours',
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
    title: 'Brand & promo',
    items: [
      { cls: 'counterpromo-brand-name', desc: 'brand name' },
      { cls: 'counterpromo-brand-logo', desc: '<img> src → logo URL' },
      { cls: 'counterpromo-promo-title', desc: 'promo title' },
      { cls: 'counterpromo-promo-subhead', desc: 'subhead (removed if null)' },
      { cls: 'counterpromo-promo-cta', desc: 'CTA text' },
    ],
  },
  {
    title: 'Branch',
    items: [
      { cls: 'counterpromo-branch-name', desc: 'branch name' },
      { cls: 'counterpromo-branch-phone', desc: 'phone' },
      { cls: 'counterpromo-branch-email', desc: 'email' },
      { cls: 'counterpromo-branch-address', desc: 'address' },
    ],
  },
  {
    title: 'Product repeater',
    items: [
      { cls: 'counterpromo-product', desc: 'container — cloned once per item' },
      { cls: 'counterpromo-product-name', desc: 'item name' },
      { cls: 'counterpromo-product-price', desc: 'e.g. $12.99' },
      { cls: 'counterpromo-product-price-whole', desc: 'whole dollars' },
      { cls: 'counterpromo-product-price-cents', desc: 'cents' },
      { cls: 'counterpromo-product-image', desc: '<img> src (removed if none)' },
      { cls: 'counterpromo-product-category', desc: 'category' },
      { cls: 'counterpromo-product-vendor', desc: 'vendor' },
      { cls: 'counterpromo-product-sku', desc: 'SKU' },
      { cls: 'counterpromo-product-unit', desc: 'unit' },
    ],
  },
  {
    title: 'Conditionals',
    items: [
      { cls: 'counterpromo-if-logo', desc: 'removed when no logo' },
      { cls: 'counterpromo-if-branch', desc: 'removed when no branch' },
      { cls: 'counterpromo-if-subhead', desc: 'removed when no subhead' },
    ],
  },
  {
    title: 'AI copy',
    items: [{ cls: 'counterpromo-gen', desc: 'element text = Gemini prompt; replaced with AI copy' }],
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
// Page
// ---------------------------------------------------------------------------

export default function AdminTemplatesPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const router = useRouter()

  // Gate access
  const { data: accountData, isLoading: accountLoading } = useQuery({
    queryKey: ['account-me'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).accounts.me()
    },
  })
  const account = accountData?.data as Account | undefined

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['custom-templates'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).customTemplates.list()
    },
    enabled: account?.isProductAdmin === true,
  })

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

  if (accountLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!account?.isProductAdmin) {
    router.replace('/dashboard')
    return null
  }

  const systemTemplates = (templatesData?.data ?? []).filter((t) => t.isSystem)

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
          isSystem: true,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            <h1 className="text-2xl font-semibold text-slate-900">Global Templates</h1>
          </div>
          <p className="text-sm text-slate-500">
            System templates visible to all accounts. Users can fork them to create their own variants.
          </p>
        </div>
        <Button onClick={openNewEditor} className="shrink-0 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-1.5" />
          New system template
        </Button>
      </div>

      {/* Templates grid */}
      {templatesLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : systemTemplates.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl py-16 text-center">
          <ShieldCheck className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No system templates yet.</p>
          <button
            type="button"
            onClick={openNewEditor}
            className="mt-2 text-sm text-indigo-600 hover:underline"
          >
            Create the first one
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Description</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Size</th>
                <th className="w-24 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {systemTemplates.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{t.name}</span>
                      <Badge variant="secondary" className="text-[10px]">System</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{t.description ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{t.htmlContent.length.toLocaleString()} chars</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => openEditEditor(t)}
                        className="p-1.5 text-slate-300 hover:text-slate-600 transition-colors rounded"
                        aria-label={`Edit ${t.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(t)}
                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded"
                        aria-label={`Delete ${t.name}`}
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

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={(open) => { if (!open) closeEditor() }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? `Edit: ${editingTemplate.name}` : 'New System Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="adm-name">Name *</Label>
              <Input
                id="adm-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Classic 3-Col Flyer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adm-desc">Description</Label>
              <Input
                id="adm-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Short description shown to users"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adm-html">HTML *</Label>
              <textarea
                id="adm-html"
                value={formHtml}
                onChange={(e) => setFormHtml(e.target.value)}
                placeholder={'<!DOCTYPE html>\n<html>...</html>'}
                rows={20}
                className="w-full font-mono text-xs border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y bg-slate-50 text-slate-800"
              />
            </div>

            <VarReference />

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{saveError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} disabled={saving}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? 'Saving…' : editingTemplate ? 'Save changes' : 'Publish template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteError(null) } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete system template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 py-2">
            &ldquo;{deleteTarget?.name}&rdquo; will be permanently removed from all accounts. Any promos using it will fall back to the default template.
          </p>
          {deleteError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteError(null) }} disabled={deleting}>
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
