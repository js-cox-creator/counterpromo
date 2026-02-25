import { JobType, AssetType, BillingPlan } from './enums'

// ---- Job Payloads (SQS message bodies) ----

export interface ParseUploadPayload {
  type: JobType.ParseUpload
  jobId: string
  accountId: string
  promoId: string
  uploadId: string
  s3Key: string
}

export interface BrandBootstrapPayload {
  type: JobType.BrandBootstrap
  jobId: string
  accountId: string
  url: string
}

export interface ProductUrlScrapePayload {
  type: JobType.ProductUrlScrape
  jobId: string
  accountId: string
  promoId: string
  itemId: string
  url: string
}

export interface RenderPreviewPayload {
  type: JobType.RenderPreview
  jobId: string
  accountId: string
  promoId: string
}

export interface RenderPdfPayload {
  type: JobType.RenderPdf
  jobId: string
  accountId: string
  promoId: string
  watermark: boolean
}

export type JobPayload =
  | ParseUploadPayload
  | BrandBootstrapPayload
  | ProductUrlScrapePayload
  | RenderPreviewPayload
  | RenderPdfPayload

// ---- API Response shapes ----

export interface UsageSummary {
  plan: BillingPlan
  promosUsed: number
  promosLimit: number
  periodStart: string
  periodEnd: string
}

export interface AssetUrl {
  type: AssetType
  url: string
  expiresAt: string
}
