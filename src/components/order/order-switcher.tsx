"use client";
import * as React from "react";
import Link from "next/link";
import { recentOrders, type RecentOrder } from "@/components/order/cart-store";
import { cn } from "@/lib/utils";

/*
 * On the tracking page: remembers this order on the device (so one opened
 * from an email link shows up too) and, when the customer has placed
 * more than one order recently, lets them jump between them.
 */
export function OrderSwitcher({ current }: { current: RecentOrder }) {
  const [orders, setOrders] = React.useState<RecentOrder[]>([]);
  const { number, token, placedAt } = current;

  React.useEffect(() => {
    recentOrders.add({ number, token, placedAt });
    const shown = recentOrders.shown();
    // localStorage is only readable after mount; one update, no loop.
    queueMicrotask(() => setOrders(shown));
  }, [number, token, placedAt]);

  if (orders.length < 2) return null;
  return (
    <nav aria-label="Your orders" className="container-shazdeh mt-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-dark-grey">Your orders</p>
      <ul className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
        {orders.map((o) => {
          const active = o.token === token;
          return (
            <li key={o.token} className="shrink-0">
              <Link
                href={`/order/track/${o.token}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-full border px-4 text-[13px] font-medium tabular-nums transition-colors",
                  active
                    ? "border-black-iron bg-black-iron text-warm-white"
                    : "border-black-iron/15 text-black-iron hover:border-black-iron/40",
                )}
              >
                {o.number}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
