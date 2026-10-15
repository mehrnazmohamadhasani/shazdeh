/* eslint-disable @next/next/no-img-element -- private document served by an authenticated route, not next/image */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AdminPage, Card, StatusPill } from "@/components/admin/ui";
import { DOC_STATUS } from "@/components/admin/ops/status";
import { DiscardButton, RetryRead } from "@/components/admin/ops/document-actions";
import { PlatformReview, UndoSaleButton } from "@/components/admin/ops/platform-forms";
import { day } from "@/components/admin/ops/format";
import { getPlatformDocument } from "@/lib/ops/platform-import";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { requireAdmin } from "@/lib/auth";
import { saleStockStatus } from "@/lib/ops/stock-use";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Platform receipt") };
}

/** Why a dish of a saved sale didn't take stock. */
const STOCK_REASON = {
  not_matched: "Not matched to a menu dish — stock not reduced.",
  no_recipe: "No recipe yet — stock not reduced.",
  not_approved: "Recipe not approved yet — stock not reduced.",
  prep_not_approved: "A prep in the recipe isn't approved yet — stock not reduced.",
  cycle: "The recipe contains itself — stock not reduced.",
  saved_before_recipe: "Saved before its recipe was approved — stock not reduced.",
} as const;

const FUNDED = { UNKNOWN: "Not known", RESTAURANT: "Restaurant", PLATFORM: "Platform", SHARED: "Shared" } as const;

export default async function PlatformReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, money, intl } = await getAdminI18n();
  // The purchaser records receipts but doesn't see Sales or undo saved sales.
  const purchaser = (await requireAdmin()).role === "PURCHASER";
  const back = purchaser ? { href: "/admin/ops/invoices", label: "Back to invoices" } : { href: "/admin/ops/sales", label: "Back to sales" };
  const data = await getPlatformDocument(id);
  if (!data) notFound();
  const { doc, reading, draft, menu, channels } = data;
  const fileUrl = `/api/admin/ops/documents/${doc.id}/file`;
  const order = doc.platformOrder;
  const status = DOC_STATUS[doc.status];

  const original = (
    <Card
      title={t("Original")}
      actions={
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-terracotta-ink underline-offset-4 hover:underline">
          {t("Full size")} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      }
      bodyClassName="p-3"
    >
      {doc.mimeType === "application/pdf" ? (
        <object data={fileUrl} type="application/pdf" className="h-[45vh] w-full rounded-[10px] lg:h-[70vh]">
          <a href={fileUrl}>{t("Open the PDF")}</a>
        </object>
      ) : (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
          <img src={fileUrl} alt={t("Uploaded receipt")} className="max-h-[40vh] w-full rounded-[10px] object-contain lg:max-h-none" />
        </a>
      )}
      <p className="mt-2 px-1 text-[12px] text-dark-grey">{t("Uploaded {date}", { date: day(doc.createdAt, true, intl) })}</p>
    </Card>
  );

  const stock = order
    ? await saleStockStatus(
        { platformOrderId: order.id },
        order.items.map((i) => ({ menuItemId: i.menuItemId, name: i.rawName, quantity: i.quantity })),
      )
    : [];

  let body: React.ReactNode;
  if (doc.status === "SAVED" && order) {
    body = (
      <Card title={t("{platform} order #{no}", { platform: order.channel.name, no: order.orderNo })} actions={purchaser ? undefined : <UndoSaleButton orderId={order.id} />}>
        <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2">
          <div>
            <dt className="text-[12.5px] text-dark-grey">{t("Ordered at")}</dt>
            <dd>{day(order.placedAt, true, intl)} {new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }).format(order.placedAt)}</dd>
          </div>
          {order.altOrderId && (
            <div>
              <dt className="text-[12.5px] text-dark-grey">{t("Other number on the receipt")}</dt>
              <dd dir="ltr" className="text-start">{order.altOrderId}</dd>
            </div>
          )}
          <div>
            <dt className="text-[12.5px] text-dark-grey">{t("Food sale for SHĀZDEH")}</dt>
            <dd className="font-semibold">
              {money(order.foodSalesFils)}
              {order.salesSource === "menu" && <span className="ms-2 text-[12px] font-normal text-dark-grey">{t("prices from menu")}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-[12.5px] text-dark-grey">{t("Total (customer paid)")}</dt>
            <dd>{money(order.totalFils)}</dd>
          </div>
          {order.discountFils > 0 && (
            <div>
              <dt className="text-[12.5px] text-dark-grey">{t("Discount")}</dt>
              <dd>
                {money(order.discountFils)} · {t("paid by: {who}", { who: t(FUNDED[order.discountFundedBy]) })}
              </dd>
            </div>
          )}
          {order.payment && (
            <div>
              <dt className="text-[12.5px] text-dark-grey">{t("Payment")}</dt>
              <dd dir="ltr" className="text-start">{order.payment}</dd>
            </div>
          )}
        </dl>
        <ul className="mt-5 divide-y divide-black-iron/[0.06] rounded-[12px] border border-black-iron/[0.06] text-[14px]">
          {order.items.map((i, n) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-8 tabular-nums text-dark-grey">{i.quantity}×</span>
              <span className="min-w-0 flex-1">
                {i.menuItem ? `${i.menuItem.category.name} / ${i.menuItem.name}` : <span className="text-cinnamon-bark">{t("Not matched")}</span>}
                <span dir="auto" className="block text-[12px] text-dark-grey">
                  {t("on the receipt: {name}", { name: i.rawName })}
                </span>
                {stock[n] && (
                  <span className={`block text-[12px] ${stock[n].used ? "text-dark-grey" : "text-cinnamon-bark"}`}>
                    {stock[n].used ? t("Ingredients taken from stock.") : t(STOCK_REASON[stock[n].reason])}
                  </span>
                )}
              </span>
              <span className="tabular-nums">{i.lineTotalFils != null ? money(i.lineTotalFils) : "—"}</span>
            </li>
          ))}
        </ul>
      </Card>
    );
  } else if (doc.status === "NEEDS_REVIEW" && reading && draft) {
    body = (
      <>
        {doc.error && (
          <p className="mb-5 rounded-[16px] border border-saffron-orange/30 bg-saffron-orange/[0.08] px-4 py-3 text-[13.5px] text-cinnamon-bark">
            {t("Not saved automatically: {reason}", { reason: t(doc.error) })}
          </p>
        )}
        <PlatformReview
        documentId={doc.id}
        draft={draft}
        itemCount={reading.itemCount}
        isPlatformReceipt={reading.isPlatformReceipt}
        channels={channels.filter((c) => c.kind === "PLATFORM" && c.isActive).map((c) => ({ code: c.code, name: c.name }))}
        menu={menu}
        />
      </>
    );
  } else {
    body = (
      <Card title={doc.status === "FAILED" ? t("AI couldn't read this receipt") : t(status.label)}>
        {doc.error && <p className="text-[14px] text-pomegranate-red">{t(doc.error)}</p>}
        {doc.status === "DISCARDED" ? (
          <p className="text-[14px] text-dark-grey">{t("This receipt was discarded. Nothing was saved from it.")}</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <RetryRead documentId={doc.id} />
            <DiscardButton documentId={doc.id} redirectTo={back.href} />
          </div>
        )}
      </Card>
    );
  }

  return (
    <AdminPage
      title={
        <span className="flex flex-wrap items-center gap-3">
          <Link href={back.href} aria-label={t(back.label)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black-iron/[0.05]">
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </Link>
          <span>{order ? `${order.channel.name} #${order.orderNo}` : reading ? `${reading.platformPrinted ?? reading.platform} ${reading.orderNo ? `#${reading.orderNo}` : ""}` : t("Platform receipt")}</span>
          <StatusPill tone={status.tone}>{t(status.label)}</StatusPill>
          {doc.status === "SAVED" && doc.autoSaved && <StatusPill tone="accent">{t("Saved automatically")}</StatusPill>}
        </span>
      }
      className="max-w-[1400px]"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <div className="lg:sticky lg:top-6">{original}</div>
        <div className="min-w-0">
          {body}
          {doc.status === "NEEDS_REVIEW" && (
            <div className="mt-3">
              <DiscardButton documentId={doc.id} redirectTo={back.href} />
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
