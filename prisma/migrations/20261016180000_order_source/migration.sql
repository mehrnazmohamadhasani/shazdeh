-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('WEBSITE', 'WHATSAPP', 'PHONE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "enteredById" TEXT,
ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'WEBSITE';

-- CreateIndex
CREATE INDEX "Order_source_placedAt_idx" ON "Order"("source", "placedAt");

