"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { notifyNewOrder, requestNotifications, subscribePush, useWakeLock } from "@/components/admin/orders/kitchen-alerts";
import { claimPrint, printTickets, useAutoPrint } from "@/components/admin/orders/print-tickets";
import { formatFils } from "@/lib/ordering/money";

/*
 * The new-order alarm. Lives in the admin layout, so it rings on every
 * admin page, and it has no off switch: it rings until each new order is
 * accepted (or, when orders are auto-accepted, until someone taps
 * "Got it"), from any device.
 *
 * Browsers keep sound muted until the page is tapped once, so after a
 * full load a full-screen prompt asks for that tap; the same tap allows
 * system notifications and push. The screen is kept awake throughout.
 *
 * On the device with "Print tickets automatically" switched on, newly
 * accepted orders are printed here too.
 */

const POLL_MS = 8000;
const RING_MS = 3000;

type Alerts = {
  unseen: { id: string; number: string; customerName: string; areaName: string; totalFils: number }[];
  toPrint: { id: string; number: string }[];
};

/** Three loud tones — cuts through a kitchen, no audio file needed. */
function playAlarm(ctx: AudioContext) {
  const now = ctx.currentTime;
  [988, 1319, 988].forEach((freq, i) => {
    const t = now + i * 0.28;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.27);
  });
}

export function OrderAlarm({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const pathname = usePathname();
  const audio = React.useRef<AudioContext | null>(null);
  const [locked, setLocked] = React.useState(false);
  const [alerts, setAlerts] = React.useState<Alerts>({ unseen: [], toPrint: [] });
  const notified = React.useRef<Set<string> | null>(null);
  const printing = React.useRef(new Set<string>());
  const [autoPrint] = useAutoPrint();

  useWakeLock(true);

  // One audio context for the whole admin session (the layout persists
  // across page changes, so one tap lasts until a full reload).
  React.useEffect(() => {
    const ctx = new AudioContext();
    audio.current = ctx;
    const sync = () => setLocked(ctx.state !== "running");
    ctx.onstatechange = sync;
    sync();
    // Any tap or key anywhere unlocks it, not only the prompt's button.
    const unlock = () => void ctx.resume();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void ctx.close();
    };
  }, []);

  async function enable() {
    await audio.current?.resume();
    if (audio.current) playAlarm(audio.current);
    // Same tap, so the browser allows the permission prompt.
    if (await requestNotifications()) {
      if (vapidPublicKey) void subscribePush(vapidPublicKey, "/api/admin/push");
    }
  }

  // Already allowed on an earlier visit → keep this device's push registration fresh.
  React.useEffect(() => {
    if (vapidPublicKey && typeof Notification !== "undefined" && Notification.permission === "granted") {
      void subscribePush(vapidPublicKey, "/api/admin/push");
    }
  }, [vapidPublicKey]);

  const poll = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders/alerts", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as Alerts;
      // First poll: what's already waiting rings, but isn't announced again.
      const first = notified.current === null;
      const seen = (notified.current ??= new Set());
      const fresh = next.unseen.filter((o) => !seen.has(o.id));
      fresh.forEach((o) => seen.add(o.id));
      if (fresh.length && !first) {
        const o = fresh[0];
        const title = `New order ${o.number}${fresh.length > 1 ? ` (+${fresh.length - 1})` : ""}`;
        const description = `${o.customerName} · ${o.areaName} · ${formatFils(o.totalFils)}`;
        toast(title, { description });
        void notifyNewOrder(title, description, `order-${o.id}`);
      }
      setAlerts(next);
    } catch {
      /* offline — try again next tick */
    }
  }, []);

  React.useEffect(() => {
    const first = setTimeout(poll, 0);
    const t = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  // Pages that change an order (accept, "Got it") ask for an immediate re-check.
  React.useEffect(() => {
    const again = () => void poll();
    window.addEventListener("shazdeh:orders-changed", again);
    return () => window.removeEventListener("shazdeh:orders-changed", again);
  }, [poll]);

  const ringing = alerts.unseen.length > 0;
  React.useEffect(() => {
    if (!ringing) return;
    const ring = () => {
      const ctx = audio.current;
      if (!ctx || ctx.state !== "running") return;
      playAlarm(ctx);
    };
    ring();
    const t = setInterval(ring, RING_MS);
    return () => clearInterval(t);
  }, [ringing]);

  // Tab title nags even when the tab is in the background.
  React.useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = ringing ? `(${alerts.unseen.length}) ${base}` : base;
  }, [ringing, alerts.unseen.length, pathname]);

  React.useEffect(() => {
    if (!autoPrint) return;
    for (const o of alerts.toPrint) {
      if (printing.current.has(o.id)) continue;
      printing.current.add(o.id);
      void claimPrint(o.id).then((mine) => {
        if (mine) {
          toast(`Printing ${o.number}`);
          void printTickets(o.id);
        }
      });
    }
  }, [autoPrint, alerts.toPrint]);

  return (
    <>
      {ringing && (
        <div role="alert" className="z-40 flex items-center justify-between gap-3 bg-terracotta print:hidden lg:sticky lg:top-0 px-4 py-2.5 text-white md:px-8">
          <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold">
            <BellRing className="h-5 w-5 shrink-0 animate-pulse" />
            <span className="truncate">
              {alerts.unseen.length === 1
                ? `New order ${alerts.unseen[0].number} · ${alerts.unseen[0].customerName}`
                : `${alerts.unseen.length} new orders waiting`}
            </span>
          </span>
          {pathname !== "/admin/orders" && (
            <Link href="/admin/orders" className="shrink-0 rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-terracotta-ink">
              Open orders
            </Link>
          )}
        </div>
      )}
      {locked && (
        <div role="dialog" aria-modal="true" aria-labelledby="alarm-title" className="fixed inset-0 z-[100] grid place-items-center bg-black-iron/70 p-6">
          <button
            type="button"
            onClick={enable}
            autoFocus
            className="flex max-w-sm flex-col items-center gap-3 rounded-[20px] bg-white px-8 py-8 text-center shadow-xl"
          >
            <BellRing className="h-10 w-10 text-terracotta" />
            <span id="alarm-title" className="text-[20px] font-bold text-black-iron">
              Tap to switch on the order alarm
            </span>
            <span className="text-[13.5px] text-dark-grey">
              Your browser keeps sound off until you tap. The alarm rings for every new order until it is accepted.
            </span>
          </button>
        </div>
      )}
    </>
  );
}
