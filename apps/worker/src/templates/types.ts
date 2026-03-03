export interface TemplatePromoData {
  promo: {
    id: string
    title: string
    subhead: string | null
    cta: string | null
  }
  items: Array<{
    name: string
    /** Formatted sale price e.g. "$12.99" */
    price: string
    /** Whole dollars of sale price e.g. "12" */
    priceWhole: string
    /** Cents of sale price e.g. "99" */
    priceCents: string
    /** Formatted RRP/MSRP e.g. "$19.99" — null if no RRP set */
    rrp: string | null
    /** Whole dollars of RRP e.g. "19" — null if no RRP */
    rrpWhole: string | null
    /** Cents of RRP e.g. "99" — null if no RRP */
    rrpCents: string | null
    /** Discount percentage as a string e.g. "35" (no % sign) — null if no RRP */
    discountPercent: string | null
    /** True when an RRP is set and is greater than the sale price */
    hasRrp: boolean
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
    /** Strapline / tagline from branding page */
    strapline: string | null
    /** Website URL from branding page */
    websiteUrl: string | null
    /** AI-generated business description from branding page */
    aiDescription: string | null
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
