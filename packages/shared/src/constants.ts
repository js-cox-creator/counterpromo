import { BillingPlan } from './enums'

export const PLAN_LIMITS: Record<BillingPlan, { promosPerMonth: number; watermark: boolean }> = {
  [BillingPlan.Free]: { promosPerMonth: 1, watermark: true },
  [BillingPlan.Starter]: { promosPerMonth: 10, watermark: false },
  [BillingPlan.Pro]: { promosPerMonth: 50, watermark: false },
  [BillingPlan.Dealer]: { promosPerMonth: 100, watermark: false },
}

export const SQS_JOB_GROUP = 'counterpromo-jobs'
