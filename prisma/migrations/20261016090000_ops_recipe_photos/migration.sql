-- AlterTable
ALTER TABLE "RecipeVersion" ADD COLUMN     "method" TEXT,
ADD COLUMN     "sourceDocumentId" TEXT;

-- CreateTable
CREATE TABLE "RecipeNameAlias" (
    "id" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "ingredientId" TEXT,
    "recipeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeNameAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeNameAlias_rawName_key" ON "RecipeNameAlias"("rawName");

-- CreateIndex
CREATE INDEX "OpsDocument_kind_status_idx" ON "OpsDocument"("kind", "status");

-- CreateIndex
CREATE INDEX "RecipeVersion_sourceDocumentId_idx" ON "RecipeVersion"("sourceDocumentId");

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "OpsDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeNameAlias" ADD CONSTRAINT "RecipeNameAlias_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeNameAlias" ADD CONSTRAINT "RecipeNameAlias_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- An alias points at exactly one ingredient or one recipe.
ALTER TABLE "RecipeNameAlias" ADD CONSTRAINT "RecipeNameAlias_one_target_check"
  CHECK (("ingredientId" IS NULL) <> ("recipeId" IS NULL));
