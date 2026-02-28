-- CreateEnum
CREATE TYPE "BillingPlan" AS ENUM ('free', 'starter', 'pro', 'dealer');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'admin', 'member', 'marketing', 'branch_manager');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'expired');

-- CreateEnum
CREATE TYPE "PromoStatus" AS ENUM ('draft', 'ready', 'archived');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('parse_upload', 'brand_bootstrap', 'product_url_scrape', 'render_preview', 'render_pdf', 'render_social_image', 'export_zip', 'generate_email', 'generate_coop_report');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('preview', 'pdf', 'social_image', 'email_html', 'zip', 'social_captions', 'coop_report');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "BillingPlan" NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "stripeSubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_users" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'member',
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_kits" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "colors" JSONB NOT NULL DEFAULT '[]',
    "fonts" JSONB NOT NULL DEFAULT '[]',
    "defaultCta" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_folders" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promos" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "branchId" TEXT,
    "folderId" TEXT,
    "title" TEXT NOT NULL,
    "subhead" TEXT,
    "cta" TEXT,
    "templateId" TEXT,
    "status" "PromoStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_items" (
    "id" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "unit" TEXT,
    "category" TEXT,
    "vendor" TEXT,
    "imageUrl" TEXT,
    "sourceUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "coopVendor" TEXT,
    "coopAmount" DECIMAL(10,2),
    "coopNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "parsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "cta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_mappings" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mappings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_snippets" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "sku" TEXT,
    "unit" TEXT,
    "category" TEXT,
    "vendor" TEXT,
    "imageUrl" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "promoId" TEXT,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "errorMsg" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "branchId" TEXT,
    "type" "AssetType" NOT NULL,
    "s3Key" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_monthly" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "promosCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_stripeCustomerId_key" ON "accounts"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_stripeSubId_key" ON "accounts"("stripeSubId");

-- CreateIndex
CREATE UNIQUE INDEX "account_users_accountId_clerkId_key" ON "account_users"("accountId", "clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "account_users_accountId_email_key" ON "account_users"("accountId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invites_accountId_email_key" ON "invites"("accountId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "brand_kits_accountId_key" ON "brand_kits"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "usage_monthly_accountId_year_month_key" ON "usage_monthly"("accountId", "year", "month");

-- AddForeignKey
ALTER TABLE "account_users" ADD CONSTRAINT "account_users_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_users" ADD CONSTRAINT "account_users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_folders" ADD CONSTRAINT "promo_folders_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "promo_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_items" ADD CONSTRAINT "promo_items_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_snippets" ADD CONSTRAINT "product_snippets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_monthly" ADD CONSTRAINT "usage_monthly_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
