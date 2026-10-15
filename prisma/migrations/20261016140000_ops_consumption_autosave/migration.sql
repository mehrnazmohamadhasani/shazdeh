-- AlterTable
ALTER TABLE "OpsDocument" ADD COLUMN     "autoSaved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OpsSettings" ADD COLUMN     "autoSaveInvoices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoSaveMinConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
ADD COLUMN     "autoSavePlatform" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "menuItemId" TEXT,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "platformOrderId" TEXT,
ADD COLUMN     "recipeVersionId" TEXT;

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- CreateIndex
CREATE INDEX "StockMovement_platformOrderId_idx" ON "StockMovement"("platformOrderId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_platformOrderId_fkey" FOREIGN KEY ("platformOrderId") REFERENCES "PlatformOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
