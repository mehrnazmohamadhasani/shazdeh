-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PURCHASER';

-- AlterTable
ALTER TABLE "PurchaseLine" ADD COLUMN     "grossFils" INTEGER;

-- CreateTable
CREATE TABLE "OpsSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "foodCostIncludesVat" BOOLEAN NOT NULL DEFAULT false,
    "aiMonthlyCapUsd" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "aiWarnedMonth" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashWithdrawal" (
    "id" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "amountFils" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costMicroUsd" INTEGER NOT NULL,
    "documentId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashWithdrawal_person_at_idx" ON "CashWithdrawal"("person", "at");

-- CreateIndex
CREATE INDEX "AiUsage_at_idx" ON "AiUsage"("at");

-- Backfill: each saved line's cost with its share of the invoice's VAT.
-- factor = what was paid ÷ the lines' net cost; a factor outside 1–1.06
-- means the printed totals don't add up, so fall back to 5 % when the
-- invoice shows VAT and to no VAT otherwise.
UPDATE "PurchaseLine" pl
SET "grossFils" = ROUND(pl."netFils" * f.factor)
FROM (
  SELECT i."id",
    CASE
      WHEN s.net > 0 AND i."totalFils"::float / s.net BETWEEN 1 AND 1.06 THEN i."totalFils"::float / s.net
      WHEN COALESCE(i."vatFils", 0) > 0 OR i."pricesIncludeVat" THEN 1.05
      ELSE 1
    END AS factor
  FROM "PurchaseInvoice" i
  JOIN (SELECT "invoiceId", SUM("netFils") AS net FROM "PurchaseLine" GROUP BY "invoiceId") s ON s."invoiceId" = i."id"
) f
WHERE pl."invoiceId" = f."id" AND pl."netFils" IS NOT NULL;

-- Backfill: AI readings so far, priced like gpt-5-mini ($0.25 / $2.00 per million tokens).
INSERT INTO "AiUsage" ("id", "kind", "model", "inputTokens", "outputTokens", "costMicroUsd", "documentId", "at")
SELECT 'bf_' || d."id",
  CASE WHEN d."kind" = 'recipe' THEN 'recipe' ELSE 'invoice' END,
  COALESCE(d."aiModel", 'unknown'),
  d."aiInputTokens",
  COALESCE(d."aiOutputTokens", 0),
  ROUND(d."aiInputTokens" * 0.25 + COALESCE(d."aiOutputTokens", 0) * 2.0),
  d."id",
  d."updatedAt"
FROM "OpsDocument" d
WHERE d."aiInputTokens" IS NOT NULL;
