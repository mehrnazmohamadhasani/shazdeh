import { AdminPage } from "@/components/admin/ui";
import { CategoriesManager } from "@/components/admin/categories-manager";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Categories") };
}

export default async function CategoriesAdminPage() {
  const { t } = await getAdminI18n();
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true, order: true, isActive: true, _count: { select: { items: true } } },
  });

  return (
    <AdminPage title={t("Categories")} description={t("The sections of your menu, in the order customers see them.")}>
      <CategoriesManager initial={categories} />
    </AdminPage>
  );
}
