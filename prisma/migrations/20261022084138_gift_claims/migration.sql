-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isGift" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scanCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "GiftClaim" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL,
    "emailStatus" TEXT NOT NULL DEFAULT 'pending',
    "activatedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftClaim_token_key" ON "GiftClaim"("token");

-- CreateIndex
CREATE UNIQUE INDEX "GiftClaim_orderId_key" ON "GiftClaim"("orderId");

-- CreateIndex
CREATE INDEX "GiftClaim_phone_idx" ON "GiftClaim"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "GiftClaim_couponId_phone_key" ON "GiftClaim"("couponId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "GiftClaim_couponId_email_key" ON "GiftClaim"("couponId", "email");

-- AddForeignKey
ALTER TABLE "GiftClaim" ADD CONSTRAINT "GiftClaim_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftClaim" ADD CONSTRAINT "GiftClaim_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
