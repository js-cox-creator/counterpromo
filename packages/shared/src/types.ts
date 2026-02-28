import { JobType, AssetType, BillingPlan } from './enums'

// ---- Template metadata ----

export type TemplateCategory = 'general' | 'seasonal' | 'vendor' | 'clearance'

export interface TemplateMeta {
  id: string
  label: string
  description: string
  category: TemplateCategory
}

// ---- Job Payloads (SQS message bodies) ----

export interface ParseUploadPayload {
  type: JobType.ParseUpload
  jobId: string
  accountId: string
  promoId: string
  uploadId: string
  s3Key: string
  mappingId?: string
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
  branchId?: string
  branchName?: string
}

export interface RenderPdfPayload {
  type: JobType.RenderPdf
  jobId: string
  accountId: string
  promoId: string
  watermark: boolean
  branchId?: string
  branchName?: string
}

export interface RenderSocialImagePayload {
  type: JobType.RenderSocialImage
  jobId: string
  accountId: string
  promoId: string
  watermark: boolean
  branchId?: string
  branchName?: string
}

export interface ExportZipPayload {
  type: JobType.ExportZip
  jobId: string
  accountId: string
  promoId: string
}

export interface GenerateEmailPayload {
  type: JobType.GenerateEmail
  jobId: string
  accountId: string
  promoId: string
  branchId?: string
  branchName?: string
}

export interface GenerateCoopReportPayload {
  type: JobType.GenerateCoopReport
  jobId: string
  accountId: string
  promoId: string
}

export type JobPayload =
  | ParseUploadPayload
  | BrandBootstrapPayload
  | ProductUrlScrapePayload
  | RenderPreviewPayload
  | RenderPdfPayload
  | RenderSocialImagePayload
  | ExportZipPayload
  | GenerateEmailPayload
  | GenerateCoopReportPayload

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
