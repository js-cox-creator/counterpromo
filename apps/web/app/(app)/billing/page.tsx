'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/mo',
    features: ['3 promos/month', 'Watermarked PDF', 'Classic template'],
    priceId: null,
    cta: 'Current plan',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    period: '/mo',
    features: ['10 promos/month', 'No watermark', 'All templates'],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? '',
    cta: 'Upgrade to Starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$79',
    period: '/mo',
    features: ['50 promos/month', 'No watermark', 'All templates', 'Priority support'],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? '',
    cta: 'Upgrade to Pro',
  },
  {
    id: 'dealer',
    name: 'Dealer',
    price: '$199',
    period: '/mo',
    features: [
      'Unlimited promos',
      'No watermark',
      'All templates',
      'Dedicated support',
      'White-label',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_DEALER ?? '',
    cta: 'Upgrade to Dealer',
  },
]

export default function BillingPage() {
  const { getToken } = useAuth()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const { data: accountData } = useQuery({
    queryKey: ['account'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).accounts.me()
    },
  })

  const { data: usageData } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).usage.get()
    },
  })

  const account = accountData?.data
  const usage = usageData?.data
  const currentPlan = account?.plan ?? 'free'

  async function handleUpgrade(plan: (typeof PLANS)[number]) {
    if (!plan.priceId) return
    setLoadingPlan(plan.id)
    try {
      const token = await getToken()
      const { data } = await apiClient(token!).billing.checkout(plan.priceId)
      window.location.href = data.url
    } catch (err) {
      console.error('Checkout error', err)
      setLoadingPlan(null)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const token = await getToken()
      const { data } = await apiClient(token!).billing.portal()
      window.location.href = data.url
    } catch (err) {
      console.error('Portal error', err)
      setPortalLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Billing</h1>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="capitalize">
              {currentPlan}
            </Badge>
            {usage && (
              <span className="text-sm text-slate-500">
                {usage.promosUsed} of {usage.promosLimit} promos used this month
              </span>
            )}
          </div>
        </div>

        {account?.stripeCustomerId && (
          <Button
            variant="outline"
            onClick={handlePortal}
            disabled={portalLoading}
          >
            {portalLoading ? 'Redirecting...' : 'Manage subscription'}
          </Button>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id
          const missingPriceId = plan.priceId === ''

          return (
            <Card
              key={plan.id}
              className={isCurrent ? 'ring-2 ring-blue-500' : ''}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent && (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                      Current plan
                    </Badge>
                  )}
                </div>
                <p className="text-2xl font-bold">
                  {plan.price}
                  <span className="text-sm font-normal text-slate-500">{plan.period}</span>
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm text-slate-600 flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div title={missingPriceId && !isCurrent ? 'Coming soon' : undefined}>
                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={isCurrent || missingPriceId || loadingPlan !== null}
                    onClick={() => handleUpgrade(plan)}
                  >
                    {loadingPlan === plan.id
                      ? 'Redirecting...'
                      : isCurrent
                        ? 'Current plan'
                        : missingPriceId
                          ? 'Coming soon'
                          : plan.cta}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
