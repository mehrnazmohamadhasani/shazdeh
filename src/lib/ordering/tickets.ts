import "server-only";
import { formatFils } from "@/lib/ordering/money";
import { formatUaeMobile } from "@/lib/ordering/phone";
import { PAYMENT_METHOD_LABEL, type PaymentMethodValue, type PaymentStatusValue } from "@/lib/ordering/status";

/*
 * Printed tickets for an 80 mm thermal printer: one for the kitchen
 * (what to cook) and one that travels with the bag (where to, what to
 * collect, the receipt). Plain HTML so it prints the same from any
 * browser, inside a hidden iframe or a tab of its own.
 */

export type TicketCopy = "kitchen" | "delivery";

type TicketOrder = {
  number: string;
  placedAt: Date;
  etaMax: number;
  customerName: string;
  customerPhone: string;
  addressType: string;
  building: string;
  street: string | null;
  unit: string | null;
  floor: string | null;
  areaName: string;
  zoneName: string;
  instructions: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  cutlery: boolean;
  paymentMethod: PaymentMethodValue;
  paymentStatus: PaymentStatusValue;
  subtotalFils: number;
  deliveryFeeFils: number;
  serviceFeeFils: number;
  discountFils: number;
  vatFils: number;
  totalFils: number;
  couponCode: string | null;
  items: { name: string; portion: string | null; quantity: number; lineTotalFils: number; notes: string | null; modifiers: unknown }[];
};

type Legal = { legalName: string | null; trn: string | null; pricesIncludeVat: boolean };

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function dubai(d: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-AE", { timeZone: "Asia/Dubai", hour12: false, ...opts }).format(d);
}

function modifierNames(m: unknown): string[] {
  return Array.isArray(m) ? m.map((x) => String((x as { name?: unknown }).name ?? "")).filter(Boolean) : [];
}

function header(label: string, o: TicketOrder) {
  const due = new Date(o.placedAt.getTime() + o.etaMax * 60_000);
  return `<div class="c b">SHĀZDEH</div>
<div class="tag">${label}</div>
<div class="num">${esc(o.number)}</div>
<div class="row"><span>Placed ${dubai(o.placedAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span><span class="b">Deliver by ${dubai(due, { hour: "2-digit", minute: "2-digit" })}</span></div>
<div class="row"><span class="b">${esc(o.customerName)}</span><span>${esc(formatUaeMobile(o.customerPhone))}</span></div>
<hr>`;
}

function paymentLine(o: TicketOrder) {
  if (o.paymentStatus === "PAID") return `PAID (${esc(PAYMENT_METHOD_LABEL[o.paymentMethod])})`;
  if (o.paymentMethod === "CASH_ON_DELIVERY") return `COLLECT CASH ${formatFils(o.totalFils)}`;
  if (o.paymentMethod === "CARD_ON_DELIVERY") return `CARD MACHINE ${formatFils(o.totalFils)}`;
  return "PAYMENT PENDING";
}

function kitchen(o: TicketOrder) {
  const items = o.items
    .map(
      (i) => `<div class="item"><span class="qty">${i.quantity}×</span> ${esc(i.name)}${i.portion ? ` (${esc(i.portion)})` : ""}${modifierNames(i.modifiers)
        .map((m) => `<div class="sub">+ ${esc(m)}</div>`)
        .join("")}${i.notes ? `<div class="sub i">“${esc(i.notes)}”</div>` : ""}</div>`,
    )
    .join("");
  const count = o.items.reduce((n, i) => n + i.quantity, 0);
  return `<section class="ticket">${header("KITCHEN", o)}${items}<hr>
<div class="row"><span>${count} item${count === 1 ? "" : "s"}</span><span>${o.cutlery ? "CUTLERY: YES" : "No cutlery"}</span></div>
${o.notes ? `<div class="note">NOTE: ${esc(o.notes)}</div>` : ""}
<div class="row"><span>${esc(o.areaName)}</span><span>${paymentLine(o)}</span></div></section>`;
}

function delivery(o: TicketOrder, legal: Legal) {
  const address = [
    [o.unit && `Unit ${o.unit}`, o.floor && `Floor ${o.floor}`].filter(Boolean).join(", "),
    o.building,
    o.street,
    `${o.areaName} (${o.zoneName})`,
  ]
    .filter(Boolean)
    .map((l) => esc(l as string))
    .join("<br>");
  const items = o.items
    .map(
      (i) => `<div class="row"><span>${i.quantity}× ${esc(i.name)}${i.portion ? ` (${esc(i.portion)})` : ""}${modifierNames(i.modifiers)
        .map((m) => `<span class="sub">+ ${esc(m)}</span>`)
        .join("")}</span><span>${formatFils(i.lineTotalFils)}</span></div>`,
    )
    .join("");
  const line = (label: string, fils: number) => `<div class="row"><span>${label}</span><span>${formatFils(fils)}</span></div>`;
  return `<section class="ticket">${header("DELIVERY", o)}
<div class="addr"><span class="cap">${esc(o.addressType)}</span><br>${address}</div>
${o.instructions ? `<div class="note">${esc(o.instructions)}</div>` : ""}
${o.lat != null && o.lng != null ? `<div class="sub">GPS ${o.lat.toFixed(5)}, ${o.lng.toFixed(5)}</div>` : ""}
<div class="pay">${paymentLine(o)}</div>
<hr>${items}<hr>
${line("Subtotal", o.subtotalFils)}
${line("Delivery", o.deliveryFeeFils)}
${o.serviceFeeFils > 0 ? line("Service fee", o.serviceFeeFils) : ""}
${o.discountFils > 0 ? `<div class="row"><span>Promo ${esc(o.couponCode ?? "")}</span><span>−${formatFils(o.discountFils)}</span></div>` : ""}
<div class="row b big"><span>TOTAL</span><span>${formatFils(o.totalFils)}</span></div>
${line(legal.pricesIncludeVat ? "VAT included" : "VAT", o.vatFils)}
${o.cutlery ? `<div class="sub">Cutlery included</div>` : ""}
<hr>
${legal.trn ? `<div class="c sub">${esc(legal.legalName ?? "SHĀZDEH")}<br>Tax invoice · TRN ${esc(legal.trn)}</div>` : ""}
<div class="c sub">Nooshe jan — thank you</div></section>`;
}

export function renderTickets(o: TicketOrder, legal: Legal, copies: TicketCopy[], autoPrint: boolean) {
  const body = copies.map((c) => (c === "kitchen" ? kitchen(o) : delivery(o, legal))).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.number)} tickets</title>
<style>
@page{size:80mm auto;margin:0}
*{box-sizing:border-box}
body{margin:0;font:13px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#000;background:#fff}
.ticket{width:72mm;margin:0 auto;padding:4mm 0 8mm;break-after:page;page-break-after:always}
.ticket:last-child{break-after:auto;page-break-after:auto}
.c{text-align:center}.b{font-weight:700}.i{font-style:italic}.cap{text-transform:capitalize}
.tag{margin:2mm 0;padding:1mm 0;text-align:center;font-weight:700;letter-spacing:.3em;background:#000;color:#fff}
.num{text-align:center;font-size:26px;font-weight:800}
.row{display:flex;justify-content:space-between;gap:3mm}
.row span:last-child{text-align:right;white-space:nowrap}
.item{font-size:16px;margin:1.5mm 0}.qty{font-weight:800}
.sub{display:block;font-size:12px;padding-left:5mm}
.note{margin:2mm 0;padding:1.5mm;border:1px dashed #000;font-weight:700}
.addr{font-size:15px;font-weight:700;margin:1mm 0}
.pay{margin:2mm 0;padding:1.5mm;border:2px solid #000;text-align:center;font-weight:800;font-size:15px}
.big{font-size:16px}
hr{border:0;border-top:1px dashed #000;margin:2mm 0}
@media screen{body{background:#eee}.ticket{background:#fff;margin:4mm auto;padding:4mm}}
</style></head><body>${body}${autoPrint ? `<script>addEventListener("load",function(){print()})</script>` : ""}</body></html>`;
}
