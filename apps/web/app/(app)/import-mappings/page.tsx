'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { apiClient, type ColumnMappings, type ImportMapping } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const FIELD_LABELS: { key: keyof ColumnMappings; label: string; placeholder: string }[] = [
  { key: 'name', label: 'Product Name', placeholder: 'e.g. Product Name, Description, Item' },
  { key: 'price', label: 'Price', placeholder: 'e.g. Price, Cost, Retail' },
  { key: 'sku', label: 'SKU', placeholder: 'e.g. SKU, Item #, Part No' },
  { key: 'unit', label: 'Unit', placeholder: 'e.g. Unit, UOM, Each' },
  { key: 'category', label: 'Category', placeholder: 'e.g. Category, Department, Type' },
  { key: 'vendor', label: 'Vendor', placeholder: 'e.g. Vendor, Brand, Supplier' },
]

const EMPTY_MAPPINGS: ColumnMappings = {
  name: '',
  price: '',
  sku: '',
  unit: '',
  category: '',
  vendor: '',
}

function mappedColumnCount(mappings: ColumnMappings): number {
  return Object.values(mappings).filter((v) => typeof v === 'string' && v.trim() !== '').length
}

function mappedColumnSummary(mappings: ColumnMappings): string[] {
  return FIELD_LABELS.filter(
    ({ key }) => typeof mappings[key] === 'string' && (mappings[key] as string).trim() !== '',
  ).map(({ label }) => label)
}

export default function ImportMappingsPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const {
    data: mappingsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['import-mappings'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).importMappings.list()
    },
  })

  const mappings: ImportMapping[] = mappingsData?.data ?? []

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [profileName, setProfileName] = useState('')
  const [columnMappings, setColumnMappings] = useState<ColumnMappings>(EMPTY_MAPPINGS)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openNewDialog() {
    setEditingId(null)
    setProfileName('')
    setColumnMappings(EMPTY_MAPPINGS)
    setSaveError(null)
    setDialogOpen(true)
  }

  function openEditDialog(mapping: ImportMapping) {
    setEditingId(mapping.id)
    setProfileName(mapping.name)
    setColumnMappings({
      name: mapping.mappings.name ?? '',
      price: mapping.mappings.price ?? '',
      sku: mapping.mappings.sku ?? '',
      unit: mapping.mappings.unit ?? '',
      category: mapping.mappings.category ?? '',
      vendor: mapping.mappings.vendor ?? '',
    })
    setSaveError(null)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    setSaveError(null)
  }

  function setField(key: keyof ColumnMappings, value: string) {
    setColumnMappings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!profileName.trim()) {
      setSaveError('Profile name is required.')
      return
    }

    setSaving(true)
    setSaveError(null)

    // Strip empty strings — only send headers that were actually filled in
    const cleanedMappings: ColumnMappings = Object.fromEntries(
      Object.entries(columnMappings).filter(([, v]) => typeof v === 'string' && v.trim() !== ''),
    )

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      if (editingId) {
        await apiClient(token).importMappings.update(editingId, {
          name: profileName.trim(),
          mappings: cleanedMappings,
        })
      } else {
        await apiClient(token).importMappings.create({
          name: profileName.trim(),
          mappings: cleanedMappings,
        })
      }

      await queryClient.invalidateQueries({ queryKey: ['import-mappings'] })
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

      await apiClient(token).importMappings.delete(deleteId)
      await queryClient.invalidateQueries({ queryKey: ['import-mappings'] })
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
          <h1 className="text-2xl font-semibold text-slate-900">Column Mapping Profiles</h1>
          <p className="mt-1 text-sm text-slate-500">
            Column mapping profiles let you skip manual column detection. Enter the exact column
            headers from your spreadsheet so CounterPromo knows where to find each field.
          </p>
        </div>
        <Button onClick={openNewDialog} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          New mapping
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
          Failed to load mapping profiles. Please refresh the page.
        </div>
      ) : mappings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-400 text-sm">No mapping profiles yet.</p>
            <p className="text-slate-400 text-sm mt-1">
              Create one to speed up CSV and XLSX imports.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {mappings.map((mapping) => {
            const mapped = mappedColumnSummary(mapping.mappings)
            const count = mappedColumnCount(mapping.mappings)
            return (
              <Card key={mapping.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{mapping.name}</CardTitle>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {count} of {FIELD_LABELS.length} columns mapped
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(mapping)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteConfirm(mapping.id)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {mapped.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {mapped.map((label) => (
                        <Badge key={label} variant="secondary" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No columns mapped yet.</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit mapping profile' : 'New mapping profile'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <p className="text-sm text-slate-500">
              Enter the exact column headers from your spreadsheet for each field. Leave blank to
              use automatic detection for that field.
            </p>

            {/* Profile name */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Profile name</Label>
              <Input
                id="profile-name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g. Huttig supplier sheet"
              />
            </div>

            {/* Column header inputs */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELD_LABELS.map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`col-${key}`}>{label}</Label>
                  <Input
                    id={`col-${key}`}
                    value={(columnMappings[key] as string) ?? ''}
                    onChange={(e) => setField(key, e.target.value)}
                    placeholder={placeholder}
                  />
                </div>
              ))}
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
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => { if (!open) { setDeleteConfirmOpen(false); setDeleteId(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete mapping profile?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 py-2">
            This profile will be permanently removed. Existing imports that used it will not be
            affected.
          </p>
          {deleteError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteConfirmOpen(false); setDeleteId(null) }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
