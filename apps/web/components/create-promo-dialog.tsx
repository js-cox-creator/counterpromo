'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { apiClient, type Promo } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CreatePromoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (promo: Promo) => void
}

export function CreatePromoDialog({ open, onOpenChange, onCreated }: CreatePromoDialogProps) {
  const { getToken } = useAuth()

  const [title, setTitle] = useState('')
  const [subhead, setSubhead] = useState('')
  const [cta, setCta] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setTitle('')
    setSubhead('')
    setCta('')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!isSubmitting) {
      if (!next) resetForm()
      onOpenChange(next)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const { data: promo } = await apiClient(token).promos.create({
        title: title.trim(),
        subhead: subhead.trim() || undefined,
        cta: cta.trim() || undefined,
      })

      onCreated(promo)
      resetForm()
      onOpenChange(false)
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Promo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="promo-title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="promo-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer Kickoff Sale"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="promo-subhead">Subhead</Label>
            <Input
              id="promo-subhead"
              type="text"
              value={subhead}
              onChange={(e) => setSubhead(e.target.value)}
              placeholder="e.g. Summer Sale — Up to 40% off"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="promo-cta">CTA text</Label>
            <Input
              id="promo-cta"
              type="text"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="e.g. Visit us in-store today"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'Creating…' : 'Create promo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
