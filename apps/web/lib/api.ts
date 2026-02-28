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

export interface PromoFolder {
  id: string
  accountId: string
  name: string
  promoCount: number
  createdAt: string
  updatedAt: string
}

export interface Promo {
  id: string
  accountId: string
  folderId: string | null
  branchId: string | null
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
  folderId?: string
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

export interface Branch {
  id: string
  accountId: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  cta: string | null
  createdAt: string
  updatedAt: string
}

export interface TeamMember {
  id: string
  clerkId: string
  email: string
  name: string | null
  role: string
  branchId: string | null
  createdAt: string
}

export interface TeamInvite {
  id: string
  email: string
  role: string
  token: string
  status: string
  expiresAt: string
  createdAt: string
}

export interface ColumnMappings {
  name?: string
  price?: string
  sku?: string
  unit?: string
  category?: string
  vendor?: string
}

export interface ImportMapping {
  id: string
  accountId: string
  name: string
  mappings: ColumnMappings
  createdAt: string
  updatedAt: string
}

export interface ProductSnippet {
  id: string
  accountId: string
  name: string
  price: string // Decimal serialises to string
  sku: string | null
  unit: string | null
  category: string | null
  vendor: string | null
  imageUrl: string | null
  sourceUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateSnippetData {
  name: string
  price: number
  sku?: string
  unit?: string
  category?: string
  vendor?: string
  imageUrl?: string
  sourceUrl?: string
}

export interface CoopItemUpdate {
  itemId: string
  coopVendor?: string
  coopAmount?: number
  coopNote?: string
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rawBody = await res.json().catch(() => ({ error: res.statusText }))
    const body = rawBody as ApiError
    const message = typeof body?.error === 'string' ? body.error : 'Request failed'
    throw Object.assign(new Error(message), { status: res.status, body })
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
      list: async (folderId?: string | 'unfiled'): Promise<{ data: Promo[]; status: number }> => {
        const qs = folderId ? `?folderId=${encodeURIComponent(folderId)}` : ''
        return request<Promo[]>(token, `/promos${qs}`, { method: 'GET' })
      },
      create: async (data: CreatePromoData): Promise<{ data: Promo; status: number }> => {
        return request<Promo>(token, '/promos', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      },
      get: (id: string) => request<Promo & { items: PromoItem[] }>(token, `/promos/${id}`, { method: 'GET' }),
      patch: (id: string, data: { title?: string; subhead?: string | null; cta?: string | null; templateId?: string | null; folderId?: string | null; branchId?: string | null }) =>
        request<Promo>(token, `/promos/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      duplicate: (id: string) =>
        request<Promo>(token, `/promos/${id}/duplicate`, { method: 'POST', body: JSON.stringify({}) }),
      render: (id: string) => request<{ jobs: Array<{ jobId: string; type: string }> }>(token, `/promos/${id}/render`, { method: 'POST', body: JSON.stringify({}) }),
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
      exportZip: (id: string) =>
        request<{ jobId: string }>(token, `/promos/${id}/export-zip`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),
      renderEmail: (id: string) =>
        request<{ jobId: string }>(token, `/promos/${id}/render-email`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),
      itemFromUrl: (id: string, data: { url: string; itemId?: string }) =>
        request<{ jobId: string; itemId: string }>(token, `/promos/${id}/items/from-url`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      itemFromSnippet: (promoId: string, snippetId: string) =>
        request<PromoItem>(token, `/promos/${promoId}/items/from-snippet`, {
          method: 'POST',
          body: JSON.stringify({ snippetId }),
        }),
      renderBranchPack: (id: string) =>
        request<{
          branches: Array<{
            branchId: string
            branchName: string
            jobs: { preview: string; pdf: string; social: string; email: string }
          }>
        }>(token, `/promos/${id}/render-branch-pack`, { method: 'POST', body: JSON.stringify({}) }),
      getAssets: (id: string) =>
        request<Array<{ id: string; type: string; branchId: string | null; url: string; createdAt: string }>>(
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
    branches: {
      list: () => request<Branch[]>(token, '/branches', { method: 'GET' }),
      create: (data: { name: string; address?: string; phone?: string; email?: string; cta?: string }) =>
        request<Branch>(token, '/branches', { method: 'POST', body: JSON.stringify(data) }),
      get: (id: string) => request<Branch>(token, `/branches/${id}`, { method: 'GET' }),
      update: (id: string, data: Partial<{ name: string; address: string; phone: string; email: string; cta: string }>) =>
        request<Branch>(token, `/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id: string) => request<{ ok: boolean }>(token, `/branches/${id}`, { method: 'DELETE' }),
    },
    team: {
      list: () => request<TeamMember[]>(token, '/users', { method: 'GET' }),
      invite: (data: { email: string; role: string }) =>
        request<TeamInvite>(token, '/users/invite', { method: 'POST', body: JSON.stringify(data) }),
      remove: (id: string) => request<void>(token, `/users/${id}`, { method: 'DELETE' }),
      listInvites: () => request<TeamInvite[]>(token, '/users/invites', { method: 'GET' }),
      revokeInvite: (id: string) => request<void>(token, `/users/invites/${id}`, { method: 'DELETE' }),
      updateRole: (id: string, role: string) => request<TeamMember>(token, `/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    },
    importMappings: {
      list: () => request<ImportMapping[]>(token, '/import-mappings', { method: 'GET' }),
      create: (data: { name: string; mappings: ColumnMappings }) =>
        request<ImportMapping>(token, '/import-mappings', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: { name?: string; mappings?: ColumnMappings }) =>
        request<ImportMapping>(token, `/import-mappings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id: string) => request<{ ok: boolean }>(token, `/import-mappings/${id}`, { method: 'DELETE' }),
    },
    coop: {
      updateItems: (promoId: string, items: CoopItemUpdate[]) =>
        request<{ ok: boolean }>(token, `/coop/promos/${promoId}/items`, {
          method: 'POST',
          body: JSON.stringify({ items }),
        }),
      generateReport: (promoId: string) =>
        request<{ jobId: string }>(token, `/coop/promos/${promoId}/report`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),
      getItems: (promoId: string) =>
        request<Array<{ id: string; name: string; coopVendor: string | null; coopAmount: string | null; coopNote: string | null }>>(
          token,
          `/coop/promos/${promoId}/items`,
          { method: 'GET' },
        ),
      getReportAsset: (promoId: string) =>
        request<{ url: string | null; createdAt: string | null }>(
          token,
          `/coop/promos/${promoId}/report-asset`,
          { method: 'GET' },
        ),
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
    snippets: {
      list: () => request<ProductSnippet[]>(token, '/snippets', { method: 'GET' }),
      create: (data: CreateSnippetData) =>
        request<ProductSnippet>(token, '/snippets', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<CreateSnippetData>) =>
        request<ProductSnippet>(token, `/snippets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id: string) => request<{ ok: boolean }>(token, `/snippets/${id}`, { method: 'DELETE' }),
    },
    folders: {
      list: () => request<PromoFolder[]>(token, '/folders', { method: 'GET' }),
      create: (name: string) =>
        request<PromoFolder>(token, '/folders', {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),
      rename: (id: string, name: string) =>
        request<PromoFolder>(token, `/folders/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        }),
      delete: (id: string) =>
        request<void>(token, `/folders/${id}`, { method: 'DELETE' }),
    },
  }
}
