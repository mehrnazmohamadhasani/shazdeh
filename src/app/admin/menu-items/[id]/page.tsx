import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPage } from "@/components/admin/ui";
import { DishRecipeStep } from "@/components/admin/ops/dish-recipe-step";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { ModifiersEditor } from "@/components/admin/ordering/modifiers-editor";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { dishRecipeSummary } from "@/lib/ops/recipes";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Edit dish") };
}

export default async function EditMenuItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const [{ id }, { added }, { t }] = await Promise.all([params, searchParams, getAdminI18n()]);
  const [item, categories, recipe] = await Promise.all([
    prisma.menuItem.findUnique({
      where: { id },
      include: {
        modifierGroups: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
      },
    }),
    prisma.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
    dishRecipeSummary(id),
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
    >
      {/* The dish's recipe (or the step to add one) first: right after creating a dish it is the next thing to do. */}
      <DishRecipeStep menuItemId={item.id} dishName={item.name} recipe={recipe} justAdded={!!added && !recipe} />
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
