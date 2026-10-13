import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPage, Card } from "@/components/admin/ui";
import { OpeningStockForm } from "@/components/admin/ops/forms";
import { UNIT } from "@/components/admin/ops/format";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Opening stock") };
}

export default async function OpeningStockPage() {
  const { t } = await getAdminI18n();
  const [ingredients, openings] = await Promise.all([
    prisma.ingredient.findMany({ select: { id: true, name: true, unit: true, category: true }, orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({ where: { type: "OPENING" }, select: { ingredientId: true } }),
  ]);
  const opened = new Set(openings.map((o) => o.ingredientId));
  return (
    <AdminPage
      title={
        <span className="flex items-center gap-3">
          <Link href="/admin/ops/stock" aria-label={t("Back to stock")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black-iron/[0.05]">
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </Link>
          {t("Opening stock")}
        </span>
      }
      description={t(
        "Everything that was already in the kitchen on the first day, once. After this, add that month's invoices — the stock then stays right on its own.",
      )}
    >
      <Card bodyClassName="p-0">
        <OpeningStockForm
          ingredients={ingredients.map((i) => ({
            id: i.id,
            name: i.name,
            unit: UNIT[i.unit],
            category: i.category === "PACKAGING" || i.category === "SUPPLIES" ? i.category : "FOOD",
            hasOpening: opened.has(i.id),
          }))}
        />
      </Card>
    </AdminPage>
  );
}
