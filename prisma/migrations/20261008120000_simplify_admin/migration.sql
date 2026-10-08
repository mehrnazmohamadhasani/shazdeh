-- DropForeignKey
ALTER TABLE "ItemVariant" DROP CONSTRAINT "ItemVariant_itemId_fkey";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "description",
DROP COLUMN "imageUrl",
DROP COLUMN "tagline";

-- AlterTable
ALTER TABLE "DeliveryArea" DROP COLUMN "isActive",
DROP COLUMN "order";

-- AlterTable
ALTER TABLE "DeliveryZone" DROP COLUMN "description";

-- AlterTable
ALTER TABLE "MenuItem" DROP COLUMN "currency",
DROP COLUMN "story";

-- AlterTable
ALTER TABLE "OrderingSettings" DROP COLUMN "cutleryDefault",
DROP COLUMN "prepMinutes",
DROP COLUMN "timezone";

-- AlterTable
ALTER TABLE "RestaurantSettings" DROP COLUMN "faviconUrl",
DROP COLUMN "heroVideoUrl",
DROP COLUMN "mapUrl",
DROP COLUMN "tagline";

-- AlterTable
ALTER TABLE "SocialLink" DROP COLUMN "icon";

-- DropTable
DROP TABLE "Banner";

-- DropTable
DROP TABLE "ItemVariant";

-- DropTable
DROP TABLE "Session";


-- AlterTable
ALTER TABLE "GalleryImage" DROP COLUMN "caption",
DROP COLUMN "isActive",
DROP COLUMN "title";

-- AlterTable
ALTER TABLE "MenuItem" DROP COLUMN "isBestseller",
DROP COLUMN "isNew",
DROP COLUMN "isSignature",
DROP COLUMN "spicyLevel";
