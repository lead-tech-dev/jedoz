-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'moderator');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'SUSPENDED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "BoostType" AS ENUM ('VIP', 'URGENT', 'TOP', 'HOME');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MTN', 'ORANGE', 'STRIPE', 'MOCK');

-- CreateEnum
CREATE TYPE "PaymentProductType" AS ENUM ('CREDIT_PACK', 'PRO_SUBSCRIPTION', 'BOOST');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CreditTxType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "MonetizationAction" AS ENUM ('PUBLISH_AD', 'RENEW_AD', 'BOOST_VIP', 'BOOST_URGENT', 'BOOST_TOP', 'BOOST_HOME', 'PRO_SUBSCRIBE');

-- CreateEnum
CREATE TYPE "ProPlan" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('UPLOADED', 'PROCESSED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "BlacklistType" AS ENUM ('IP', 'PHONE', 'DEVICE');

-- CreateEnum
CREATE TYPE "ModerationCaseStatus" AS ENUM ('OPEN', 'CLOSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('APPROVE', 'REJECT', 'ESCALATE');

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "productType" "PaymentProductType" NOT NULL,
    "productRefId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "providerRef" TEXT,
    "providerData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "gradient" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "extraFields" JSONB NOT NULL DEFAULT '[]',
    "parentId" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormStep" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "info" JSONB,
    "flow" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT,
    "unit" TEXT,
    "info" JSONB,
    "values" JSONB,
    "rules" JSONB,
    "modal_for_info" JSONB,
    "modals_for_info" JSONB,
    "default_checked" BOOLEAN NOT NULL DEFAULT false,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "status" "AdStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dynamic" JSONB NOT NULL DEFAULT '{}',
    "moderation" JSONB,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdBoost" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "BoostType" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdMedia" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "reporterId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "CreditTxType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "ProPlan" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProOffer" (
    "id" TEXT NOT NULL,
    "plan" "ProPlan" NOT NULL,
    "name" TEXT NOT NULL,
    "creditsCost" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "country" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "action" "MonetizationAction" NOT NULL,
    "creditsCost" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "country" TEXT,
    "categorySlug" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaRule" (
    "id" TEXT NOT NULL,
    "action" "MonetizationAction" NOT NULL,
    "maxPerDay" INTEGER NOT NULL,
    "country" TEXT,
    "categorySlug" TEXT,
    "role" "UserRole",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotaRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adId" TEXT,
    "type" "MediaType" NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "mediumUrl" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blacklist" (
    "id" TEXT NOT NULL,
    "type" "BlacklistType" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "ipFirst" TEXT,
    "ipLast" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSecurity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isShadowBanned" BOOLEAN NOT NULL DEFAULT false,
    "shadowReason" TEXT,
    "shadowedAt" TIMESTAMP(3),

    CONSTRAINT "UserSecurity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdFingerprint" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fpText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationRule" (
    "id" TEXT NOT NULL,
    "country" TEXT,
    "categorySlug" TEXT,
    "name" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regexes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weight" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationCase" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "country" TEXT,
    "categorySlug" TEXT,
    "score" INTEGER NOT NULL,
    "status" "ModerationCaseStatus" NOT NULL DEFAULT 'OPEN',
    "reasons" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationDecision" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_providerRef_key" ON "PaymentIntent"("providerRef");

-- CreateIndex
CREATE INDEX "PaymentEvent_intentId_idx" ON "PaymentEvent"("intentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_eventId_key" ON "PaymentEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "AdBoost_adId_type_idx" ON "AdBoost"("adId", "type");

-- CreateIndex
CREATE INDEX "AdBoost_userId_createdAt_idx" ON "AdBoost"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdBoost_endAt_idx" ON "AdBoost"("endAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditWallet_userId_key" ON "CreditWallet"("userId");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditPack_isActive_position_idx" ON "CreditPack"("isActive", "position");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "Subscription_endAt_idx" ON "Subscription"("endAt");

-- CreateIndex
CREATE INDEX "ProOffer_isActive_position_idx" ON "ProOffer"("isActive", "position");

-- CreateIndex
CREATE INDEX "ProOffer_country_idx" ON "ProOffer"("country");

-- CreateIndex
CREATE INDEX "PricingRule_action_isActive_priority_idx" ON "PricingRule"("action", "isActive", "priority");

-- CreateIndex
CREATE INDEX "PricingRule_country_categorySlug_idx" ON "PricingRule"("country", "categorySlug");

-- CreateIndex
CREATE INDEX "QuotaRule_action_isActive_priority_idx" ON "QuotaRule"("action", "isActive", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Media_key_key" ON "Media"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Blacklist_type_value_key" ON "Blacklist"("type", "value");

-- CreateIndex
CREATE INDEX "UserDevice_deviceId_idx" ON "UserDevice"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDevice_userId_deviceId_key" ON "UserDevice"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSecurity_userId_key" ON "UserSecurity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdFingerprint_adId_key" ON "AdFingerprint"("adId");

-- CreateIndex
CREATE INDEX "AdFingerprint_userId_idx" ON "AdFingerprint"("userId");

-- CreateIndex
CREATE INDEX "AdFingerprint_fpText_idx" ON "AdFingerprint"("fpText");

-- CreateIndex
CREATE INDEX "ModerationRule_country_idx" ON "ModerationRule"("country");

-- CreateIndex
CREATE INDEX "ModerationRule_categorySlug_idx" ON "ModerationRule"("categorySlug");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationCase_adId_key" ON "ModerationCase"("adId");

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormStep" ADD CONSTRAINT "FormStep_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "FormStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdBoost" ADD CONSTRAINT "AdBoost_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdBoost" ADD CONSTRAINT "AdBoost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMedia" ADD CONSTRAINT "AdMedia_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
