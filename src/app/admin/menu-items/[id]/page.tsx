import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/ui";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { ModifiersEditor } from "@/components/admin/ordering/modifiers-editor";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Edit dish") };
}

export default async function EditMenuItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, categories] = await Promise.all([
    prisma.menuItem.findUnique({
      where: { id },
      include: {
        modifierGroups: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
      },
    }),
    prisma.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!item) notFound();

  return (
    <AdminPage title={<span dir="auto">{item.name}</span>}>
      <MenuItemForm
        categories={categories}
        initial={{
          id: item.id,
          slug: item.slug,
          name: item.name,
          nameFa: item.nameFa ?? "",
          description: item.description ?? "",
          price: item.price,
          imageUrl: item.imageUrl,
          categoryId: item.categoryId,
          ingredients: item.ingredients ?? "",
          allergens: item.allergens ?? "",
          isVegetarian: item.isVegetarian,
          isAvailable: item.isAvailable,
          isActive: item.isActive,
        }}
      />
      <ModifiersEditor
        itemId={item.id}
        initial={item.modifierGroups.map((g) => ({
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options.map((o) => ({ name: o.name, price: o.price, isAvailable: o.isAvailable })),
        }))}
      />
    </AdminPage>
  );
}
