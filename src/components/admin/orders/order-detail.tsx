"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock, ExternalLink, MapPin, MessageSquare, Phone, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { QuantityStepper } from "@/components/order/quantity-stepper";
import { claimPrint, printTickets } from "@/components/admin/orders/print-tickets";
import { Input } from "@/components/ui/input";
import {
  DispatchDialog,
  ReasonDialog,
  patchOrder,
  type DispatchProviderOption,
} from "@/components/admin/orders/order-actions";
import { useAdminI18n } from "@/components/admin/i18n";
import { formatPhone } from "@/lib/ordering/phone";
import {
  PAYMENT_LABEL,
  PAYMENT_METHOD_LABEL,
  STAFF_ACTION,
  STAFF_LABEL,
  isTerminal,
  nextStatus,
  type OrderStatusValue,
  type PaymentMethodValue,
  type PaymentStatusValue,
} from "@/lib/ordering/status";
import { cn } from "@/lib/utils";

export type OrderDetailData = {
  id: string;
  number: string;
  status: OrderStatusValue;
  paymentMethod: PaymentMethodValue;
  paymentStatus: PaymentStatusValue;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  areaName: string;
  zoneName: string;
  addressType: string;
  building: string;
  street: string | null;
  unit: string | null;
  floor: string | null;
  instructions: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  cutlery: boolean;
  subtotalFils: number;
  deliveryFeeFils: number;
  serviceFeeFils: number;
  discountFils: number;
  vatFils: number;
  totalFils: number;
  couponCode: string | null;
  etaMin: number;
  etaMax: number;
  rejectionReason: string | null;
  deliveryProvider: string;
  driverName: string | null;
  driverPhone: string | null;
  deliveryRef: string | null;
  trackingUrl: string | null;
  trackingToken: string;
  placedAt: string;
  seenAt: string | null;
  items: { id: string; name: string; portion: string | null; quantity: number; lineTotalFils: number; notes: string | null; modifiers: string[] }[];
  events: { id: string; type: string; status: OrderStatusValue | null; message: string | null; actor: string; createdAt: string }[];
  previousOrders: number;
};

/** Address types as the customer picked them (stored lower-case English). */
const ADDRESS_TYPE: Record<string, string> = { apartment: "Apartment", villa: "Villa", office: "Office" };
/** Timeline event types (stored lower-case English). */
const EVENT_TYPE: Record<string, string> = { note: "Note", payment: "Payment", status: "Status" };

export function OrderDetail({ order: o, providers }: { order: OrderDetailData; providers: DispatchProviderOption[] }) {
  const { t, tData, locale, money, date } = useAdminI18n();
  const fa = locale === "fa";
  const dubaiTime = (iso: string, withDate = false) =>
    date(iso, { ...(withDate ? { dateStyle: "medium" } : {}), timeStyle: "short" });
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [cancelling, setCancelling] = React.useState<"REJECTED" | "CANCELLED" | null>(null);
  const [dispatching, setDispatching] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [soldOut, setSoldOut] = React.useState<OrderDetailData["items"][number] | null>(null);
  // Dishes can come off the order until it's packed.
  const adjustable = o.status === "RECEIVED" || o.status === "CONFIRMED" || o.status === "PREPARING";
  const next = nextStatus(o.status);
  const phoneDigits = o.customerPhone.replace(/\D/g, "");

  // Keep the page live while it's open on a tablet.
  React.useEffect(() => {
    if (isTerminal(o.status)) return;
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [o.status, router]);

  async function run(body: unknown, success: string) {
    setBusy(true);
    const ok = await patchOrder(o.id, body, t);
    if (ok) {
      toast.success(success);
      window.dispatchEvent(new Event("shazdeh:orders-changed"));
      router.refresh();
    }
    setBusy(false);
    return ok;
  }

  const mapUrl =
    o.lat != null && o.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([o.building, o.street, o.areaName, "Dubai"].filter(Boolean).join(", "))}`;

  return (
    <div className="space-y-8">
      <div className="print:hidden">
        <Link href="/admin/orders" className="inline-flex min-h-10 items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-dark-grey hover:text-black-iron">
          <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t("All orders")}
        </Link>
      </div>

      <header className="flex flex-col gap-4 border-b border-black-iron/[0.08] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[12px] font-medium text-terracotta-ink">
            {t("{status} · placed {time}", { status: t(STAFF_LABEL[o.status]), time: dubaiTime(o.placedAt, true) })}
          </p>
          <h1 className="mt-3 text-4xl font-bold tabular-nums tracking-[-0.04em] text-black-iron md:text-5xl">{o.number}</h1>
          {o.rejectionReason && <p className="mt-2 text-[14px] text-pomegranate-red">{t("Reason: {reason}", { reason: o.rejectionReason })}</p>}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {!o.seenAt && o.status !== "RECEIVED" && !isTerminal(o.status) && (
            <Button size="lg" variant="secondary" disabled={busy} onClick={() => run({ action: "ack" }, t("Alarm stopped"))}>
              <Check className="h-4 w-4" /> {t("Got it")}
            </Button>
          )}
          {next && (
            <Button
              size="lg"
              disabled={busy}
              onClick={() => (next === "OUT_FOR_DELIVERY" ? setDispatching(true) : run({ action: "status", to: next }, t(STAFF_LABEL[next])))}
            >
              {t(STAFF_ACTION[next] ?? "")}
            </Button>
          )}
          {o.status === "RECEIVED" && (
            <Button size="lg" variant="outline" onClick={() => setCancelling("REJECTED")}>
              {t("Reject")}
            </Button>
          )}
          {!isTerminal(o.status) && o.status !== "RECEIVED" && o.status !== "PENDING_PAYMENT" && (
            <Button size="lg" variant="ghost" onClick={() => setCancelling("CANCELLED")}>
              {t("Cancel order")}
            </Button>
          )}
          <Button
            size="lg"
            variant="ghost"
            onClick={() => {
              void claimPrint(o.id);
              void printTickets(o.id);
            }}
          >
            <Printer className="h-4 w-4" /> {t("Print tickets")}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items — the kitchen ticket */}
        <section className="rounded-[16px] border border-black-iron/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 lg:col-span-2">
          <h2 className="text-[16px] font-semibold text-black-iron">{t("Items")}</h2>
          <ul className="mt-4 divide-y divide-black-iron/[0.06]">
            {o.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-4 py-3">
                <div className="text-[16px] text-black-iron">
                  <span className="font-bold tabular-nums text-terracotta-ink">{i.quantity}×</span> <span dir="auto">
                    {i.name}
                    {i.portion && <span className="text-dark-grey"> ({i.portion})</span>}
                  </span>
                  {i.modifiers.length > 0 && <p dir="auto" className="ps-7 text-[13px] text-dark-grey">{i.modifiers.join(" · ")}</p>}
                  {i.notes && <p dir="auto" className="ps-7 text-[13px] italic text-cinnamon-bark">“{i.notes}”</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular-nums text-black-iron/80">{money(i.lineTotalFils)}</span>
                  {adjustable && (
                    <button
                      type="button"
                      onClick={() => setSoldOut(i)}
                      className="min-h-8 rounded-full border border-black-iron/15 px-3 text-[12px] text-black-iron/80 hover:border-pomegranate-red hover:text-pomegranate-red print:hidden"
                    >
                      {t("Sold out…")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {o.notes && (
            <p className="mt-3 rounded-sm bg-saffron-orange/[0.12] px-3 py-2 text-[14px] text-cinnamon-bark">
              {t("Kitchen note:")} <span dir="auto">{o.notes}</span>
            </p>
          )}
          <p className="mt-3 text-[13px] text-dark-grey">{o.cutlery ? t("Include cutlery and napkins") : t("No cutlery")}</p>

          <dl className="mt-5 space-y-1.5 border-t border-black-iron/[0.08] pt-4 text-[14px]">
            <Line label={t("Subtotal")} value={money(o.subtotalFils)} />
            <Line label={t("Delivery ({zone})", { zone: o.zoneName })} value={money(o.deliveryFeeFils)} />
            {o.serviceFeeFils > 0 && <Line label={t("Service fee")} value={money(o.serviceFeeFils)} />}
            {o.discountFils > 0 && <Line label={t("Promo {code}", { code: o.couponCode ?? "" })} value={`−${money(o.discountFils)}`} />}
            <Line label={t("VAT included")} value={money(o.vatFils)} muted />
            <div className="flex justify-between pt-2 text-[18px] font-bold text-black-iron">
              <dt>{t("Total")}</dt>
              <dd className="tabular-nums">{money(o.totalFils)}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          {/* Payment */}
          <section className="rounded-[16px] border border-black-iron/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5">
            <h2 className="text-[16px] font-semibold text-black-iron">{t("Payment")}</h2>
            <p className="mt-3 text-[16px] font-semibold text-black-iron">{t(PAYMENT_METHOD_LABEL[o.paymentMethod])}</p>
            <p className={cn("text-[14px]", o.paymentStatus === "PAID" ? "text-olive-leaf" : "text-cinnamon-bark")}>
              {o.paymentStatus === "PAY_ON_DELIVERY"
                ? t("{status} — collect {amount}", { status: t(PAYMENT_LABEL[o.paymentStatus]), amount: money(o.totalFils) })
                : t(PAYMENT_LABEL[o.paymentStatus])}
            </p>
            {o.paymentStatus === "PAY_ON_DELIVERY" && (
              <Button size="sm" variant="secondary" className="mt-3 print:hidden" disabled={busy} onClick={() => run({ action: "markPaid" }, t("Marked as paid"))}>
                {t("Mark as paid")}
              </Button>
            )}
          </section>

          {/* Customer & address */}
          <section className="rounded-[16px] border border-black-iron/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5">
            <h2 className="text-[16px] font-semibold text-black-iron">{t("Customer")}</h2>
            <p dir="auto" className="mt-3 text-[16px] font-semibold text-black-iron">{o.customerName}</p>
            <p className="text-[12.5px] text-dark-grey">
              {o.previousOrders > 0
                ? t(o.previousOrders > 1 ? "{n} previous delivered orders" : "{n} previous delivered order", { n: o.previousOrders })
                : t("First order")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 print:hidden">
              <a href={`tel:${o.customerPhone}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-black-iron/15 px-3.5 text-[13px] text-black-iron">
                <Phone className="h-4 w-4" /> <span dir="ltr">{formatPhone(o.customerPhone)}</span>
              </a>
              <a
                href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hello ${o.customerName.split(" ")[0]}, this is SHĀZDEH about your order ${o.number}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-black-iron/15 px-3.5 text-[13px] text-black-iron"
              >
                <MessageSquare className="h-4 w-4" /> WhatsApp
              </a>
            </div>
            <p dir="ltr" className="mt-1 hidden text-[14px] text-black-iron print:block">{formatPhone(o.customerPhone)}</p>
            {o.customerEmail && <p dir="ltr" className="mt-2 text-[13px] text-dark-grey">{o.customerEmail}</p>}

            <div className="mt-5 border-t border-black-iron/[0.08] pt-4 text-[14px] leading-relaxed text-black-iron">
              <p className="capitalize text-dark-grey">{fa && ADDRESS_TYPE[o.addressType] ? t(ADDRESS_TYPE[o.addressType]) : o.addressType}</p>
              <p>
                {[o.unit && t("Unit {unit}", { unit: o.unit }), o.floor && t("Floor {floor}", { floor: o.floor })]
                  .filter(Boolean)
                  .join(fa ? "، " : ", ")}
              </p>
              <p dir="auto" className="font-semibold">{o.building}</p>
              {o.street && <p dir="auto">{o.street}</p>}
              <p dir="auto">{o.areaName}</p>
              {o.instructions && <p dir="auto" className="mt-2 text-cinnamon-bark">“{o.instructions}”</p>}
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 text-[13px] text-terracotta-ink print:hidden">
                <MapPin className="h-4 w-4" /> {t("Open in Maps")} {o.lat != null && t("(customer shared location)")}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </section>

          {/* Delivery */}
          <section className="rounded-[16px] border border-black-iron/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 print:hidden">
            <h2 className="text-[16px] font-semibold text-black-iron">{t("Delivery")}</h2>
            <p className="mt-3 text-[14px] text-black-iron">
              {t("Promised {min}–{max} min · by {time}", {
                min: o.etaMin,
                max: o.etaMax,
                time: dubaiTime(new Date(new Date(o.placedAt).getTime() + o.etaMax * 60000).toISOString()),
              })}
            </p>
            {(o.driverName || o.deliveryRef) && (
              <p className="mt-1 text-[13px] text-dark-grey">
                {o.deliveryProvider === "courier" ? t("Courier") : t("Rider")}:{" "}
                <span dir="auto">{[o.driverName, o.driverPhone, o.deliveryRef].filter(Boolean).join(" · ")}</span>
              </p>
            )}
            {!isTerminal(o.status) && (
              <Button size="sm" variant="secondary" className="mt-3" disabled={busy} onClick={() => run({ action: "delay", minutes: 10 }, t("Estimate updated"))}>
                <Clock className="h-3.5 w-3.5" /> {t("Running late +10 min")}
              </Button>
            )}
            <a href={`/order/track/${o.trackingToken}`} target="_blank" rel="noopener noreferrer" className="mt-3 block text-[12.5px] text-dark-grey underline">
              {t("Customer's tracking page")}
            </a>
          </section>
        </div>
      </div>

      {/* Timeline */}
      <section className="rounded-[16px] border border-black-iron/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 print:hidden">
        <h2 className="text-[16px] font-semibold text-black-iron">{t("Timeline")}</h2>
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (note.trim() && (await run({ action: "note", message: note.trim() }, t("Note added")))) setNote("");
          }}
        >
          <Input
            dir="auto"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("Add an internal note (not visible to the customer)")}
            maxLength={500}
          />
          <Button type="submit" variant="secondary" disabled={!note.trim() || busy}>
            {t("Add")}
          </Button>
        </form>
        <ol className="mt-4 space-y-3">
          {o.events.map((e) => (
            <li key={e.id} className="flex gap-4 text-[13.5px]">
              <span className="w-28 shrink-0 tabular-nums text-dark-grey">{dubaiTime(e.createdAt, true)}</span>
              <span className="text-black-iron">
                {e.status && e.type === "status" ? (
                  <strong>{t(STAFF_LABEL[e.status])}</strong>
                ) : (
                  <strong className="capitalize">{fa && EVENT_TYPE[e.type] ? t(EVENT_TYPE[e.type]) : e.type}</strong>
                )}
                {e.message && (
                  <span className="text-black-iron/80">
                    {" "}
                    — <span dir="auto">{tData(e.message)}</span>
                  </span>
                )}
                <span dir="auto" className="block text-[11.5px] text-dark-grey">{e.actor}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <ReasonDialog
        open={!!cancelling}
        onOpenChange={(v) => !v && setCancelling(null)}
        title={cancelling === "REJECTED" ? t("Reject {number}?", { number: o.number }) : t("Cancel {number}?", { number: o.number })}
        confirmLabel={cancelling === "REJECTED" ? t("Reject order") : t("Cancel order")}
        onConfirm={async (reason) => {
          if (cancelling && (await run({ action: "status", to: cancelling, reason }, t(STAFF_LABEL[cancelling])))) setCancelling(null);
        }}
      />
      {soldOut && (
        <SoldOutDialog
          item={soldOut}
          onlyItem={o.items.length === 1}
          paidOnline={o.paymentMethod === "ONLINE" && o.paymentStatus === "PAID"}
          onClose={() => setSoldOut(null)}
          onConfirm={async (quantity, markSoldOut) => {
            const removed = soldOut.quantity - quantity;
            if (await run({ action: "reduceItem", itemId: soldOut.id, quantity, markSoldOut }, t("Removed {n}× {dish} — customer notified", { n: removed, dish: soldOut.name }))) {
              setSoldOut(null);
            }
          }}
          onReject={() => {
            setSoldOut(null);
            setCancelling(o.status === "RECEIVED" ? "REJECTED" : "CANCELLED");
          }}
        />
      )}
      {dispatching && (
        <DispatchDialog
          open
          onOpenChange={(v) => !v && setDispatching(false)}
          providers={providers}
          onConfirm={async (d) => {
            if (await run({ action: "status", to: "OUT_FOR_DELIVERY", dispatch: d }, t("Dispatched"))) setDispatching(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * A dish ran out after the order came in. Staff choose how many can
 * still be made; the rest comes off the order, the total drops, and the
 * customer is told by email/push. Calling them first is still best.
 */
function SoldOutDialog({
  item,
  onlyItem,
  paidOnline,
  onClose,
  onConfirm,
  onReject,
}: {
  item: OrderDetailData["items"][number];
  onlyItem: boolean;
  paidOnline: boolean;
  onClose: () => void;
  onConfirm: (quantity: number, markSoldOut: boolean) => Promise<void>;
  onReject: () => void;
}) {
  const { t } = useAdminI18n();
  const [keep, setKeep] = React.useState(0);
  const [markSoldOut, setMarkSoldOut] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const empties = onlyItem && keep === 0;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-white text-black-iron sm:max-w-md">
        <div className="space-y-5 p-6">
          <DialogTitle className="text-2xl text-black-iron">{t("{dish} is sold out", { dish: item.name })}</DialogTitle>
          <DialogDescription className="text-dark-grey">
            {t("We'll take it off this order, lower the total and tell the customer. A quick call first is kind.")}
            {paidOnline && ` ${t("They paid online — refund the difference from the payment dashboard.")}`}
          </DialogDescription>
          {item.quantity > 1 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-[14px] text-black-iron">
                {t("How many can we still make?")} <span className="text-dark-grey">{t("(ordered {n})", { n: item.quantity })}</span>
              </span>
              <QuantityStepper value={keep} min={0} max={item.quantity - 1} onChange={setKeep} label={item.name} />
            </div>
          )}
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[12px] border border-black-iron/[0.08] px-4 py-3">
            <span className="text-[14px] text-black-iron">
              {t("Also mark it sold out on the menu")}
              <span className="block text-[12.5px] text-dark-grey">{t("So no one else can order it. Switch it back on in Menu.")}</span>
            </span>
            <Switch checked={markSoldOut} onCheckedChange={setMarkSoldOut} />
          </label>
          {empties && (
            <p className="rounded-sm bg-saffron-orange/[0.12] px-3 py-2 text-[13px] text-cinnamon-bark">
              {t("This is the only dish on the order — reject or cancel it instead.")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t("Back")}
            </Button>
            {empties ? (
              <Button variant="destructive" onClick={onReject}>
                {t("Reject / cancel order")}
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onConfirm(keep, markSoldOut);
                  setBusy(false);
                }}
              >
                {t("Remove {n}× from order", { n: item.quantity - keep })}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between", muted ? "text-dark-grey" : "text-black-iron/80")}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
