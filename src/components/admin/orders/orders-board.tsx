"use client";
import * as React from "react";
import Link from "next/link";
import { BellRing, Banknote, Check, CreditCard, Loader2, Phone, Printer, Search, Utensils } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  DispatchDialog,
  ReasonDialog,
  patchOrder,
  type DispatchProviderOption,
} from "@/components/admin/orders/order-actions";
import { claimPrint, printTickets, useAutoPrint } from "@/components/admin/orders/print-tickets";
import type { BoardOrder } from "@/lib/ordering/admin";
import { formatFils } from "@/lib/ordering/money";
import { formatUaeMobile } from "@/lib/ordering/phone";
import { STAFF_ACTION, STAFF_LABEL, nextStatus, type OrderStatusValue } from "@/lib/ordering/status";
import { cn } from "@/lib/utils";

/*
 * The kitchen board. Designed to be read across a counter: the order
 * number, how long it's been waiting, who it's for, what to cook, and
 * one button for the next step. Polls every 8 seconds. The alarm itself
 * (sound, notifications, wake lock, auto-print) is admin-wide — see
 * order-alarm.tsx.
 */

const POLL_MS = 8000;

/** Tells the admin-wide alarm to re-check right away. */
function ordersChanged() {
  window.dispatchEvent(new Event("shazdeh:orders-changed"));
}

type BoardData = {
  orders: BoardOrder[];
  counts: { new: number; unseen: number; active: number };
  acceptingOrders: boolean;
  serverTime: string;
  pages: number;
  total: number;
};

const COLUMNS: { title: string; statuses: OrderStatusValue[] }[] = [
  { title: "New", statuses: ["RECEIVED"] },
  { title: "In the kitchen", statuses: ["CONFIRMED", "PREPARING"] },
  { title: "Ready", statuses: ["READY"] },
  { title: "Out for delivery", statuses: ["OUT_FOR_DELIVERY"] },
];

function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export function OrdersBoard({ initial, providers }: { initial: BoardData; providers: DispatchProviderOption[] }) {
  const [view, setView] = React.useState<"active" | "done" | "history">("active");
  const [data, setData] = React.useState<BoardData>(initial);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [now, setNow] = React.useState(() => Date.now());
  const [autoPrint, setAutoPrint] = useAutoPrint();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [rejecting, setRejecting] = React.useState<BoardOrder | null>(null);
  const [dispatching, setDispatching] = React.useState<BoardOrder | null>(null);
  const [mobileCol, setMobileCol] = React.useState(0);

  const load = React.useCallback(async () => {
    const params = new URLSearchParams({ view });
    if (view === "history") {
      if (q.trim()) params.set("q", q.trim());
      params.set("page", String(page));
    }
    try {
      const res = await fetch(`/api/admin/orders?${params}`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login?from=/admin/orders";
        return;
      }
      if (!res.ok) return;
      setData((await res.json()) as BoardData);
    } catch {
      /* offline — keep showing the last board */
    }
  }, [view, q, page]);

  React.useEffect(() => {
    // Fetch now (fresh data for the selected tab), then keep polling.
    const first = setTimeout(() => load().finally(() => setLoading(false)), 0);
    const t = setInterval(() => {
      load();
      setNow(Date.now());
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  async function act(order: BoardOrder, to: OrderStatusValue, extra: Record<string, unknown> = {}) {
    setBusyId(order.id);
    const okay = await patchOrder(order.id, { action: "status", to, ...extra });
    if (okay) {
      toast.success(`${order.number} → ${STAFF_LABEL[to]}`);
      ordersChanged();
      await load();
    }
    setBusyId(null);
    return okay;
  }

  async function acknowledge(order: BoardOrder) {
    setBusyId(order.id);
    if (await patchOrder(order.id, { action: "ack" })) {
      ordersChanged();
      await load();
    }
    setBusyId(null);
  }

  async function toggleAccepting(value: boolean) {
    const res = await fetch("/api/admin/ordering/accepting", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptingOrders: value, pausedMessage: value ? null : "We're very busy right now — please check back shortly." }),
    });
    if (res.ok) {
      setData((d) => ({ ...d, acceptingOrders: value }));
      toast.success(value ? "Now accepting orders" : "Online ordering paused");
    } else toast.error("Couldn't change ordering status");
  }

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="flex flex-col gap-3 rounded-[16px] border border-black-iron/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-3">
          <Switch checked={data.acceptingOrders} onCheckedChange={toggleAccepting} />
          <span>
            <span className={cn("block text-[15px] font-semibold", data.acceptingOrders ? "text-olive-leaf" : "text-pomegranate-red")}>
              {data.acceptingOrders ? "Accepting online orders" : "Online ordering paused"}
            </span>
            <span className="block text-[12px] text-dark-grey">Pause when the kitchen is overloaded.</span>
          </span>
        </label>
        <div className="flex flex-col gap-2 sm:items-end">
          <span
            className={cn(
              "inline-flex items-center gap-2 text-[12px] font-medium",
              data.counts.unseen > 0 ? "text-terracotta-ink" : "text-olive-leaf",
            )}
          >
            <BellRing className={cn("h-4 w-4", data.counts.unseen > 0 && "animate-pulse")} />
            {data.counts.unseen > 0 ? "Ringing — accept, or tap “Got it”, to stop" : "Order alarm on"}
          </span>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-black-iron/80">
            <Switch checked={autoPrint} onCheckedChange={setAutoPrint} />
            <Printer className="h-4 w-4" /> Print tickets automatically on this device
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {(
          [
            ["active", `Active · ${data.counts.active}`],
            ["done", "Completed today"],
            ["history", "History"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={view === key}
            onClick={() => {
              if (key !== view) setLoading(true);
              setView(key);
              setPage(1);
            }}
            className={cn(
              "h-10 shrink-0 rounded-pill px-4 text-[11px] font-medium uppercase tracking-[0.2em]",
              view === key ? "bg-terracotta text-white" : "border border-black-iron/15 text-black-iron/80",
            )}
          >
            {label}
          </button>
        ))}
        {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin self-center text-dark-grey" />}
      </div>

      {view === "active" ? (
        <>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar lg:hidden">
            {COLUMNS.map((c, i) => {
              const n = data.orders.filter((o) => c.statuses.includes(o.status)).length;
              return (
                <button
                  key={c.title}
                  onClick={() => setMobileCol(i)}
                  className={cn(
                    "h-10 shrink-0 rounded-md px-3 text-[13px]",
                    mobileCol === i ? "bg-black-iron text-black-iron" : "bg-black-iron/[0.05] text-black-iron/80",
                  )}
                >
                  {c.title} <span className="tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((c, i) => {
              const orders = data.orders.filter((o) => c.statuses.includes(o.status));
              return (
                <section key={c.title} className={cn("space-y-3", mobileCol !== i && "max-lg:hidden")} aria-label={c.title}>
                  <h2 className="hidden items-center justify-between text-[11px] font-medium uppercase tracking-[0.22em] text-dark-grey lg:flex">
                    {c.title}
                    <span className="tabular-nums">{orders.length}</span>
                  </h2>
                  {orders.length === 0 && (
                    <p className="rounded-[16px] border border-dashed border-black-iron/15 px-4 py-8 text-center text-[13px] text-dark-grey">
                      Nothing here
                    </p>
                  )}
                  {orders.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      now={now}
                      busy={busyId === o.id}
                      onNext={(to) => (to === "OUT_FOR_DELIVERY" ? setDispatching(o) : act(o, to))}
                      onReject={() => setRejecting(o)}
                      onAck={() => acknowledge(o)}
                    />
                  ))}
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {view === "history" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                load();
              }}
              className="relative max-w-md"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-grey" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order number, phone or name" className="pl-10" />
            </form>
          )}
          <HistoryTable orders={data.orders} />
          {view === "history" && data.pages > 1 && (
            <div className="flex items-center gap-3 text-[13px] text-black-iron/80">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="min-h-10 px-3 disabled:opacity-30">
                ← Newer
              </button>
              <span className="tabular-nums">
                Page {page} of {data.pages}
              </span>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="min-h-10 px-3 disabled:opacity-30">
                Older →
              </button>
            </div>
          )}
        </div>
      )}

      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title={`Reject ${rejecting?.number ?? ""}?`}
        confirmLabel="Reject order"
        onConfirm={async (reason) => {
          if (rejecting && (await act(rejecting, "REJECTED", { reason }))) setRejecting(null);
        }}
      />
      {dispatching && (
        <DispatchDialog
          open
          onOpenChange={(o) => !o && setDispatching(null)}
          providers={providers}
          onConfirm={async (d) => {
            if (await act(dispatching, "OUT_FOR_DELIVERY", { dispatch: d })) setDispatching(null);
          }}
        />
      )}
    </div>
  );
}

function PaymentBadge({ order }: { order: BoardOrder }) {
  const paid = order.paymentStatus === "PAID";
  const Icon = order.paymentMethod === "CASH_ON_DELIVERY" ? Banknote : CreditCard;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        paid ? "bg-olive-leaf/[0.12] text-olive-leaf" : "bg-saffron-orange/[0.16] text-cinnamon-bark",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
      {paid ? "Paid" : order.paymentMethod === "CASH_ON_DELIVERY" ? "Collect cash" : "Card at door"}
    </span>
  );
}

function OrderCard({
  order: o,
  now,
  busy,
  onNext,
  onReject,
  onAck,
}: {
  order: BoardOrder;
  now: number;
  busy: boolean;
  onNext: (to: OrderStatusValue) => void;
  onReject: () => void;
  onAck: () => void;
}) {
  const waited = minutesSince(o.placedAt, now);
  const next = nextStatus(o.status);
  const late = waited > o.etaMax;
  const unseen = o.status === "RECEIVED" || !o.seenAt;
  const urgent = unseen && waited >= 5;
  return (
    <article
      className={cn(
        "rounded-[16px] border bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        unseen ? "border-terracotta/60 shadow-[0_0_0_1px_rgba(206,73,39,0.35)]" : "border-black-iron/[0.08]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/admin/orders/${o.id}`} className="whitespace-nowrap text-[20px] font-bold tabular-nums tracking-[-0.02em] text-black-iron hover:text-terracotta-ink">
            {o.number}
          </Link>
          <p className="mt-0.5 text-[14px] font-semibold text-black-iron">{o.customerName}</p>
          <a href={`tel:${o.customerPhone}`} className="inline-flex min-h-8 items-center gap-1.5 text-[13px] tabular-nums text-terracotta-ink">
            <Phone className="h-3.5 w-3.5" /> {formatUaeMobile(o.customerPhone)}
          </a>
          <p className="text-[12.5px] text-dark-grey">{o.areaName}</p>
        </div>
        <div className="text-right">
          <p className={cn("text-[13px] font-semibold tabular-nums", urgent || late ? "text-terracotta-ink" : "text-black-iron/80")}>
            {waited} min
          </p>
          <p className="text-[11px] text-dark-grey">{STAFF_LABEL[o.status]}</p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-black-iron/[0.06] pt-3 text-[14px] text-black-iron">
        {o.items.map((i, idx) => (
          <li key={idx}>
            <span className="font-bold tabular-nums text-terracotta-ink">{i.quantity}×</span> {i.name}
            {i.portion && <span className="text-dark-grey"> ({i.portion})</span>}
            {i.modifiers.length > 0 && <span className="block pl-6 text-[12.5px] text-dark-grey">{i.modifiers.join(" · ")}</span>}
            {i.notes && <span className="block pl-6 text-[12.5px] italic text-cinnamon-bark">“{i.notes}”</span>}
          </li>
        ))}
      </ul>
      {o.notes && (
        <p className="mt-2 rounded-sm bg-saffron-orange/[0.12] px-2.5 py-1.5 text-[12.5px] text-cinnamon-bark">Note: {o.notes}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PaymentBadge order={o} />
        <span className="text-[13px] font-semibold tabular-nums text-black-iron">{formatFils(o.totalFils)}</span>
        {o.cutlery && (
          <span className="inline-flex items-center gap-1 text-[11px] text-dark-grey">
            <Utensils className="h-3 w-3" /> Cutlery
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {unseen && o.status !== "RECEIVED" && (
          <button
            type="button"
            disabled={busy}
            onClick={onAck}
            className="flex min-h-12 items-center justify-center gap-1.5 rounded-md bg-black-iron px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Got it
          </button>
        )}
        {next && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onNext(next)}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-terracotta px-3 text-[13px] font-semibold text-white hover:bg-terracotta-ink disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {STAFF_ACTION[next]}
          </button>
        )}
        {o.status === "RECEIVED" && (
          <button
            type="button"
            onClick={onReject}
            className="min-h-12 rounded-md border border-black-iron/15 px-4 text-[13px] text-black-iron/80 hover:border-pomegranate-red hover:text-pomegranate-red"
          >
            Reject
          </button>
        )}
        <button
          type="button"
          aria-label={`Print tickets for ${o.number}`}
          title="Print kitchen + delivery tickets"
          onClick={() => {
            void claimPrint(o.id);
            void printTickets(o.id);
          }}
          className="grid min-h-12 w-12 shrink-0 place-items-center rounded-md border border-black-iron/15 text-black-iron/80 hover:border-black-iron/40"
        >
          <Printer className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function HistoryTable({ orders }: { orders: BoardOrder[] }) {
  if (orders.length === 0) {
    return <p className="rounded-[16px] border border-black-iron/[0.07] bg-white py-16 text-center text-[14px] text-dark-grey">No orders.</p>;
  }
  return (
    <div className="overflow-hidden rounded-[16px] border border-black-iron/[0.07] bg-white">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-black-iron/[0.08] text-[10px] uppercase tracking-[0.2em] text-dark-grey">
          <tr>
            <th className="px-4 py-3 font-medium">Order</th>
            <th className="px-4 py-3 font-medium max-md:hidden">Placed</th>
            <th className="px-4 py-3 font-medium max-sm:hidden">Customer</th>
            <th className="px-4 py-3 font-medium max-lg:hidden">Phone</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black-iron/[0.06]">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-black-iron/[0.03]">
              <td className="px-4 py-3">
                <Link href={`/admin/orders/${o.id}`} className="font-semibold tabular-nums text-black-iron hover:text-terracotta-ink">
                  {o.number}
                </Link>
              </td>
              <td className="px-4 py-3 tabular-nums text-dark-grey max-md:hidden">
                {new Date(o.placedAt).toLocaleString("en-AE", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" })}
              </td>
              <td className="px-4 py-3 text-black-iron/80 max-sm:hidden">
                {o.customerName} · {o.areaName}
              </td>
              <td className="px-4 py-3 tabular-nums max-lg:hidden">
                <a href={`tel:${o.customerPhone}`} className="text-black-iron/80 hover:text-terracotta-ink">
                  {formatUaeMobile(o.customerPhone)}
                </a>
              </td>
              <td className="px-4 py-3 text-black-iron/80">{STAFF_LABEL[o.status]}</td>
              <td className="px-4 py-3 text-right tabular-nums text-black-iron">{formatFils(o.totalFils)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
