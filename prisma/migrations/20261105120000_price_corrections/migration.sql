-- A price corrected by hand on the ingredient page, without changing stock.
ALTER TYPE "StockMovementType" ADD VALUE 'PRICE';
ALTER TABLE "StockMovement" ADD COLUMN "unitCostFils" DOUBLE PRECISION;
