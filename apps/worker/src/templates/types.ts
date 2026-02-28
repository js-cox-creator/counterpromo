export interface TemplatePromoData {
  promo: {
    id: string
    title: string
    subhead: string | null
    cta: string | null
  }
  items: Array<{
    name: string
    price: string
    sku: string | null
    unit: string | null
    category: string | null
    vendor: string | null
    imageUrl: string | null
  }>
  brand: {
    logoUrl: string | null
    primaryColor: string
    secondaryColor: string
    name: string
  }
  branch?: {
    name: string
    address: string | null
    phone: string | null
    email: string | null
    cta: string | null
  }
  watermark: boolean
}

export type TemplateCategory = 'general' | 'seasonal' | 'vendor' | 'clearance'

export interface TemplateDefinition {
  id: string
  name: string
  description: string
  previewBgColor: string
  category: TemplateCategory
}
