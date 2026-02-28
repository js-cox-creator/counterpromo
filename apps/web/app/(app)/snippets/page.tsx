'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { apiClient, type ProductSnippet, type CreateSnippetData } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export default function SnippetsPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const {
    data: snippetsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['snippets'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).snippets.list()
    },
  })

  const snippets: ProductSnippet[] = snippetsData?.data ?? []

  // Create / Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formSku, setFormSku] = useState('')
  const [formUnit, setFormUnit] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formVendor, setFormVendor] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openNewDialog() {
    setEditingId(null)
    setFormName('')
    setFormPrice('')
    setFormSku('')
    setFormUnit('')
    setFormCategory('')
    setFormVendor('')
    setSaveError(null)
    setDialogOpen(true)
  }

  function openEditDialog(snippet: ProductSnippet) {
    setEditingId(snippet.id)
    setFormName(snippet.name)
    setFormPrice(parseFloat(String(snippet.price)).toFixed(2))
    setFormSku(snippet.sku ?? '')
    setFormUnit(snippet.unit ?? '')
    setFormCategory(snippet.category ?? '')
    setFormVendor(snippet.vendor ?? '')
    setSaveError(null)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    setSaveError(null)
  }

  async function handleSave() {
    if (!formName.trim()) {
      setSaveError('Name is required.')
      return
    }
    const priceNum = parseFloat(formPrice)
    if (!formPrice || isNaN(priceNum) || priceNum < 0) {
      setSaveError('A valid price is required.')
      return
    }

    setSaving(true)
    setSaveError(null)

    const data: CreateSnippetData = {
      name: formName.trim(),
      price: priceNum,
      sku: formSku.trim() || undefined,
      unit: formUnit.trim() || undefined,
      category: formCategory.trim() || undefined,
      vendor: formVendor.trim() || undefined,
    }

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      if (editingId) {
        await apiClient(token).snippets.update(editingId, data)
      } else {
        await apiClient(token).snippets.create(data)
      }

      await queryClient.invalidateQueries({ queryKey: ['snippets'] })
      closeDialog()
    } catch (err) {
      setSaveError((err as Error).message ?? 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function openDeleteConfirm(id: string) {
    setDeleteId(id)
    setDeleteError(null)
    setDeleteConfirmOpen(true)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    setDeleteError(null)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      await apiClient(token).snippets.delete(deleteId)
      await queryClient.invalidateQueries({ queryKey: ['snippets'] })
      setDeleteConfirmOpen(false)
      setDeleteId(null)
    } catch (err) {
      setDeleteError((err as Error).message ?? 'Failed to delete. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Product Snippets</h1>
          <p className="mt-1 text-sm text-slate-500">
            Save reusable products here and quickly add them to any promo from the item editor.
          </p>
        </div>
        <Button onClick={openNewDialog} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          Add snippet
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
          Failed to load snippets. Please refresh the page.
        </div>
      ) : snippets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-400 text-sm">No snippets yet.</p>
            <p className="text-slate-400 text-sm mt-1">
              Add a snippet or save items directly from the promo editor.
            </p>
          </CardContent>
        </Card>
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
              {snippets.map((snippet) => (
                <tr key={snippet.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{snippet.name}</td>
                  <td className="px-4 py-3 text-slate-700">
                    ${parseFloat(String(snippet.price)).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{snippet.sku ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{snippet.unit ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{snippet.category ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditDialog(snippet)}
                        className="p-1 text-slate-300 hover:text-slate-600 transition-colors rounded"
                        aria-label={`Edit ${snippet.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteConfirm(snippet.id)}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded"
                        aria-label={`Delete ${snippet.name}`}
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

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit snippet' : 'Add snippet'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="snippet-name">Name *</Label>
              <Input
                id="snippet-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. 2x4 Framing Lumber"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="snippet-price">Price *</Label>
              <Input
                id="snippet-price"
                type="number"
                step="0.01"
                min="0"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="e.g. 9.99"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="snippet-sku">SKU</Label>
                <Input
                  id="snippet-sku"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  placeholder="e.g. LUM-2X4"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="snippet-unit">Unit</Label>
                <Input
                  id="snippet-unit"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  placeholder="e.g. each"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="snippet-category">Category</Label>
                <Input
                  id="snippet-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="e.g. Lumber"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="snippet-vendor">Vendor</Label>
                <Input
                  id="snippet-vendor"
                  value={formVendor}
                  onChange={(e) => setFormVendor(e.target.value)}
                  placeholder="e.g. Huttig"
                />
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{saveError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirmOpen(false)
            setDeleteId(null)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete snippet?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 py-2">
            This snippet will be permanently removed. Existing promo items copied from it will not
            be affected.
          </p>
          {deleteError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false)
                setDeleteId(null)
              }}
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
