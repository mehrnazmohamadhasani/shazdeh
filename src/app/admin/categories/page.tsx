import { AdminPage } from "@/components/admin/ui";
import { CategoriesManager } from "@/components/admin/categories-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories" };

export default async function CategoriesAdminPage() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true, order: true, isActive: true, _count: { select: { items: true } } },
  });

  return (
    <AdminPage title="Categories" description="The sections of your menu, in the order customers see them.">
      <CategoriesManager initial={categories} />
    </AdminPage>
  );
}
