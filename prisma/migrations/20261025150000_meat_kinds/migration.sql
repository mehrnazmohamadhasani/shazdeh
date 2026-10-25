-- Kinds of meat: only a label on raw-meat ingredients (lamb, beef, chicken,
-- lamb shank), set from the invoice reading and editable. Additive only.

-- CreateTable
CREATE TABLE "MeatType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameFa" TEXT,
    "countPieces" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeatType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeatType_name_key" ON "MeatType"("name");

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "meatTypeId" TEXT;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_meatTypeId_fkey" FOREIGN KEY ("meatTypeId") REFERENCES "MeatType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The four kinds the kitchen buys; lamb shank is counted in pieces.
INSERT INTO "MeatType" ("id", "name", "nameFa", "countPieces", "order", "isActive", "updatedAt") VALUES
    ('meat_lamb', 'Lamb', 'گوشت گوسفندی', false, 1, true, CURRENT_TIMESTAMP),
    ('meat_beef', 'Beef', 'گوشت گوساله', false, 2, true, CURRENT_TIMESTAMP),
    ('meat_chicken', 'Chicken', 'مرغ', false, 3, true, CURRENT_TIMESTAMP),
    ('meat_lamb_shank', 'Lamb shank (pieces)', 'ماهیچه (عدد)', true, 4, true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
