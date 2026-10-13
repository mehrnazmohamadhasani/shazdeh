-- DropIndex
DROP INDEX "PurchaseInvoice_supplierId_invoiceNo_key";

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "deliveryDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "leadTimeDays" INTEGER,
ADD COLUMN     "paymentTermsDays" INTEGER;

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidBy" TEXT,
ADD COLUMN     "paymentNote" TEXT,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedDocumentId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseLine" ADD COLUMN     "discountFils" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "netFils" INTEGER,
ADD COLUMN     "vatFils" INTEGER;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "reversesId" TEXT;

-- CreateIndex
CREATE INDEX "PurchaseInvoice_supplierId_invoiceNo_idx" ON "PurchaseInvoice"("supplierId", "invoiceNo");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_paymentMode_paidAt_idx" ON "PurchaseInvoice"("paymentMode", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_reversesId_key" ON "StockMovement"("reversesId");

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_voidedDocumentId_fkey" FOREIGN KEY ("voidedDocumentId") REFERENCES "OpsDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "StockMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
