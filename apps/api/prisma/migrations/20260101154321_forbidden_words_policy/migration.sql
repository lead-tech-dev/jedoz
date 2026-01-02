-- AlterTable
ALTER TABLE "UserSecurity" ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "forbiddenStrikeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastForbiddenAt" TIMESTAMP(3);
