export enum BillingPlan {
  Free = 'free',
  Starter = 'starter',
  Pro = 'pro',
  Dealer = 'dealer',
}

export enum UserRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
  Marketing = 'marketing',
  BranchManager = 'branch_manager',
}

export enum JobType {
  ParseUpload = 'parse_upload',
  BrandBootstrap = 'brand_bootstrap',
  ProductUrlScrape = 'product_url_scrape',
  RenderPreview = 'render_preview',
  RenderPdf = 'render_pdf',
  RenderSocialImage = 'render_social_image', // Phase 2
  ExportZip = 'export_zip', // Phase 2
  GenerateEmail = 'generate_email',
  GenerateCoopReport = 'generate_coop_report',
}

export enum JobStatus {
  Pending = 'pending',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
}

export enum AssetType {
  Preview = 'preview',
  Pdf = 'pdf',
  SocialImage = 'social_image', // Phase 2
  EmailHtml = 'email_html',     // Phase 2
  Zip = 'zip',
  SocialCaptions = 'social_captions',
  CoopReport = 'coop_report',
}

export enum PromoStatus {
  Draft = 'draft',
  Ready = 'ready',
  Archived = 'archived',
}

export enum InviteStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Expired = 'expired',
}
