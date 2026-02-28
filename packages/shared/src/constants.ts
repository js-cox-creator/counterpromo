import { BillingPlan } from './enums'
import type { TemplateMeta } from './types'

export const PLAN_LIMITS: Record<BillingPlan, { promosPerMonth: number; watermark: boolean }> = {
  [BillingPlan.Free]: { promosPerMonth: 1, watermark: true },
  [BillingPlan.Starter]: { promosPerMonth: 10, watermark: false },
  [BillingPlan.Pro]: { promosPerMonth: 50, watermark: false },
  [BillingPlan.Dealer]: { promosPerMonth: 100, watermark: false },
}

export const SQS_JOB_GROUP = 'counterpromo-jobs'

export const TEMPLATE_METADATA: TemplateMeta[] = [
  { id: 'classic', label: 'Classic', description: 'Clean grid layout with logo header', category: 'general' },
  { id: 'modern', label: 'Modern', description: 'Bold color stripe with product cards', category: 'general' },
  { id: 'bold', label: 'Bold', description: 'High-contrast promotional layout', category: 'general' },
  { id: 'monthly-specials', label: 'Monthly Specials', description: 'List-style flyer with price emphasis', category: 'seasonal' },
  { id: 'vendor-spotlight', label: 'Vendor Spotlight', description: '2-column layout with vendor branding', category: 'vendor' },
  { id: 'clearance', label: 'Clearance', description: 'High-impact sale layout with badges', category: 'clearance' },
]
