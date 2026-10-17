-- CreateEnum
CREATE TYPE "FreeFoodKind" AS ENUM ('STAFF_MEAL', 'GIFT', 'TASTING', 'COMPENSATION');

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'GIFT';

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "freeFoodId" TEXT;

-- CreateTable
CREATE TABLE "FreeFood" (
    "id" TEXT NOT NULL,
    "kind" "FreeFoodKind" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "recipient" TEXT,
    "reason" TEXT,
    "costFils" INTEGER,
    "menuValueFils" INTEGER NOT NULL,
    "via" TEXT NOT NULL DEFAULT 'manual',
    "sourceDocumentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "FreeFood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreeFoodItem" (
    "id" TEXT NOT NULL,
    "freeFoodId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostFils" INTEGER,
    "menuPriceFils" INTEGER NOT NULL,

    CONSTRAINT "FreeFoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FreeFood_at_idx" ON "FreeFood"("at");

-- CreateIndex
CREATE INDEX "FreeFood_kind_at_idx" ON "FreeFood"("kind", "at");

-- CreateIndex
CREATE INDEX "FreeFoodItem_freeFoodId_idx" ON "FreeFoodItem"("freeFoodId");

-- CreateIndex
CREATE INDEX "StockMovement_freeFoodId_idx" ON "StockMovement"("freeFoodId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_freeFoodId_fkey" FOREIGN KEY ("freeFoodId") REFERENCES "FreeFood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeFoodItem" ADD CONSTRAINT "FreeFoodItem_freeFoodId_fkey" FOREIGN KEY ("freeFoodId") REFERENCES "FreeFood"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeFoodItem" ADD CONSTRAINT "FreeFoodItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

