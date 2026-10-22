-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "buttonLabel" TEXT,
    "buttonUrl" TEXT,
    "promoCode" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'marketing',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "recipientCount" INTEGER,
    "broadcastId" TEXT,
    "error" TEXT,
    "createdBy" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingUnsubscribe" (
    "email" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingUnsubscribe_pkey" PRIMARY KEY ("email")
);
