"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink, MapPin, MessageSquare, Phone, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DispatchDialog,
  ReasonDialog,
  patchOrder,
  type DispatchProviderOption,
} from "@/components/admin/orders/order-actions";
import { formatFils } from "@/lib/ordering/money";
import { formatUaeMobile } from "@/lib/ordering/phone";
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
  items: { id: string; name: string; portion: string | null; quantity: number; lineTotalFils: number; notes: string | null; modifiers: string[] }[];
  events: { id: string; type: string; status: OrderStatusValue | null; message: string | null; actor: string; createdAt: string }[];
  previousOrders: number;
};

function dubaiTime(iso: string, withDate = false) {
  return new Date(iso).toLocaleString("en-AE", {
    timeZone: "Asia/Dubai",
    ...(withDate ? { dateStyle: "medium" } : {}),
    timeStyle: "short",
  });
}

export function OrderDetail({ order: o, providers }: { order: OrderDetailData; providers: DispatchProviderOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [cancelling, setCancelling] = React.useState<"REJECTED" | "CANCELLED" | null>(null);
  const [dispatching, setDispatching] = React.useState(false);
  const [note, setNote] = React.useState("");
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
    const ok = await patchOrder(o.id, body);
    if (ok) {
      toast.success(success);
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
          <ArrowLeft className="h-4 w-4" /> All orders
        </Link>
      </div>

      <header className="flex flex-col gap-4 border-b border-black-iron/[0.08] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[12px] font-medium text-terracotta-ink">
            {STAFF_LABEL[o.status]} · placed {dubaiTime(o.placedAt, true)}
          </p>
          <h1 className="mt-3 text-4xl font-bold tabular-nums tracking-[-0.04em] text-black-iron md:text-5xl">{o.number}</h1>
          {o.rejectionReason && <p className="mt-2 text-[14px] text-pomegranate-red">Reason: {o.rejectionReason}</p>}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {next && (
            <Button
              size="lg"
              disabled={busy}
              onClick={() => (next === "OUT_FOR_DELIVERY" ? setDispatching(true) : run({ action: "status", to: next }, STAFF_LABEL[next]))}
            >
              {STAFF_ACTION[next]}
            </Button>
          )}
          {o.status === "RECEIVED" && (
            <Button size="lg" variant="outline" onClick={() => setCancelling("REJECTED")}>
              Reject
            </Button>
          )}
          {!isTerminal(o.status) && o.status !== "RECEIVED" && o.status !== "PENDING_PAYMENT" && (
            <Button size="lg" variant="ghost" onClick={() => setCancelling("CANCELLED")}>
              Cancel order
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print ticket
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items — the kitchen ticket */}
        <section className="rounded-[16px] border border-black-iron/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 lg:col-span-2">
          <h2 className="text-[16px] font-semibold text-black-iron">Items</h2>
          <ul className="mt-4 divide-y divide-black-iron/[0.06]">
            {o.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-4 py-3">
                <div className="text-[16px] text-black-iron">
                  <span className="font-bold tabular-nums text-terracotta-ink">{i.quantity}×</span> {i.name}
                  {i.portion && <span className="text-dark-grey"> ({i.portion})</span>}
                  {i.modifiers.length > 0 && <p className="pl-7 text-[13px] text-dark-grey">{i.modifiers.join(" · ")}</p>}
                  {i.notes && <p className="pl-7 text-[13px] italic text-cinnamon-bark">“{i.notes}”</p>}
                </div>
                <span className="shrink-0 tabular-nums text-black-iron/80">{formatFils(i.lineTotalFils)}</span>
              </li>
            ))}
          </ul>
          {o.notes && <p className="mt-3 rounded-sm bg-saffron-orange/[0.12] px-3 py-2 text-[14px] text-cinnamon-bark">Kitchen note: {o.notes}</p>}
          <p className="mt-3 text-[13px] text-dark-grey">{o.cutlery ? "Include cutlery and napkins" : "No cutlery"}</p>

          <dl className="mt-5 space-y-1.5 border-t border-black-iron/[0.08] pt-4 text-[14px]">
            <Line label="Subtotal" value={formatFils(o.subtotalFils)} />
            <Line label={`Delivery (${o.zoneName})`} value={formatFils(o.deliveryFeeFils)} />
            {o.serviceFeeFils > 0 && <Line label="Service fee" value={formatFils(o.serviceFeeFils)} />}
            {o.discountFils > 0 && <Line label={`Promo ${o.couponCode ?? ""}`} value={`−${formatFils(o.discountFils)}`} />}
            <Line label="VAT included" value={formatFils(o.vatFils)} muted />
            <div className="flex justify-between pt-2 text-[18px] font-bold text-black-iron">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatFils(o.totalFils)}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          {/* Payment */}
          <section className="rounded-[16px] border border-black-iron/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5">
            <h2 className="text-[16px] font-semibold text-black-iron">Payment</h2>
            <p className="mt-3 text-[16px] font-semibold text-black-iron">{PAYMENT_METHOD_LABEL[o.paymentMethod]}</p>
            <p className={cn("text-[14px]", o.paymentStatus === "PAID" ? "text-olive-leaf" : "text-cinnamon-bark")}>
              {PAYMENT_LABEL[o.paymentStatus]}
              {o.paymentStatus === "PAY_ON_DELIVERY" && ` — collect ${formatFils(o.totalFils)}`}
            </p>
            {o.paymentStatus === "PAY_ON_DELIVERY" && (
              <Button size="sm" variant="secondary" className="mt-3 print:hidden" disabled={busy} onClick={() => run({ action: "markPaid" }, "Marked as paid")}>
                Mark as paid
              </Button>
            )}
          </section>

          {/* Customer & address */}
          <section className="rounded-[16px] border border-black-iron/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5">
            <h2 className="text-[16px] font-semibold text-black-iron">Customer</h2>
            <p className="mt-3 text-[16px] font-semibold text-black-iron">{o.customerName}</p>
            <p className="text-[12.5px] text-dark-grey">
              {o.previousOrders > 0 ? `${o.previousOrders} previous delivered order${o.previousOrders > 1 ? "s" : ""}` : "First order"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 print:hidden">
              <a href={`tel:${o.customerPhone}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-black-iron/15 px-3.5 text-[13px] text-black-iron">
                <Phone className="h-4 w-4" /> {formatUaeMobile(o.customerPhone)}
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
            <p className="mt-1 hidden text-[14px] text-black-iron print:block">{formatUaeMobile(o.customerPhone)}</p>
            {o.customerEmail && <p className="mt-2 text-[13px] text-dark-grey">{o.customerEmail}</p>}

            <div className="mt-5 border-t border-black-iron/[0.08] pt-4 text-[14px] leading-relaxed text-black-iron">
              <p className="capitalize text-dark-grey">{o.addressType}</p>
              <p>{[o.unit && `Unit ${o.unit}`, o.floor && `Floor ${o.floor}`].filter(Boolean).join(", ")}</p>
              <p className="font-semibold">{o.building}</p>
              {o.street && <p>{o.street}</p>}
              <p>{o.areaName}</p>
              {o.instructions && <p className="mt-2 text-cinnamon-bark">“{o.instructions}”</p>}
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 text-[13px] text-terracotta-ink print:hidden">
                <MapPin className="h-4 w-4" /> Open in Maps {o.lat != null && "(customer shared location)"}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </section>

          {/* Delivery */}
          <section className="rounded-[16px] border border-black-iron/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 print:hidden">
            <h2 className="text-[16px] font-semibold text-black-iron">Delivery</h2>
            <p className="mt-3 text-[14px] text-black-iron">
              Promised {o.etaMin}–{o.etaMax} min · by{" "}
              {dubaiTime(new Date(new Date(o.placedAt).getTime() + o.etaMax * 60000).toISOString())}
            </p>
            {(o.driverName || o.deliveryRef) && (
              <p className="mt-1 text-[13px] text-dark-grey">
                {o.deliveryProvider === "courier" ? "Courier" : "Rider"}: {[o.driverName, o.driverPhone, o.deliveryRef].filter(Boolean).join(" · ")}
              </p>
            )}
            {!isTerminal(o.status) && (
              <Button size="sm" variant="secondary" className="mt-3" disabled={busy} onClick={() => run({ action: "delay", minutes: 10 }, "Estimate updated")}>
                <Clock className="h-3.5 w-3.5" /> Running late +10 min
              </Button>
            )}
            <a href={`/order/track/${o.trackingToken}`} target="_blank" rel="noopener noreferrer" className="mt-3 block text-[12.5px] text-dark-grey underline">
              Customer&apos;s tracking page
            </a>
          </section>
        </div>
      </div>

      {/* Timeline */}
      <section className="rounded-[16px] border border-black-iron/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 print:hidden">
        <h2 className="text-[16px] font-semibold text-black-iron">Timeline</h2>
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (note.trim() && (await run({ action: "note", message: note.trim() }, "Note added"))) setNote("");
          }}
        >
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note (not visible to the customer)" maxLength={500} />
          <Button type="submit" variant="secondary" disabled={!note.trim() || busy}>
            Add
          </Button>
        </form>
        <ol className="mt-4 space-y-3">
          {o.events.map((e) => (
            <li key={e.id} className="flex gap-4 text-[13.5px]">
              <span className="w-28 shrink-0 tabular-nums text-dark-grey">{dubaiTime(e.createdAt, true)}</span>
              <span className="text-black-iron">
                {e.status && e.type === "status" ? <strong>{STAFF_LABEL[e.status]}</strong> : <strong className="capitalize">{e.type}</strong>}
                {e.message && <span className="text-black-iron/80"> — {e.message}</span>}
                <span className="block text-[11.5px] text-dark-grey">{e.actor}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <ReasonDialog
        open={!!cancelling}
        onOpenChange={(v) => !v && setCancelling(null)}
        title={cancelling === "REJECTED" ? `Reject ${o.number}?` : `Cancel ${o.number}?`}
        confirmLabel={cancelling === "REJECTED" ? "Reject order" : "Cancel order"}
        onConfirm={async (reason) => {
          if (cancelling && (await run({ action: "status", to: cancelling, reason }, STAFF_LABEL[cancelling]))) setCancelling(null);
        }}
      />
      {dispatching && (
        <DispatchDialog
          open
          onOpenChange={(v) => !v && setDispatching(false)}
          providers={providers}
          onConfirm={async (d) => {
            if (await run({ action: "status", to: "OUT_FOR_DELIVERY", dispatch: d }, "Dispatched")) setDispatching(false);
          }}
        />
      )}
    </div>
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
