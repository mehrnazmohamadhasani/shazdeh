import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { AdminPage, Card, StatusPill } from "@/components/admin/ui";
import { DeleteSupplierButton, MergeForm, SupplierForm } from "@/components/admin/ops/forms";
import { CMS_ROLES } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { UNIT, amountText, day } from "@/components/admin/ops/format";
import { getSupplier } from "@/lib/ops/catalog";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Supplier") };
}

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, money, locale, intl } = await getAdminI18n();
  const { id } = await params;
  const [supplier, others, user, invoiceCount] = await Promise.all([
    getSupplier(id),
    prisma.supplier.findMany({ where: { id: { not: id } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    requireAdmin(),
    // All invoices, undone ones too: any of them keeps the supplier.
    prisma.purchaseInvoice.count({ where: { supplierId: id } }),
  ]);
  if (!supplier) notFound();

  return (
    <AdminPage
      title={
        <span className="flex items-center gap-3">
          <Link href="/admin/ops/suppliers" aria-label={t("Back to suppliers")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black-iron/[0.04] transition-colors hover:bg-black-iron/[0.08]">
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </Link>
          <span dir="auto">{supplier.name}</span>
        </span>
      }
    >
      <Card title={t("Details")} id="details">
        <SupplierForm supplier={supplier} />
      </Card>

      <Card title={t("Invoices")} bodyClassName="p-0">
        {supplier.invoices.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-dark-grey md:px-6">{t("No invoices.")}</p>
        ) : (
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {supplier.invoices.map((inv) => {
              const docId = inv.documentId ?? inv.voidedDocumentId;
              const row = (
                <>
                  <span className="min-w-0 flex-1">
                    {inv.invoiceNo ? <span dir="ltr">#{inv.invoiceNo}</span> : t("No number")} · {day(inv.invoiceDate, true, intl)}
                  </span>
                  {inv.voidedAt ? (
                    <StatusPill>{t("Not counted")}</StatusPill>
                  ) : inv.paidAt ? (
                    <StatusPill tone="good">{t("Paid")}</StatusPill>
                  ) : inv.paymentMode === "credit" ? (
                    <StatusPill tone={inv.dueDate && inv.dueDate < new Date() ? "bad" : "warn"}>
                      {inv.dueDate ? t("Due {date}", { date: day(inv.dueDate, false, intl) }) : t("Unpaid")}
                    </StatusPill>
                  ) : null}
                  <span className={inv.voidedAt ? "tabular-nums text-dark-grey line-through" : "tabular-nums"}>{money(inv.totalFils)}</span>
                </>
              );
              return (
                <li key={inv.id}>
                  {docId ? (
                    <Link href={`/admin/ops/invoices/${docId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-black-iron/[0.02] md:px-6">
                      {row}
                      <ChevronRight className="h-4 w-4 shrink-0 text-dark-grey rtl:-scale-x-100" />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3 md:px-6">
                      {row}
                      <span className="w-4 shrink-0" aria-hidden />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {supplier.items.length > 0 && (
        <Card
          title={t("What we've learned")}
          description={t("How this supplier prints each item, and how much stock one of its units is.")}
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-black-iron/[0.06] text-[14px]">
            {supplier.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 md:px-6">
                <span dir="auto" className="min-w-0 truncate text-dark-grey">{item.rawName}</span>
                <span className="shrink-0">
                  {t("1 unit = {amount}", { amount: amountText(item.baseQtyPerUnit, UNIT[item.ingredient.unit], locale) })}{" "}
                  <Link href={`/admin/ops/ingredients/${item.ingredient.id}`} dir="auto" className="font-medium admin-link">
                    {item.ingredient.name}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t("Merge")} description={t("Same supplier under two names (e.g. “Unknown (handwritten veg)”)? Move everything into the right one.")}>
        <MergeForm url={`/api/admin/ops/suppliers/${supplier.id}/merge`} options={others} noun="supplier" redirectTo="/admin/ops/suppliers/{id}" />
      </Card>

      {/* Same roles as deleting an ingredient. */}
      {CMS_ROLES.includes(user.role) && (
        <Card title={t("Delete")}>
          <DeleteSupplierButton id={supplier.id} name={supplier.name} invoiceCount={invoiceCount} />
        </Card>
      )}
    </AdminPage>
  );
}
