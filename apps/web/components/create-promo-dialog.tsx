'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ChevronLeft } from 'lucide-react'
import { apiClient, type Promo, type PromoFolder } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TemplateSelector } from '@/components/template-selector'

interface CreatePromoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (promo: Promo) => void
  folders?: PromoFolder[]
  activeFolderId?: string
}

export function CreatePromoDialog({
  open,
  onOpenChange,
  onCreated,
  folders = [],
  activeFolderId,
}: CreatePromoDialogProps) {
  const { getToken } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState<1 | 2>(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [folderId, setFolderId] = useState<string>(activeFolderId ?? '__none__')
  const [templateId, setTemplateId] = useState<string>('multi-product')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setStep(1)
    setTitle('')
    setDescription('')
    setFolderId(activeFolderId ?? '__none__')
    setTemplateId('multi-product')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!isSubmitting) {
      if (!next) resetForm()
      onOpenChange(next)
    }
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setStep(2)
  }

  async function handleCreate() {
    setIsSubmitting(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const { data: promo } = await apiClient(token).promos.create({
        title: title.trim(),
        subhead: description.trim() || undefined,
        folderId: folderId !== '__none__' ? folderId : undefined,
        templateId,
      })

      onCreated?.(promo)
      resetForm()
      onOpenChange(false)
      router.push(`/promos/${promo.id}`)
    } catch (err) {
      const apiErr = err as Error & { status?: number; body?: { error?: string; limit?: number } }
      if (apiErr.status === 403) {
        const limit = apiErr.body?.limit
        setError(
          limit != null
            ? `You've reached your ${limit} promo/month limit. Upgrade to continue.`
            : "You've reached your promo limit. Upgrade to continue.",
        )
      } else {
        setError(apiErr.message ?? 'Something went wrong. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={step === 2 ? 'max-w-2xl' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'New Promo' : 'Choose a template'}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <form onSubmit={handleNext} className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label htmlFor="promo-title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="promo-title"
                autoFocus
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Winter Kickoff Sale"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="promo-description">Description</Label>
              <Textarea
                id="promo-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Winter promo to promote new stock items arriving in December"
                disabled={isSubmitting}
                rows={3}
                className="resize-none"
              />
            </div>

            {folders.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="promo-folder">Folder</Label>
                <Select value={folderId} onValueChange={setFolderId} disabled={isSubmitting}>
                  <SelectTrigger id="promo-folder">
                    <SelectValue placeholder="No folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No folder</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!title.trim()}>
                Next →
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 mt-1">
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <TemplateSelector selected={templateId} onSelect={setTemplateId} />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => void handleCreate()} disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create promo'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
