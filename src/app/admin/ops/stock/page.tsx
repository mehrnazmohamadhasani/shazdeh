import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { AdminPage, Card, EmptyState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { UploadButton } from "@/components/admin/ops/upload-button";
import { UNIT, day, unitPrice } from "@/components/admin/ops/format";
import { stockSummary } from "@/lib/ops/documents";
import { formatAmount } from "@/lib/ops/units";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stock" };

export default async function StockPage() {
  const rows = await stockSummary();
  return (
    <AdminPage
      title="Stock"
      description="What is in the kitchen: purchases in, waste and staff meals out, corrected by the weekly count."
      actions={
        <>
          <Button asChild variant="outline" size="md">
            <Link href="/admin/ops/stock/count">
              <ClipboardList className="h-4 w-4" /> Count stock
            </Link>
          </Button>
          <UploadButton />
        </>
      }
    >
      <Card bodyClassName="p-0">
        {rows.length === 0 ? (
          <EmptyState title="No stock yet" description="Save your first supplier invoice and its ingredients appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[14px]">
              <thead>
                <tr className="border-b border-black-iron/[0.06] text-left text-[12px] text-dark-grey">
                  <th className="px-5 py-3 font-medium md:px-6">Ingredient</th>
                  <th className="px-3 py-3 text-right font-medium">On hand</th>
                  <th className="px-3 py-3 text-right font-medium">Last price (ex VAT)</th>
                  <th className="px-5 py-3 font-medium md:px-6">Last bought</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black-iron/[0.06]">
                {rows.map((r) => {
                  const unit = UNIT[r.unit];
                  return (
                    <tr key={r.id} className="hover:bg-black-iron/[0.02]">
                      <td className="px-5 py-3 font-medium md:px-6">
                        <Link href={`/admin/ops/ingredients/${r.id}`} className="hover:underline">
                          {r.name}
                        </Link>
                        {r.category === "PACKAGING" && <span className="ml-2 text-[12px] font-normal text-dark-grey">packaging</span>}
                      </td>
                      <td className={`px-3 py-3 text-right tabular-nums ${r.onHand < 0 ? "text-pomegranate-red" : ""}`}>{formatAmount(r.onHand, unit)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-dark-grey">
                        {r.lastPurchase?.costPerUnitFils != null ? unitPrice(r.lastPurchase.costPerUnitFils, unit) : "—"}
                      </td>
                      <td className="px-5 py-3 text-dark-grey md:px-6">
                        {r.lastPurchase ? `${day(r.lastPurchase.at)}${r.lastPurchase.supplier ? ` · ${r.lastPurchase.supplier}` : ""}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
