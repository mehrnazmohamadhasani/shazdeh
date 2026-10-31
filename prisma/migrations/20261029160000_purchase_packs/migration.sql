-- How one invoice unit is packed ("1 CTN" of 4 x 5 L), on a saved line and in the supplier's memory.
ALTER TABLE "PurchaseLine" ADD COLUMN "pack" JSONB;
ALTER TABLE "SupplierItem" ADD COLUMN "pack" JSONB;
