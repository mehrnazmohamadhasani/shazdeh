import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit dish" };

export default async function EditMenuItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [item, categories] = await Promise.all([
    prisma.menuItem.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { order: "asc" } }),
  ]);
  if (!item) notFound();

  return (
    <div className="container-shazdeh py-10 md:py-14 space-y-10">
      <AdminPageHeader
        eyebrow="Edit dish"
        title={item.name}
        description={`Slug: ${item.slug}`}
      />
      <MenuItemForm
        categories={categories}
        initial={{
          id: item.id,
          slug: item.slug,
          name: item.name,
          nameFa: item.nameFa ?? "",
          description: item.description ?? "",
          story: item.story ?? "",
          price: item.price,
          currency: item.currency,
          imageUrl: item.imageUrl,
          categoryId: item.categoryId,
          ingredients: item.ingredients ?? "",
          allergens: item.allergens ?? "",
          spicyLevel: item.spicyLevel,
          isVegetarian: item.isVegetarian,
          isAvailable: item.isAvailable,
          isBestseller: item.isBestseller,
          isNew: item.isNew,
          isSignature: item.isSignature,
          order: item.order,
        }}
      />
    </div>
  );
}
