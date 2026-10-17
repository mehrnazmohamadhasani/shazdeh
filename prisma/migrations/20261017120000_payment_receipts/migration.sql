-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "paidPersonally" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentReceiptId" TEXT,
ADD COLUMN     "paymentReceiptKind" TEXT;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_paymentReceiptId_fkey" FOREIGN KEY ("paymentReceiptId") REFERENCES "OpsDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Owner cash counted cash and card invoices with a "Paid by" name as paid
-- by that person; mark them so balances stay the same.
UPDATE "PurchaseInvoice" SET "paidPersonally" = true
WHERE "paidBy" IS NOT NULL AND "paymentMode" IN ('cash', 'card');
