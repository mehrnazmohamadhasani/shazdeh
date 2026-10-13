-- CreateEnum
CREATE TYPE "OpsDocumentStatus" AS ENUM ('PROCESSING', 'NEEDS_REVIEW', 'SAVED', 'FAILED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "SpendCategory" AS ENUM ('FOOD', 'PACKAGING', 'SMALLWARES', 'DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "StockUnit" AS ENUM ('G', 'ML', 'PCS');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'CONSUMPTION', 'WASTE', 'STAFF_MEAL', 'ADJUSTMENT', 'COUNT');

-- CreateTable
CREATE TABLE "OpsDocument" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'supplier_invoice',
    "status" "OpsDocumentStatus" NOT NULL DEFAULT 'PROCESSING',
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "originalName" TEXT,
    "extraction" JSONB,
    "aiModel" TEXT,
    "aiInputTokens" INTEGER,
    "aiOutputTokens" INTEGER,
    "error" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trn" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameFa" TEXT,
    "unit" "StockUnit" NOT NULL,
    "category" "SpendCategory" NOT NULL DEFAULT 'FOOD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierItem" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "baseQtyPerUnit" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoice" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "supplierId" TEXT NOT NULL,
    "invoiceNo" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "paymentMode" TEXT,
    "pricesIncludeVat" BOOLEAN NOT NULL DEFAULT false,
    "subtotalFils" INTEGER,
    "discountFils" INTEGER NOT NULL DEFAULT 0,
    "vatFils" INTEGER,
    "totalFils" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "itemCode" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "unitPriceFils" INTEGER,
    "lineTotalFils" INTEGER NOT NULL,
    "category" "SpendCategory" NOT NULL,
    "ingredientId" TEXT,
    "baseQty" DOUBLE PRECISION,

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "costFils" INTEGER,
    "at" TIMESTAMP(3) NOT NULL,
    "purchaseLineId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "via" TEXT NOT NULL DEFAULT 'manual',
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpsDocument_sha256_key" ON "OpsDocument"("sha256");

-- CreateIndex
CREATE INDEX "OpsDocument_status_createdAt_idx" ON "OpsDocument"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_trn_idx" ON "Supplier"("trn");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierItem_supplierId_rawName_key" ON "SupplierItem"("supplierId", "rawName");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_documentId_key" ON "PurchaseInvoice"("documentId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_invoiceDate_idx" ON "PurchaseInvoice"("invoiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_supplierId_invoiceNo_key" ON "PurchaseInvoice"("supplierId", "invoiceNo");

-- CreateIndex
CREATE INDEX "PurchaseLine_invoiceId_idx" ON "PurchaseLine"("invoiceId");

-- CreateIndex
CREATE INDEX "PurchaseLine_ingredientId_idx" ON "PurchaseLine"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_purchaseLineId_key" ON "StockMovement"("purchaseLineId");

-- CreateIndex
CREATE INDEX "StockMovement_ingredientId_at_idx" ON "StockMovement"("ingredientId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "OpsDocument" ADD CONSTRAINT "OpsDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "OpsDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseLineId_fkey" FOREIGN KEY ("purchaseLineId") REFERENCES "PurchaseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
