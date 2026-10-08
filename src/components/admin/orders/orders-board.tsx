"use client";
import * as React from "react";
import Link from "next/link";
import { Bell, BellOff, BellRing, Banknote, CreditCard, Loader2, Search, Utensils } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  DispatchDialog,
  ReasonDialog,
  patchOrder,
  playChime,
  type DispatchProviderOption,
} from "@/components/admin/orders/order-actions";
import { notifyNewOrder, requestNotifications, useWakeLock } from "@/components/admin/orders/kitchen-alerts";
import type { BoardOrder } from "@/lib/ordering/admin";
import { formatFils } from "@/lib/ordering/money";
import { STAFF_ACTION, STAFF_LABEL, nextStatus, type OrderStatusValue } from "@/lib/ordering/status";
import { cn } from "@/lib/utils";

/*
 * The kitchen board. Designed to be read across a counter: the order
 * number, how long it's been waiting, what to cook, and one button for
 * the next step. Polls every 8 seconds. With alerts on, a new order rings
 * until it is accepted (from any device), pops a desktop notification,
 * and the screen is kept awake.
 */

const POLL_MS = 8000;
// Gap between chimes while an order waits to be accepted.
const ALARM_MS = 3000;

type BoardData = {
  orders: BoardOrder[];
  counts: { new: number; active: number };
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
  const [sound, setSound] = React.useState(false);
  const audio = React.useRef<AudioContext | null>(null);
  const seen = React.useRef(new Set(initial.orders.filter((o) => o.status === "RECEIVED").map((o) => o.id)));
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
      const next = (await res.json()) as BoardData;
      if (view === "active") {
        const fresh = next.orders.filter((o) => o.status === "RECEIVED" && !seen.current.has(o.id));
        if (fresh.length) {
          fresh.forEach((o) => seen.current.add(o.id));
          const title = `New order ${fresh[0].number}${fresh.length > 1 ? ` (+${fresh.length - 1})` : ""}`;
          const description = `${fresh[0].areaName} · ${formatFils(fresh[0].totalFils)}`;
          toast(title, { description });
          void notifyNewOrder(title, description, `order-${fresh[0].id}`);
        }
      }
      setData(next);
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

  // Tab title shows waiting orders, so a backgrounded tab still nags.
  React.useEffect(() => {
    document.title = data.counts.new > 0 ? `(${data.counts.new}) New orders · Atelier` : "Orders · Atelier";
  }, [data.counts.new]);

  // Ring until nothing is waiting in "New" — accepting (or rejecting) the
  // last one, here or on another device, stops it on the next poll.
  const ringing = sound && data.counts.new > 0;
  React.useEffect(() => {
    if (!ringing) return;
    const ring = () => {
      const ctx = audio.current;
      if (!ctx) return;
      // iOS suspends audio after interruptions (calls, Siri).
      void ctx.resume().then(() => playChime(ctx));
    };
    ring();
    const t = setInterval(ring, ALARM_MS);
    return () => clearInterval(t);
  }, [ringing]);

  const awake = useWakeLock(sound);

  function enableSound() {
    if (!audio.current) audio.current = new AudioContext();
    void audio.current.resume();
    playChime(audio.current);
    setSound(true);
    // Same click, so the browser allows the permission prompt.
    void requestNotifications();
  }

  async function act(order: BoardOrder, to: OrderStatusValue, extra: Record<string, unknown> = {}) {
    setBusyId(order.id);
    const okay = await patchOrder(order.id, { action: "status", to, ...extra });
    if (okay) {
      toast.success(`${order.number} → ${STAFF_LABEL[to]}`);
      await load();
    }
    setBusyId(null);
    return okay;
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
      <div className="flex flex-col gap-3 rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-3">
          <Switch checked={data.acceptingOrders} onCheckedChange={toggleAccepting} />
          <span>
            <span className={cn("block text-[15px] font-semibold", data.acceptingOrders ? "text-olive-leaf brightness-150" : "text-pomegranate-red brightness-150")}>
              {data.acceptingOrders ? "Accepting online orders" : "Online ordering paused"}
            </span>
            <span className="block text-[12px] text-warm-white/55">Pause when the kitchen is overloaded.</span>
          </span>
        </label>
        <button
          type="button"
          onClick={() => (sound ? setSound(false) : enableSound())}
          aria-pressed={sound}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[12px] font-medium",
            sound ? "border-terracotta/50 text-terracotta" : "border-warm-white/20 text-warm-white/80",
          )}
        >
          {ringing ? (
            <BellRing className="h-4 w-4 animate-pulse" />
          ) : sound ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
          {ringing
            ? "Ringing — accept the order to stop"
            : sound
              ? `Alerts on${awake ? " · screen stays awake" : ""}`
              : "Turn on new-order alerts"}
        </button>
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
              view === key ? "bg-terracotta text-white" : "border border-warm-white/15 text-warm-white/70",
            )}
          >
            {label}
          </button>
        ))}
        {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin self-center text-warm-white/50" />}
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
                    mobileCol === i ? "bg-warm-white text-black-iron" : "bg-warm-white/[0.05] text-warm-white/70",
                  )}
                >
                  {c.title} <span className="tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            {COLUMNS.map((c, i) => {
              const orders = data.orders.filter((o) => c.statuses.includes(o.status));
              return (
                <section key={c.title} className={cn("space-y-3", mobileCol !== i && "max-lg:hidden")} aria-label={c.title}>
                  <h2 className="hidden items-center justify-between text-[11px] font-medium uppercase tracking-[0.22em] text-warm-white/55 lg:flex">
                    {c.title}
                    <span className="tabular-nums">{orders.length}</span>
                  </h2>
                  {orders.length === 0 && (
                    <p className="rounded-md border border-dashed border-warm-white/10 px-4 py-8 text-center text-[13px] text-warm-white/40">
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
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-white/45" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order number, phone or name" className="pl-10" />
            </form>
          )}
          <HistoryTable orders={data.orders} />
          {view === "history" && data.pages > 1 && (
            <div className="flex items-center gap-3 text-[13px] text-warm-white/70">
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
        paid ? "bg-olive-leaf/30 text-warm-white" : "bg-saffron-orange/20 text-saffron-orange",
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
}: {
  order: BoardOrder;
  now: number;
  busy: boolean;
  onNext: (to: OrderStatusValue) => void;
  onReject: () => void;
}) {
  const waited = minutesSince(o.placedAt, now);
  const next = nextStatus(o.status);
  const late = waited > o.etaMax;
  const urgent = o.status === "RECEIVED" && waited >= 5;
  return (
    <article
      className={cn(
        "rounded-md border bg-warm-white/[0.03] p-4",
        o.status === "RECEIVED" ? "border-terracotta/60 shadow-[0_0_0_1px_rgba(206,73,39,0.35)]" : "border-warm-white/[0.08]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/admin/orders/${o.id}`} className="text-[20px] font-bold tabular-nums tracking-[-0.02em] text-warm-white hover:text-terracotta">
            {o.number}
          </Link>
          <p className="mt-0.5 text-[12.5px] text-warm-white/60">
            {o.customerName.split(" ")[0]} · {o.areaName}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("text-[13px] font-semibold tabular-nums", urgent || late ? "text-terracotta" : "text-warm-white/80")}>
            {waited} min
          </p>
          <p className="text-[11px] text-warm-white/45">{STAFF_LABEL[o.status]}</p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-warm-white/[0.06] pt-3 text-[14px] text-warm-white">
        {o.items.map((i, idx) => (
          <li key={idx}>
            <span className="font-bold tabular-nums text-terracotta">{i.quantity}×</span> {i.name}
            {i.portion && <span className="text-warm-white/60"> ({i.portion})</span>}
            {i.modifiers.length > 0 && <span className="block pl-6 text-[12.5px] text-warm-white/60">{i.modifiers.join(" · ")}</span>}
            {i.notes && <span className="block pl-6 text-[12.5px] italic text-saffron-orange">“{i.notes}”</span>}
          </li>
        ))}
      </ul>
      {o.notes && (
        <p className="mt-2 rounded-sm bg-saffron-orange/10 px-2.5 py-1.5 text-[12.5px] text-saffron-orange">Note: {o.notes}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PaymentBadge order={o} />
        <span className="text-[13px] font-semibold tabular-nums text-warm-white">{formatFils(o.totalFils)}</span>
        {o.cutlery && (
          <span className="inline-flex items-center gap-1 text-[11px] text-warm-white/55">
            <Utensils className="h-3 w-3" /> Cutlery
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-2">
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
            className="min-h-12 rounded-md border border-warm-white/15 px-4 text-[13px] text-warm-white/75 hover:border-pomegranate-red hover:text-white"
          >
            Reject
          </button>
        )}
      </div>
    </article>
  );
}

function HistoryTable({ orders }: { orders: BoardOrder[] }) {
  if (orders.length === 0) {
    return <p className="rounded-md border border-warm-white/[0.08] py-16 text-center text-[14px] text-warm-white/50">No orders.</p>;
  }
  return (
    <div className="overflow-hidden rounded-md border border-warm-white/[0.08]">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-warm-white/[0.08] text-[10px] uppercase tracking-[0.2em] text-warm-white/50">
          <tr>
            <th className="px-4 py-3 font-medium">Order</th>
            <th className="px-4 py-3 font-medium max-md:hidden">Placed</th>
            <th className="px-4 py-3 font-medium max-sm:hidden">Customer</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-warm-white/[0.06]">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-warm-white/[0.03]">
              <td className="px-4 py-3">
                <Link href={`/admin/orders/${o.id}`} className="font-semibold tabular-nums text-warm-white hover:text-terracotta">
                  {o.number}
                </Link>
              </td>
              <td className="px-4 py-3 tabular-nums text-warm-white/60 max-md:hidden">
                {new Date(o.placedAt).toLocaleString("en-AE", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" })}
              </td>
              <td className="px-4 py-3 text-warm-white/75 max-sm:hidden">
                {o.customerName} · {o.areaName}
              </td>
              <td className="px-4 py-3 text-warm-white/75">{STAFF_LABEL[o.status]}</td>
              <td className="px-4 py-3 text-right tabular-nums text-warm-white">{formatFils(o.totalFils)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
