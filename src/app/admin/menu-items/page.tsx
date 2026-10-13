import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPage } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { MenuItemsTable } from "@/components/admin/menu-items-table";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Menu") };
}

export default async function MenuItemsAdminPage() {
  const { t } = await getAdminI18n();
  const [items, categories] = await Promise.all([
    prisma.menuItem.findMany({
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
      select: {
        id: true,
        name: true,
        imageUrl: true,
        price: true,
        isAvailable: true,
        isActive: true,
        order: true,
        category: { select: { id: true, name: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <AdminPage
      title={t("Menu")}
      description={t("Changes appear on the website straight away.")}
      actions={
        <Button asChild size="sm">
          <Link href="/admin/menu-items/new">
            <Plus className="h-4 w-4" /> {t("New dish")}
          </Link>
        </Button>
      }
    >
      <MenuItemsTable items={items} categories={categories} />
    </AdminPage>
  );
}
