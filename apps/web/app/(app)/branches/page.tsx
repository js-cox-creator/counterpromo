'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, MapPin, Phone, Mail, MessageSquare } from 'lucide-react'
import { apiClient, type Branch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BranchFormData {
  name: string
  address: string
  phone: string
  email: string
  cta: string
}

const emptyForm: BranchFormData = {
  name: '',
  address: '',
  phone: '',
  email: '',
  cta: '',
}

function branchToForm(branch: Branch): BranchFormData {
  return {
    name: branch.name,
    address: branch.address ?? '',
    phone: branch.phone ?? '',
    email: branch.email ?? '',
    cta: branch.cta ?? '',
  }
}

export default function BranchesPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const { data: accountData } = useQuery({
    queryKey: ['account'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).accounts.me()
    },
  })

  const {
    data: branchesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).branches.list()
    },
  })

  const isMember = accountData?.data?.currentUser?.role === 'member'
  const branches = branchesData?.data ?? []

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [form, setForm] = useState<BranchFormData>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)

  function openCreateDialog() {
    setEditingBranch(null)
    setForm(emptyForm)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEditDialog(branch: Branch) {
    setEditingBranch(branch)
    setForm(branchToForm(branch))
    setFormError(null)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingBranch(null)
    setForm(emptyForm)
    setFormError(null)
  }

  function updateField(field: keyof BranchFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError('Branch name is required.')
      return
    }

    setFormLoading(true)
    setFormError(null)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        cta: form.cta.trim() || undefined,
      }

      if (editingBranch) {
        await apiClient(token).branches.update(editingBranch.id, payload)
      } else {
        await apiClient(token).branches.create(payload)
      }

      await queryClient.invalidateQueries({ queryKey: ['branches'] })
      closeDialog()
    } catch (err) {
      const apiErr = err as Error
      setFormError(apiErr.message ?? 'Something went wrong. Please try again.')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(branch: Branch) {
    if (deletingId === branch.id) return

    setDeleteError(null)
    setDeletingId(branch.id)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      await apiClient(token).branches.delete(branch.id)
      await queryClient.invalidateQueries({ queryKey: ['branches'] })
    } catch (err) {
      const apiErr = err as Error
      setDeleteError({ id: branch.id, message: apiErr.message ?? 'Failed to delete branch.' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-8 max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Branches</h1>
        {!isMember && (
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Branch
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
          Failed to load branches. Please refresh the page.
        </div>
      ) : branches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 text-sm">No branches yet.</p>
            {!isMember && (
              <Button variant="outline" onClick={openCreateDialog} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Create your first branch
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {branches.map((branch) => (
            <Card key={branch.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{branch.name}</CardTitle>
                  {!isMember && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-slate-700"
                        onClick={() => openEditDialog(branch)}
                        title="Edit branch"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-red-600"
                        onClick={() => handleDelete(branch)}
                        disabled={deletingId === branch.id}
                        title="Delete branch"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600 flex-1">
                {branch.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                    <span>{branch.address}</span>
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>{branch.phone}</span>
                  </div>
                )}
                {branch.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>{branch.email}</span>
                  </div>
                )}
                {branch.cta && (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="italic text-slate-500">{branch.cta}</span>
                  </div>
                )}
                {!branch.address && !branch.phone && !branch.email && !branch.cta && (
                  <p className="text-slate-400">No additional details</p>
                )}

                {deleteError?.id === branch.id && (
                  <p className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded mt-2">
                    {deleteError.message}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'Edit Branch' : 'Create Branch'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="branch-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="branch-name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. Downtown Store"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-address">Address</Label>
              <Input
                id="branch-address"
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="e.g. 123 Main St, Springfield"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-phone">Phone</Label>
              <Input
                id="branch-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="e.g. (555) 123-4567"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-email">Contact Email</Label>
              <Input
                id="branch-email"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="e.g. downtown@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-cta">CTA Override</Label>
              <Input
                id="branch-cta"
                value={form.cta}
                onChange={(e) => updateField('cta', e.target.value)}
                placeholder="e.g. Visit us on Main Street"
              />
              <p className="text-xs text-slate-400">
                Overrides the account-level default CTA on promos for this branch.
              </p>
            </div>

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{formError}</p>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={formLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading
                  ? editingBranch
                    ? 'Saving…'
                    : 'Creating…'
                  : editingBranch
                    ? 'Save changes'
                    : 'Create branch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
