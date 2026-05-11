import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "New dish" };

export default async function NewMenuItemPage() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
  });
  if (categories.length === 0) {
    redirect("/admin/categories?reason=no-categories");
  }

  return (
    <div className="container-shazdeh py-10 md:py-14 space-y-10">
      <AdminPageHeader
        eyebrow="New dish"
        title="Add to the menu"
        description="A new plate, ready to land on the Shazdeh table."
      />
      <MenuItemForm categories={categories} />
    </div>
  );
}
