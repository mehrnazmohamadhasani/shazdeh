import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { MenuItemsTable } from "@/components/admin/menu-items-table";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MenuItemsAdminPage() {
  const [items, categories] = await Promise.all([
    prisma.menuItem.findMany({
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
      include: { category: true },
    }),
    prisma.category.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <div className="container-shazdeh py-10 md:py-14 space-y-10">
      <AdminPageHeader
        eyebrow="The kitchen"
        title="Menu items"
        description="Every dish, every price, every flag. Edit live and the public menu updates instantly."
        actions={
          <Button asChild>
            <Link href="/admin/menu-items/new">
              <Plus className="h-4 w-4" /> New dish
            </Link>
          </Button>
        }
      />
      <MenuItemsTable items={items} categories={categories} />
    </div>
  );
}
