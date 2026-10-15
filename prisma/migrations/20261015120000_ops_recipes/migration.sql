-- CreateEnum
CREATE TYPE "RecipeKind" AS ENUM ('DISH', 'PREP');

-- CreateEnum
CREATE TYPE "RecipeVersionStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "kind" "RecipeKind" NOT NULL,
    "name" TEXT NOT NULL,
    "nameFa" TEXT,
    "menuItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVersion" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "RecipeVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "yieldQuantity" DOUBLE PRECISION NOT NULL,
    "yieldUnit" "StockUnit" NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeLine" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "ingredientId" TEXT,
    "subRecipeId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "wastePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "RecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_name_key" ON "Recipe"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_menuItemId_key" ON "Recipe"("menuItemId");

-- CreateIndex
CREATE INDEX "RecipeVersion_recipeId_status_idx" ON "RecipeVersion"("recipeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersion_recipeId_number_key" ON "RecipeVersion"("recipeId", "number");

-- CreateIndex
CREATE INDEX "RecipeLine_versionId_idx" ON "RecipeLine"("versionId");

-- CreateIndex
CREATE INDEX "RecipeLine_ingredientId_idx" ON "RecipeLine"("ingredientId");

-- CreateIndex
CREATE INDEX "RecipeLine_subRecipeId_idx" ON "RecipeLine"("subRecipeId");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_subRecipeId_fkey" FOREIGN KEY ("subRecipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A line uses exactly one ingredient or one sub-recipe.
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_one_source_check"
  CHECK (("ingredientId" IS NULL) <> ("subRecipeId" IS NULL));
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_amounts_check"
  CHECK ("quantity" > 0 AND "wastePct" >= 0 AND "wastePct" < 100);
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_yield_check"
  CHECK ("yieldQuantity" > 0);
