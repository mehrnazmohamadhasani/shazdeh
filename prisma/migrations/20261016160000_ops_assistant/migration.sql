-- CreateEnum
CREATE TYPE "AssistantActionStatus" AS ENUM ('PROPOSED', 'APPLIED', 'CANCELLED', 'UNDONE');

-- CreateTable
CREATE TABLE "AssistantAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tool" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "status" "AssistantActionStatus" NOT NULL DEFAULT 'PROPOSED',
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "input" JSONB NOT NULL,
    "preview" JSONB NOT NULL,
    "result" JSONB,
    "sourceDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "AssistantAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantAction_userId_createdAt_idx" ON "AssistantAction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantAction_sourceDocumentId_idx" ON "AssistantAction"("sourceDocumentId");

-- AddForeignKey
ALTER TABLE "AssistantAction" ADD CONSTRAINT "AssistantAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantAction" ADD CONSTRAINT "AssistantAction_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "OpsDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

