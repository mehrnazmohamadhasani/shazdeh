import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPage, Card, EmptyState } from "@/components/admin/ui";
import { CountForm } from "@/components/admin/ops/forms";
import { UNIT } from "@/components/admin/ops/format";
import { stockSummary } from "@/lib/ops/documents";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Stock count") };
}

export default async function CountPage() {
  const { t } = await getAdminI18n();
  const rows = await stockSummary();
  return (
    <AdminPage
      title={
        <span className="flex items-center gap-3">
          <Link href="/admin/ops/stock" aria-label={t("Back to stock")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black-iron/[0.05]">
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </Link>
          {t("Stock count")}
        </span>
      }
      description={t("Weekly count: type what is actually on the shelf. Differences are saved as corrections, so the history stays complete.")}
    >
      <Card bodyClassName="p-0">
        {rows.length === 0 ? (
          <EmptyState title={t("Nothing to count yet")} description={t("Ingredients appear after you save an invoice.")} />
        ) : (
          <CountForm rows={rows.map((r) => ({ id: r.id, name: r.name, unit: UNIT[r.unit], onHand: r.onHand }))} />
        )}
      </Card>
    </AdminPage>
  );
}
