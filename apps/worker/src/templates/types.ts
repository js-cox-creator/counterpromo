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
  watermark: boolean
}

export interface TemplateDefinition {
  id: string
  name: string
  description: string
  previewBgColor: string
}
