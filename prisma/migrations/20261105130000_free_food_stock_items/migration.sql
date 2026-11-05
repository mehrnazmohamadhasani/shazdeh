-- Free food can include stock items as they are (bread, drinks), by amount.
ALTER TABLE "FreeFoodItem" ADD COLUMN "ingredientId" TEXT;
ALTER TABLE "FreeFoodItem" ADD COLUMN "amount" DOUBLE PRECISION;
ALTER TABLE "FreeFoodItem" ADD CONSTRAINT "FreeFoodItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
