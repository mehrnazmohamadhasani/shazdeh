import { AdminPageHeader } from "@/components/admin/page-header";
import { CategoriesManager } from "@/components/admin/categories-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories" };

export default async function CategoriesAdminPage() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="container-shazdeh py-10 md:py-14 space-y-10">
      <AdminPageHeader
        eyebrow="The structure"
        title="Categories"
        description="Group dishes into courses. Drag the order on the public menu by changing sort numbers."
      />
      <CategoriesManager initial={categories} />
    </div>
  );
}
