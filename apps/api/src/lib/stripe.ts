import Stripe from 'stripe'
import { BillingPlan } from '@counterpromo/shared'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

/**
 * Maps a Stripe price ID to a BillingPlan enum value.
 * Reads price IDs from environment variables so they can be configured per environment.
 * Defaults to BillingPlan.Free if the priceId is not recognized.
 */
export function stripePriceToPlan(priceId: string): BillingPlan {
  const priceMap: Record<string, BillingPlan> = {}

  if (process.env.STRIPE_PRICE_STARTER_MONTHLY) {
    priceMap[process.env.STRIPE_PRICE_STARTER_MONTHLY] = BillingPlan.Starter
  }
  if (process.env.STRIPE_PRICE_PRO_MONTHLY) {
    priceMap[process.env.STRIPE_PRICE_PRO_MONTHLY] = BillingPlan.Pro
  }
  if (process.env.STRIPE_PRICE_DEALER_MONTHLY) {
    priceMap[process.env.STRIPE_PRICE_DEALER_MONTHLY] = BillingPlan.Dealer
  }

  return priceMap[priceId] ?? BillingPlan.Free
}
