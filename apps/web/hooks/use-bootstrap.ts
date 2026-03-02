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
  const { getToken, isLoaded } = useAuth()
  const [account, setAccount] = useState<BootstrapResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isNewAccount, setIsNewAccount] = useState(false)

  useEffect(() => {
    // Wait for Clerk to fully initialise before attempting to get a token.
    // Without this guard, getToken() returns null on the first render after
    // sign-up, causing bootstrap to throw and the dashboard to show "cannot
    // load data" before redirecting to onboarding on the next refresh.
    if (!isLoaded) return

    let cancelled = false

    async function run() {
      try {
        const token = await getToken()
        if (!token) {
          throw new Error('No auth token available')
        }
        const client = apiClient(token)
        const { data } = await client.accounts.bootstrap()
        if (!cancelled) {
          setAccount(data)
          // Redirect to onboarding whenever it hasn't been completed,
          // regardless of whether this is a brand-new account or a returning
          // user who closed the browser mid-setup.
          setIsNewAccount(!data.onboardingCompleted)
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
  }, [getToken, isLoaded])

  return { account, isLoading, error, isNewAccount }
}
