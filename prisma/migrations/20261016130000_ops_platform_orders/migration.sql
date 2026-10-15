-- CreateEnum
CREATE TYPE "ChannelKind" AS ENUM ('DIRECT', 'PLATFORM');

-- CreateEnum
CREATE TYPE "FundedBy" AS ENUM ('UNKNOWN', 'RESTAURANT', 'PLATFORM', 'SHARED');

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ChannelKind" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelFeeRule" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "commissionPct" DOUBLE PRECISION,
    "paymentFeePct" DOUBLE PRECISION,
    "fixedFeeFils" INTEGER,
    "vatOnFees" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelFeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformOrder" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "altOrderId" TEXT,
    "businessDate" DATE NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "fulfilment" TEXT,
    "payment" TEXT,
    "foodSalesFils" INTEGER NOT NULL,
    "salesSource" TEXT NOT NULL DEFAULT 'printed',
    "subtotalFils" INTEGER,
    "deliveryFeeFils" INTEGER,
    "serviceFeeFils" INTEGER,
    "discountFils" INTEGER NOT NULL DEFAULT 0,
    "discountFundedBy" "FundedBy" NOT NULL DEFAULT 'UNKNOWN',
    "totalFils" INTEGER NOT NULL,
    "customerFirstName" TEXT,
    "note" TEXT,
    "documentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "category" TEXT,
    "menuItemId" TEXT,
    "quantity" INTEGER NOT NULL,
    "lineTotalFils" INTEGER,
    "priceFromMenu" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlatformOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemAlias" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_code_key" ON "Channel"("code");

-- CreateIndex
CREATE INDEX "ChannelFeeRule_channelId_validFrom_idx" ON "ChannelFeeRule"("channelId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformOrder_documentId_key" ON "PlatformOrder"("documentId");

-- CreateIndex
CREATE INDEX "PlatformOrder_businessDate_idx" ON "PlatformOrder"("businessDate");

-- CreateIndex
CREATE INDEX "PlatformOrder_channelId_altOrderId_idx" ON "PlatformOrder"("channelId", "altOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformOrder_channelId_orderNo_businessDate_key" ON "PlatformOrder"("channelId", "orderNo", "businessDate");

-- CreateIndex
CREATE INDEX "PlatformOrderItem_orderId_idx" ON "PlatformOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "PlatformOrderItem_menuItemId_idx" ON "PlatformOrderItem"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemAlias_channelId_rawName_key" ON "MenuItemAlias"("channelId", "rawName");

-- AddForeignKey
ALTER TABLE "ChannelFeeRule" ADD CONSTRAINT "ChannelFeeRule_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformOrder" ADD CONSTRAINT "PlatformOrder_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformOrder" ADD CONSTRAINT "PlatformOrder_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "OpsDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformOrderItem" ADD CONSTRAINT "PlatformOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PlatformOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformOrderItem" ADD CONSTRAINT "PlatformOrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemAlias" ADD CONSTRAINT "MenuItemAlias_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemAlias" ADD CONSTRAINT "MenuItemAlias_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The six channels from the brief (§5). Fee rules stay empty until the
-- owner supplies contract terms or statements: never invent a rate.
INSERT INTO "Channel" ("id", "code", "name", "kind", "order", "updatedAt") VALUES
  ('ch_direct',    'direct',    'Website / WhatsApp', 'DIRECT',   0, CURRENT_TIMESTAMP),
  ('ch_talabat',   'talabat',   'Talabat',            'PLATFORM', 1, CURRENT_TIMESTAMP),
  ('ch_careem',    'careem',    'Careem',             'PLATFORM', 2, CURRENT_TIMESTAMP),
  ('ch_deliveroo', 'deliveroo', 'Deliveroo',          'PLATFORM', 3, CURRENT_TIMESTAMP),
  ('ch_noon',      'noon',      'Noon Food',          'PLATFORM', 4, CURRENT_TIMESTAMP),
  ('ch_keeta',     'keeta',     'Keeta',              'PLATFORM', 5, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
