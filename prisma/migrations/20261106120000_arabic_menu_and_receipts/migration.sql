-- Arabic dish details (shown with the English) and the Arabic dish name
-- kept on each order line for the bilingual tax invoice. All optional.
ALTER TABLE "MenuItem" ADD COLUMN "nameAr" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "descriptionAr" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "ingredientsAr" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "allergensAr" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "nameAr" TEXT;
