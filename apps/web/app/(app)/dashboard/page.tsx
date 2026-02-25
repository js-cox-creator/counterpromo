'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useBootstrap } from '@/hooks/use-bootstrap'
import { apiClient, type Promo } from '@/lib/api'
import { CreatePromoDialog } from '@/components/create-promo-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusVariant(status: string): string {
  if (status === 'ready') return 'bg-green-100 text-green-800 border-green-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

export default function DashboardPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { isNewAccount, isLoading: bootstrapLoading } = useBootstrap()

  useEffect(() => {
    if (!bootstrapLoading && isNewAccount) {
      router.push('/onboarding')
    }
  }, [isNewAccount, bootstrapLoading, router])

  const {
    data: promosData,
    isLoading: promosLoading,
    error: promosError,
  } = useQuery({
    queryKey: ['promos'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).promos.list()
    },
    enabled: !bootstrapLoading && !isNewAccount,
  })

  const { data: usageData } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).usage.get()
    },
    enabled: !bootstrapLoading && !isNewAccount,
  })

  function handlePromoCreated(promo: Promo) {
    queryClient.setQueryData<{ data: Promo[]; status: number }>(['promos'], (old) => {
      if (!old) return { data: [promo], status: 200 }
      return { data: [promo, ...old.data], status: old.status }
    })
    void queryClient.invalidateQueries({ queryKey: ['usage'] })
  }

  const promos = promosData?.data ?? []
  const usage = usageData?.data

  if (bootstrapLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Usage banner */}
      {usage && (
        <div className="mb-6 px-4 py-3 bg-slate-100 rounded-lg text-sm text-slate-600">
          <span className="font-medium text-slate-800">{usage.promosUsed}</span> of{' '}
          <span className="font-medium text-slate-800">{usage.promosLimit}</span> promos used this
          month
          {usage.promosUsed >= usage.promosLimit && (
            <span className="ml-2 text-amber-700 font-medium">— limit reached</span>
          )}
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Your Promos</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Promo
        </Button>
      </div>

      {/* Content area */}
      {promosLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : promosError ? (
        <div className="px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">
          Failed to load promos. Please refresh the page.
        </div>
      ) : promos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-slate-500 text-base mb-4">No promos yet</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Create your first promo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {promos.map((promo) => (
            <Link key={promo.id} href={`/promos/${promo.id}`} className="block group">
              <Card className="h-full transition-shadow group-hover:shadow-md cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-slate-900 leading-tight">
                      {promo.title}
                    </CardTitle>
                    <Badge
                      className={`shrink-0 capitalize border ${statusVariant(promo.status)}`}
                      variant="outline"
                    >
                      {promo.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-slate-500 space-y-1">
                    {promo.itemCount != null && (
                      <p>
                        {promo.itemCount} {promo.itemCount === 1 ? 'item' : 'items'}
                      </p>
                    )}
                    <p>Created {formatDate(promo.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreatePromoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handlePromoCreated}
      />
    </div>
  )
}
