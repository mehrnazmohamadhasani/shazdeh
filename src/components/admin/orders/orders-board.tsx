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
// Remembers "alerts on" across reloads, per device.
const ALERTS_KEY = "shazdeh.kitchen.alerts";

function saveAlerts(on: boolean) {
  try {
    window.localStorage.setItem(ALERTS_KEY, on ? "on" : "off");
  } catch {
    // Private mode: alerts just won't survive a reload.
  }
}

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
  // Browsers keep audio muted after a reload until the first tap/key.
  const [audioLocked, setAudioLocked] = React.useState(false);
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
    document.title = data.counts.new > 0 ? `(${data.counts.new}) New orders · SHĀZDEH` : "Orders · SHĀZDEH Admin";
  }, [data.counts.new]);

  // Ring until nothing is waiting in "New" — accepting (or rejecting) the
  // last one, here or on another device, stops it on the next poll.
  const ringing = sound && data.counts.new > 0;
  React.useEffect(() => {
    if (!ringing) return;
    const ring = () => {
      const ctx = audio.current;
      // Still waiting for the first tap: skip, or the queued chimes would
      // all fire at once on unlock.
      if (!ctx || ctx.state === "suspended") return;
      // iOS pauses audio after interruptions (calls, Siri).
      void ctx.resume().then(() => playChime(ctx));
    };
    ring();
    const t = setInterval(ring, ALARM_MS);
    return () => clearInterval(t);
  }, [ringing]);

  const awake = useWakeLock(sound);

  /** Creates the audio context and tracks whether the browser has muted it. */
  const ensureAudio = React.useCallback(() => {
    if (!audio.current) {
      const ctx = new AudioContext();
      ctx.onstatechange = () => setAudioLocked(ctx.state === "suspended");
      audio.current = ctx;
    }
    return audio.current;
  }, []);

  // Alerts were on before the reload → turn them back on. Notifications
  // (already permitted) and the wake lock need no tap; sound does, so the
  // first tap or key press anywhere on the page unlocks it.
  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(ALERTS_KEY);
    } catch {}
    if (stored !== "on") return;

    const ctx = ensureAudio();
    const unlock = () => void ctx.resume();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    const t = setTimeout(() => {
      setSound(true);
      setAudioLocked(ctx.state === "suspended");
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [ensureAudio]);

  function enableSound() {
    const ctx = ensureAudio();
    void ctx.resume();
    playChime(ctx);
    setSound(true);
    saveAlerts(true);
    // Same click, so the browser allows the permission prompt.
    void requestNotifications();
  }

  function disableSound() {
    setSound(false);
    saveAlerts(false);
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
        <button
          type="button"
          onClick={() => (sound && !audioLocked ? disableSound() : enableSound())}
          aria-pressed={sound}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[12px] font-medium",
            sound ? "border-terracotta/50 text-terracotta-ink" : "border-black-iron/20 text-black-iron/80",
          )}
        >
          {ringing ? (
            <BellRing className="h-4 w-4 animate-pulse" />
          ) : sound ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
          {sound && audioLocked
            ? "Tap to unmute alerts"
            : ringing
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
          <div className="grid gap-4 lg:grid-cols-4">
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
        "rounded-[16px] border bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        o.status === "RECEIVED" ? "border-terracotta/60 shadow-[0_0_0_1px_rgba(206,73,39,0.35)]" : "border-black-iron/[0.08]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/admin/orders/${o.id}`} className="whitespace-nowrap text-[20px] font-bold tabular-nums tracking-[-0.02em] text-black-iron hover:text-terracotta-ink">
            {o.number}
          </Link>
          <p className="mt-0.5 text-[12.5px] text-dark-grey">
            {o.customerName.split(" ")[0]} · {o.areaName}
          </p>
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
              <td className="px-4 py-3 text-black-iron/80">{STAFF_LABEL[o.status]}</td>
              <td className="px-4 py-3 text-right tabular-nums text-black-iron">{formatFils(o.totalFils)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
