import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChefHat } from "lucide-react";
import { AdminPage } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { NewDishRecipeButton } from "@/components/admin/ops/recipe-forms";
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
  const [{ id }, { t }] = await Promise.all([params, getAdminI18n()]);
  const [item, categories] = await Promise.all([
    prisma.menuItem.findUnique({
      where: { id },
      include: {
        modifierGroups: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
        recipe: { select: { id: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!item) notFound();

  return (
    <AdminPage
      title={
        <span className="flex items-center gap-3">
          <Link href="/admin/menu-items" aria-label={t("Back to menu")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black-iron/[0.05]">
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </Link>
          <span dir="auto">{item.name}</span>
        </span>
      }
      actions={
        item.recipe ? (
          <Button asChild variant="outline" size="md">
            <Link href={`/admin/ops/recipes/${item.recipe.id}`}>
              <ChefHat className="h-4 w-4" /> {t("Recipe & food cost")}
            </Link>
          </Button>
        ) : (
          <NewDishRecipeButton menuItemId={item.id} />
        )
      }
    >
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
