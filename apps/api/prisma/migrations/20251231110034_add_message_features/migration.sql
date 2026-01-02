-- DropIndex
DROP INDEX "Ad_lat_lng_idx";

-- DropIndex
DROP INDEX "Ad_price_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allowCalls" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowMessages" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "notificationsEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notificationsPush" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notificationsSms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showPhone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telegram" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "whatsapp" TEXT;
