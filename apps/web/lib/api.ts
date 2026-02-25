const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export interface Account {
  id: string
  name: string
  plan: string
  stripeCustomerId: string | null
  stripeSubId: string | null
  createdAt: string
  updatedAt: string
  currentUser: {
    clerkId: string
    role: string
  }
}

export interface BootstrapResponse extends Omit<Account, 'stripeCustomerId' | 'stripeSubId'> {
  stripeCustomerId?: string | null
  stripeSubId?: string | null
}

export interface Promo {
  id: string
  accountId: string
  title: string
  subhead: string | null
  cta: string | null
  templateId: string | null
  status: string
  createdAt: string
  updatedAt: string
  itemCount?: number
}

export interface Usage {
  plan: string
  promosUsed: number
  promosLimit: number
  periodStart: string
  periodEnd: string
}

export interface BrandKit {
  id: string
  accountId: string
  logoUrl: string | null
  colors: string[]
  fonts: string[]
  defaultCta: string | null
  websiteUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface SaveBrandKitData {
  logoUrl?: string
  colors?: string[]
  defaultCta?: string
}

export interface CreatePromoData {
  title: string
  subhead?: string
  cta?: string
  templateId?: string
}

export interface PromoItem {
  id: string
  promoId: string
  sku: string | null
  name: string
  price: string
  unit: string | null
  category: string | null
  vendor: string | null
  imageUrl: string | null
  sortOrder: number
  createdAt: string
}

export interface ApiError {
  error: string
  limit?: number
}

async function request<T>(
  token: string,
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; status: number }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    const err = new Error((body as ApiError).error ?? 'Request failed') as Error & {
      status: number
      body: ApiError
    }
    ;(err as Error & { status: number; body: ApiError }).status = res.status
    ;(err as Error & { status: number; body: ApiError }).body = body as ApiError
    throw err
  }

  const data = await res.json() as T
  return { data, status: res.status }
}

export function apiClient(token: string) {
  return {
    accounts: {
      bootstrap: async (accountName?: string): Promise<{ data: BootstrapResponse; status: number }> => {
        return request<BootstrapResponse>(token, '/accounts/bootstrap', {
          method: 'POST',
          body: JSON.stringify(accountName ? { accountName } : {}),
        })
      },
      me: async (): Promise<{ data: Account; status: number }> => {
        return request<Account>(token, '/accounts/me', { method: 'GET' })
      },
    },
    promos: {
      list: async (): Promise<{ data: Promo[]; status: number }> => {
        return request<Promo[]>(token, '/promos', { method: 'GET' })
      },
      create: async (data: CreatePromoData): Promise<{ data: Promo; status: number }> => {
        return request<Promo>(token, '/promos', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },
      get: (id: string) => request<Promo & { items: PromoItem[] }>(token, `/promos/${id}`, { method: 'GET' }),
      patch: (id: string, data: { title?: string; subhead?: string | null; cta?: string | null; templateId?: string | null }) =>
        request<Promo>(token, `/promos/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      render: (id: string) => request<{ jobs: Array<{ jobId: string; type: string }> }>(token, `/promos/${id}/render`, { method: 'POST' }),
      getUploadUrl: (id: string, data: { filename: string; contentType: string }) =>
        request<{ uploadUrl: string; uploadId: string; s3Key: string }>(token, `/promos/${id}/upload`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      triggerParse: (id: string, data: { uploadId: string; s3Key: string }) =>
        request<{ jobId: string }>(token, `/promos/${id}/parse-upload`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      deleteItem: (promoId: string, itemId: string) =>
        request<{ ok: boolean }>(token, `/promos/${promoId}/items/${itemId}`, { method: 'DELETE' }),
      bulkItems: (
        id: string,
        items: Array<{
          name: string
          price: number
          sku?: string
          unit?: string
          category?: string
          vendor?: string
          imageUrl?: string
          sortOrder?: number
        }>,
      ) =>
        request<PromoItem[]>(token, `/promos/${id}/items`, {
          method: 'POST',
          body: JSON.stringify({ items }),
        }),
      getAssets: (id: string) =>
        request<Array<{ id: string; type: string; url: string; createdAt: string }>>(
          token,
          `/promos/${id}/assets`,
          { method: 'GET' },
        ),
    },
    jobs: {
      get: (jobId: string) =>
        request<{
          id: string
          type: string
          status: string
          result: unknown
          errorMsg: string | null
        }>(token, `/jobs/${jobId}`, { method: 'GET' }),
    },
    usage: {
      get: async (): Promise<{ data: Usage; status: number }> => {
        return request<Usage>(token, '/usage', { method: 'GET' })
      },
    },
    brandKit: {
      get: async (): Promise<{ data: BrandKit; status: number }> => {
        return request<BrandKit>(token, '/brand-kit', { method: 'GET' })
      },
      save: async (data: SaveBrandKitData): Promise<{ data: BrandKit; status: number }> => {
        return request<BrandKit>(token, '/brand-kit', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },
      bootstrapFromUrl: async (url: string): Promise<{ data: unknown; status: number }> => {
        return request<unknown>(token, '/brand-kit/bootstrap-from-url', {
          method: 'POST',
          body: JSON.stringify({ url }),
        })
      },
    },
    billing: {
      checkout: (priceId: string) =>
        request<{ url: string }>(token, '/billing/checkout', {
          method: 'POST',
          body: JSON.stringify({ priceId }),
        }),
      portal: () =>
        request<{ url: string }>(token, '/billing/portal', {
          method: 'POST',
          body: JSON.stringify({}),
        }),
    },
  }
}
