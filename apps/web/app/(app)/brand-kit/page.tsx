'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function BrandKitPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const {
    data: brandKitData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['brand-kit'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).brandKit.get()
    },
  })

  const { data: accountData } = useQuery({
    queryKey: ['account'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).accounts.me()
    },
  })

  const isMember = accountData?.data?.currentUser?.role === 'member'

  const brandKit = brandKitData?.data

  // Editable form state — seeded from query data
  const [logoUrl, setLogoUrl] = useState('')
  const [defaultCta, setDefaultCta] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Bootstrap from URL state
  const [bootstrapUrl, setBootstrapUrl] = useState('')
  const [bootstrapLoading, setBootstrapLoading] = useState(false)
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)

  // Seed form once data arrives (only on first load)
  const [seeded, setSeeded] = useState(false)
  if (brandKit && !seeded) {
    setLogoUrl(brandKit.logoUrl ?? '')
    setDefaultCta(brandKit.defaultCta ?? '')
    setSeeded(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveLoading(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      await apiClient(token).brandKit.save({
        logoUrl: logoUrl.trim() || undefined,
        defaultCta: defaultCta.trim() || undefined,
        colors: brandKit?.colors,
      })

      await queryClient.invalidateQueries({ queryKey: ['brand-kit'] })
      setSaveSuccess(true)
    } catch (err) {
      const apiErr = err as Error
      setSaveError(apiErr.message ?? 'Failed to save. Please try again.')
    } finally {
      setSaveLoading(false)
    }
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault()
    if (!bootstrapUrl.trim()) return

    setBootstrapLoading(true)
    setBootstrapMessage(null)
    setBootstrapError(null)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      await apiClient(token).brandKit.bootstrapFromUrl(bootstrapUrl.trim())
      setBootstrapMessage('Processing in background — refresh in a moment')
      setBootstrapUrl('')
    } catch (err) {
      const apiErr = err as Error
      setBootstrapError(apiErr.message ?? 'Failed to start extraction. Please try again.')
    } finally {
      setBootstrapLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Brand Kit</h1>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
          Failed to load brand kit. Please refresh the page.
        </div>
      ) : (
        <>
          {/* Current Brand Kit */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Brand Kit</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-5">
                {/* Logo */}
                <div className="space-y-1.5">
                  <Label>Logo</Label>
                  {brandKit?.logoUrl ? (
                    <div className="mb-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={brandKit.logoUrl}
                        alt="Brand logo"
                        className="max-h-20 object-contain border border-slate-200 rounded p-1 bg-white"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 mb-2">No logo set</p>
                  )}
                  <Input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                {/* Colors */}
                <div className="space-y-1.5">
                  <Label>Colors</Label>
                  {brandKit?.colors && brandKit.colors.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {brandKit.colors.map((color) => (
                        <div key={color} className="flex items-center gap-1.5">
                          <div
                            className="h-6 w-6 rounded border border-slate-200 shrink-0"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                          <span className="text-xs text-slate-500 font-mono">{color}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No colors set</p>
                  )}
                </div>

                {/* Default CTA */}
                <div className="space-y-1.5">
                  <Label htmlFor="default-cta">Default CTA</Label>
                  <Input
                    id="default-cta"
                    type="text"
                    value={defaultCta}
                    onChange={(e) => setDefaultCta(e.target.value)}
                    placeholder="e.g. Visit us in-store today"
                  />
                </div>

                {saveError && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                    {saveError}
                  </p>
                )}
                {saveSuccess && (
                  <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">
                    Brand kit saved.
                  </p>
                )}

                {isMember ? (
                  <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-md">
                    Only account owners and admins can update the brand kit.
                  </p>
                ) : (
                  <Button type="submit" disabled={saveLoading}>
                    {saveLoading ? 'Saving…' : 'Save changes'}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Bootstrap from website */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bootstrap from website</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBootstrap} className="space-y-4">
                <p className="text-sm text-slate-500">
                  Enter your company website and we will extract your logo, colors, and CTA
                  automatically.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={bootstrapUrl}
                    onChange={(e) => setBootstrapUrl(e.target.value)}
                    placeholder="https://www.yourcompany.com"
                    disabled={bootstrapLoading}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={bootstrapLoading || !bootstrapUrl.trim()}>
                    {bootstrapLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Extracting…
                      </>
                    ) : (
                      'Extract brand'
                    )}
                  </Button>
                </div>

                {bootstrapMessage && (
                  <p className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-md">
                    {bootstrapMessage}
                  </p>
                )}
                {bootstrapError && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                    {bootstrapError}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
