-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "ConversationMember" ADD COLUMN "pinnedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "Message" ADD COLUMN "warning" TEXT;
ALTER TABLE "Message" ADD COLUMN "spamScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Message" ADD COLUMN "meta" JSONB;

-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationMember_userId_pinnedAt_idx" ON "ConversationMember"("userId", "pinnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_createdAt_idx" ON "MessageReaction"("messageId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageReaction_userId_createdAt_idx" ON "MessageReaction"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
