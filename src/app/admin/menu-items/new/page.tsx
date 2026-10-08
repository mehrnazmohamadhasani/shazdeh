import { redirect } from "next/navigation";
import { AdminPage } from "@/components/admin/ui";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "New dish" };

export default async function NewMenuItemPage() {
  const categories = await prisma.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });
  if (categories.length === 0) redirect("/admin/categories");

  return (
    <AdminPage title="New dish">
      <MenuItemForm categories={categories} />
    </AdminPage>
  );
}
