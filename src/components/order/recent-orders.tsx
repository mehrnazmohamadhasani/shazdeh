"use client";
import * as React from "react";
import Link from "next/link";
import { recentOrders, type RecentOrder } from "@/components/order/cart-store";
import type { TrackingSummary } from "@/lib/ordering/orders";
import { CUSTOMER_STEPS, isTerminal, type OrderStatusValue } from "@/lib/ordering/status";
import { cn } from "@/lib/utils";

/*
 * "Track your order" on the order page, for every order this device
 * placed in the last few hours — not just the newest. Statuses come from
 * the server; delivered, cancelled and rejected orders drop off the list.
 */

const REFRESH_MS = 30_000;

export function customerStatusLabel(status: OrderStatusValue): string {
  if (status === "PENDING_PAYMENT") return "Awaiting payment";
  return CUSTOMER_STEPS.find((s) => s.status === status)?.label ?? "";
}

function clock(iso: string) {
  return new Intl.DateTimeFormat("en-AE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" }).format(
    new Date(iso),
  );
}

type Row = RecentOrder & { status: OrderStatusValue | null };

export function RecentOrders() {
  const [rows, setRows] = React.useState<Row[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const local = recentOrders.shown();
      if (local.length === 0) {
        if (!cancelled) setRows([]);
        return;
      }
      let next: Row[];
      try {
        const res = await fetch("/api/orders/track/statuses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokens: local.map((o) => o.token) }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const { orders } = (await res.json()) as { orders: TrackingSummary[] };
        const byToken = new Map(orders.map((o) => [o.token, o]));
        next = local
          .filter((o) => byToken.has(o.token))
          .map((o) => ({ ...o, status: byToken.get(o.token)!.status }))
          .filter((o) => !isTerminal(o.status!));
      } catch {
        // Offline or the server is busy: still offer the links, without a status.
        next = local.map((o) => ({ ...o, status: null }));
      }
      if (!cancelled) setRows(next);
    }
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (rows.length === 0) return null;

  if (rows.length === 1) {
    const o = rows[0];
    return (
      <Link
        href={`/order/track/${o.token}`}
        className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-[14px] bg-black-iron px-4 text-[13.5px] text-warm-white md:max-w-3xl"
      >
        <span>
          Track your order <strong className="tabular-nums">{o.number}</strong>
          {o.status && <span className="text-warm-white/65"> · {customerStatusLabel(o.status)}</span>}
        </span>
        <span aria-hidden>→</span>
      </Link>
    );
  }

  return (
    <nav aria-label="Your orders" className="mt-3 overflow-hidden rounded-[14px] bg-black-iron text-warm-white md:max-w-3xl">
      <p className="px-4 pt-3 text-[11px] font-medium uppercase tracking-[0.22em] text-apricot-clay">
        Your orders · {rows.length}
      </p>
      <ul className="mt-1">
        {rows.map((o, i) => (
          <li key={o.token}>
            <Link
              href={`/order/track/${o.token}`}
              className={cn(
                "flex min-h-12 items-center justify-between gap-3 px-4 text-[13.5px] transition-colors hover:bg-warm-white/[0.06]",
                i > 0 && "border-t border-warm-white/10",
              )}
            >
              <span className="min-w-0">
                <strong className="tabular-nums">{o.number}</strong>
                <span className="text-warm-white/65 tabular-nums"> · {clock(o.placedAt)}</span>
                {o.status && <span className="text-warm-white/65"> · {customerStatusLabel(o.status)}</span>}
              </span>
              <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
