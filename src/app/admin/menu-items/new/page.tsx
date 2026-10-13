import { redirect } from "next/navigation";
import { AdminPage } from "@/components/admin/ui";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("New dish") };
}

export default async function NewMenuItemPage() {
  const { t } = await getAdminI18n();
  const categories = await prisma.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });
  if (categories.length === 0) redirect("/admin/categories");

  return (
    <AdminPage title={t("New dish")}>
      <MenuItemForm categories={categories} />
    </AdminPage>
  );
}
