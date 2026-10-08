import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPage } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { MenuItemsTable } from "@/components/admin/menu-items-table";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu" };

export default async function MenuItemsAdminPage() {
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
      title="Menu"
      description="Changes appear on the website straight away."
      actions={
        <Button asChild size="sm">
          <Link href="/admin/menu-items/new">
            <Plus className="h-4 w-4" /> New dish
          </Link>
        </Button>
      }
    >
      <MenuItemsTable items={items} categories={categories} />
    </AdminPage>
  );
}
