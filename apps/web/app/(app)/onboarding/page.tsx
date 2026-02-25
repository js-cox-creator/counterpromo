'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { apiClient } from '@/lib/api'

type Step = 1 | 2

export default function OnboardingPage() {
  const router = useRouter()
  const { getToken } = useAuth()

  const [step, setStep] = useState<Step>(1)
  const [accountName, setAccountName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (!accountName.trim()) return
    setStep(2)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const client = apiClient(token)

      // Bootstrap the account with the provided name
      await client.accounts.bootstrap(accountName.trim())

      // If a website URL was provided, call the brand bootstrap endpoint
      if (websiteUrl.trim()) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/brand-kit/bootstrap-from-url`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ url: websiteUrl.trim() }),
          },
        )
        // Non-blocking — if it fails we still continue
        if (!res.ok) {
          console.warn('Brand bootstrap failed, continuing to dashboard')
        }
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Welcome to CounterPromo</h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === 1
              ? "Let's get your account set up in just a couple of steps."
              : "Optionally add your website so we can auto-detect your brand."}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2 mb-8">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-slate-800' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1} className="space-y-4">
            <div>
              <label
                htmlFor="accountName"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Company / Account name <span className="text-red-500">*</span>
              </label>
              <input
                id="accountName"
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. Acme Lumber Co."
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={!accountName.trim()}
              className="w-full py-2 px-4 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="websiteUrl"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Company website{' '}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://www.yourcompany.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-slate-400">
                We&apos;ll extract your logo, colors, and default CTA automatically.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2 px-4 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Setting up…' : 'Finish setup'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
