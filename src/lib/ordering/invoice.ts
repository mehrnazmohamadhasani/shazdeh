/*
 * The customer's tax invoice, in Arabic and English.
 *
 * UAE Cabinet Resolution 66/2023 (consumer protection regulation):
 *  - Art. 6: the invoice shows the supplier's name, address and contact,
 *    the date, each item with quantity and price in AED, the commercial
 *    registration (trade licence) number and the tax number;
 *  - penalty table: an invoice not issued in Arabic is fined AED 100,000.
 * The customer's name and address are left off: a simplified tax invoice
 * to a consumer doesn't need them, and the page is reachable by link.
 *
 * Pure (no server-only imports) so it is tested without a database.
 */
import { formatFils } from "@/lib/ordering/money";
import { PAYMENT_METHOD_LABEL, type OrderStatusValue, type PaymentMethodValue, type PaymentStatusValue } from "@/lib/ordering/status";

export type InvoiceSeller = {
  brandName: string;
  legalName: string | null;
  tradeLicenseNo: string | null;
  licensingAuthority: string | null;
  trn: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  /** Menu prices include VAT (the UAE consumer rule); false adds it on top. */
  pricesIncludeVat: boolean;
};

export type InvoiceOrder = {
  number: string;
  status: OrderStatusValue;
  placedAt: Date;
  paymentMethod: PaymentMethodValue;
  paymentStatus: PaymentStatusValue;
  subtotalFils: number;
  deliveryFeeFils: number;
  serviceFeeFils: number;
  discountFils: number;
  vatFils: number;
  totalFils: number;
  couponCode: string | null;
  items: { name: string; nameAr: string | null; portion: string | null; quantity: number; unitPriceFils: number; lineTotalFils: number; modifiers: unknown }[];
};

/** English / Arabic pairs for every label on an invoice or receipt. */
export const INVOICE_LABEL = {
  taxInvoice: ["Tax invoice", "فاتورة ضريبية"],
  invoice: ["Invoice", "فاتورة"],
  invoiceNo: ["Invoice no.", "رقم الفاتورة"],
  date: ["Date", "التاريخ"],
  seller: ["Seller", "البائع"],
  address: ["Address", "العنوان"],
  phone: ["Phone", "الهاتف"],
  email: ["Email", "البريد الإلكتروني"],
  licence: ["Trade licence no.", "رقم الرخصة التجارية"],
  trn: ["TRN", "الرقم الضريبي"],
  item: ["Item", "الصنف"],
  qty: ["Qty", "الكمية"],
  unitPrice: ["Unit price", "سعر الوحدة"],
  amount: ["Amount", "المبلغ"],
  subtotal: ["Subtotal", "المجموع الفرعي"],
  delivery: ["Delivery", "التوصيل"],
  serviceFee: ["Service fee", "رسوم الخدمة"],
  discount: ["Discount", "الخصم"],
  total: ["Total (AED)", "الإجمالي (درهم)"],
  vatIncluded: ["VAT included", "شامل ضريبة القيمة المضافة"],
  vat: ["VAT", "ضريبة القيمة المضافة"],
  payment: ["Payment", "الدفع"],
  paid: ["Paid", "مدفوع"],
  toPay: ["To pay on delivery", "يُدفع عند التوصيل"],
  thanks: ["Thank you", "شكراً لكم"],
} as const;

export const PAYMENT_METHOD_AR: Record<PaymentMethodValue, string> = {
  CASH_ON_DELIVERY: "نقداً عند التوصيل",
  CARD_ON_DELIVERY: "بالبطاقة عند التوصيل",
  ONLINE: "دفع إلكتروني",
};

/** Orders that were sold — the others (unpaid, rejected, cancelled) get no invoice. */
export function hasInvoice(status: OrderStatusValue) {
  return status !== "PENDING_PAYMENT" && status !== "REJECTED" && status !== "CANCELLED";
}

/** "Tax invoice" needs a TRN; without one it is a plain invoice. */
export function invoiceTitle(seller: Pick<InvoiceSeller, "trn">) {
  return seller.trn ? INVOICE_LABEL.taxInvoice : INVOICE_LABEL.invoice;
}

/** Date and time in Dubai, with the year: "06 Nov 2026, 13:05". */
export function invoiceDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function modifierNames(m: unknown): string[] {
  return Array.isArray(m) ? m.map((x) => String((x as { name?: unknown }).name ?? "")).filter(Boolean) : [];
}

/** One bilingual label: "Total (AED) · الإجمالي (درهم)". */
const both = ([en, ar]: readonly [string, string]) => `${esc(en)} <span lang="ar" dir="rtl">${esc(ar)}</span>`;

/** The full invoice as a printable HTML page (A4 or phone). */
export function renderInvoice(o: InvoiceOrder, seller: InvoiceSeller): string {
  const title = invoiceTitle(seller);
  const sellerRows = [
    [INVOICE_LABEL.seller, seller.legalName ? `${seller.legalName} (${seller.brandName})` : seller.brandName],
    [INVOICE_LABEL.address, seller.address || "Dubai, United Arab Emirates"],
    [INVOICE_LABEL.phone, seller.phone],
    [INVOICE_LABEL.email, seller.email],
    [INVOICE_LABEL.licence, seller.tradeLicenseNo ? `${seller.tradeLicenseNo}${seller.licensingAuthority ? ` · ${seller.licensingAuthority}` : ""}` : null],
    [INVOICE_LABEL.trn, seller.trn],
  ] as const;
  const rows = o.items
    .map((i) => {
      const extras = modifierNames(i.modifiers);
      return `<tr><td>${esc(i.name)}${i.portion ? ` (${esc(i.portion)})` : ""}${
        i.nameAr ? `<div class="ar" lang="ar" dir="rtl">${esc(i.nameAr)}</div>` : ""
      }${extras.length ? `<div class="sub">+ ${extras.map(esc).join(", ")}</div>` : ""}</td><td class="n">${i.quantity}</td><td class="n">${formatFils(i.unitPriceFils)}</td><td class="n">${formatFils(i.lineTotalFils)}</td></tr>`;
    })
    .join("");
  const line = (label: readonly [string, string], value: string, cls = "") => `<tr class="${cls}"><td>${both(label)}</td><td class="n">${value}</td></tr>`;
  const paid = o.paymentStatus === "PAID";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title[0])} ${esc(o.number)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:24px 16px;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;color:#1d1d1b;background:#f5f1ea}
main{max-width:720px;margin:0 auto;background:#fff;padding:28px 24px;border-radius:14px}
h1{margin:0;font-size:22px}h1 span{display:block;font-size:20px}
.top{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:2px solid #1d1d1b;padding-bottom:14px;margin-bottom:14px}
.meta div{display:flex;gap:8px;justify-content:space-between}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin:0 0 18px}dt{color:#666}dd{margin:0}
table{width:100%;border-collapse:collapse}
th{font-size:12px;text-align:start;color:#666;border-bottom:1px solid #ccc;padding:6px 4px;vertical-align:bottom}
td{padding:8px 4px;border-bottom:1px solid #eee;vertical-align:top}
.n{text-align:end;white-space:nowrap}
.ar{color:#444}.sub{font-size:12px;color:#666}
.totals{margin-top:12px}.totals td{border:0;padding:4px}
.grand td{font-size:17px;font-weight:700;border-top:2px solid #1d1d1b;padding-top:8px}
.foot{margin-top:20px;color:#666;font-size:12.5px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
button{margin:16px auto 0;display:block;padding:10px 18px;border-radius:999px;border:1px solid #1d1d1b;background:#fff;font:inherit;cursor:pointer}
@media print{body{background:#fff;padding:0}main{border-radius:0;padding:0}button{display:none}}
</style></head><body><main>
<div class="top"><h1>${esc(title[0])}<span lang="ar" dir="rtl">${esc(title[1])}</span></h1>
<div class="meta"><div><span>${both(INVOICE_LABEL.invoiceNo)}</span><b>${esc(o.number)}</b></div><div><span>${both(INVOICE_LABEL.date)}</span><span>${esc(invoiceDate(o.placedAt))}</span></div></div></div>
<dl>${sellerRows
    .filter(([, v]) => v)
    .map(([label, v]) => `<dt>${both(label)}</dt><dd dir="auto">${esc(v as string)}</dd>`)
    .join("")}</dl>
<table><thead><tr><th>${both(INVOICE_LABEL.item)}</th><th class="n">${both(INVOICE_LABEL.qty)}</th><th class="n">${both(INVOICE_LABEL.unitPrice)}</th><th class="n">${both(INVOICE_LABEL.amount)}</th></tr></thead><tbody>${rows}</tbody></table>
<table class="totals"><tbody>
${line(INVOICE_LABEL.subtotal, formatFils(o.subtotalFils))}
${line(INVOICE_LABEL.delivery, formatFils(o.deliveryFeeFils))}
${o.serviceFeeFils > 0 ? line(INVOICE_LABEL.serviceFee, formatFils(o.serviceFeeFils)) : ""}
${o.discountFils > 0 ? line(INVOICE_LABEL.discount, `−${formatFils(o.discountFils)}${o.couponCode ? ` (${esc(o.couponCode)})` : ""}`) : ""}
${seller.pricesIncludeVat ? "" : line(INVOICE_LABEL.vat, formatFils(o.vatFils))}
${line(INVOICE_LABEL.total, formatFils(o.totalFils), "grand")}
${seller.pricesIncludeVat ? line(INVOICE_LABEL.vatIncluded, formatFils(o.vatFils)) : ""}
</tbody></table>
<div class="foot"><span>${both(INVOICE_LABEL.payment)}: ${esc(PAYMENT_METHOD_LABEL[o.paymentMethod])} · <span lang="ar" dir="rtl">${esc(PAYMENT_METHOD_AR[o.paymentMethod])}</span> — ${both(paid ? INVOICE_LABEL.paid : INVOICE_LABEL.toPay)}</span><span>${both(INVOICE_LABEL.thanks)}</span></div>
</main><button type="button" onclick="print()">Print / Save as PDF · طباعة</button></body></html>`;
}
