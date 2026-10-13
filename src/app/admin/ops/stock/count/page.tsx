import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPage, Card, EmptyState } from "@/components/admin/ui";
import { CountForm } from "@/components/admin/ops/forms";
import { UNIT } from "@/components/admin/ops/format";
import { stockSummary } from "@/lib/ops/documents";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stock count" };

export default async function CountPage() {
  const rows = await stockSummary();
  return (
    <AdminPage
      title={
        <span className="flex items-center gap-3">
          <Link href="/admin/ops/stock" aria-label="Back to stock" className="grid h-9 w-9 place-items-center rounded-full hover:bg-black-iron/[0.05]">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          Stock count
        </span>
      }
      description="Weekly count: type what is actually on the shelf. Differences are saved as corrections, so the history stays complete."
    >
      <Card bodyClassName="p-0">
        {rows.length === 0 ? (
          <EmptyState title="Nothing to count yet" description="Ingredients appear after you save an invoice." />
        ) : (
          <CountForm rows={rows.map((r) => ({ id: r.id, name: r.name, unit: UNIT[r.unit], onHand: r.onHand }))} />
        )}
      </Card>
    </AdminPage>
  );
}
