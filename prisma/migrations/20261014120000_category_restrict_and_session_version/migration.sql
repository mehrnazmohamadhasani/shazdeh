-- F-06: deleting a category must never delete its dishes.
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_categoryId_fkey";
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- F-07: changing a password signs the user out on every device.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- F-16: store emails in lower case (sign-in already ignores case). Skipped
-- for any address whose lower-case form is already taken.
UPDATE "User" u
SET "email" = lower(u."email")
WHERE u."email" <> lower(u."email")
  AND NOT EXISTS (SELECT 1 FROM "User" o WHERE o."email" = lower(u."email"));
