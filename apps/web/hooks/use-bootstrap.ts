'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { apiClient, type BootstrapResponse } from '@/lib/api'

interface UseBootstrapResult {
  account: BootstrapResponse | null
  isLoading: boolean
  error: Error | null
  isNewAccount: boolean
}

export function useBootstrap(): UseBootstrapResult {
  const { getToken } = useAuth()
  const [account, setAccount] = useState<BootstrapResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isNewAccount, setIsNewAccount] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const token = await getToken()
        if (!token) {
          throw new Error('No auth token available')
        }
        const client = apiClient(token)
        const { data, status } = await client.accounts.bootstrap()
        if (!cancelled) {
          setAccount(data)
          setIsNewAccount(status === 201)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Bootstrap failed'))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [getToken])

  return { account, isLoading, error, isNewAccount }
}
