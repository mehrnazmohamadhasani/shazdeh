"use client";
import * as React from "react";
import Link from "next/link";
import { Bell, BellRing, Check, ExternalLink, Loader2, Phone, XCircle } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/social";
import { ArchLines } from "@/components/brand/arch";
import { cart } from "@/components/order/cart-store";
import { pushSupported, requestNotifications, subscribePush } from "@/components/admin/orders/kitchen-alerts";
import type { TrackingView } from "@/lib/ordering/orders";
import { formatFils } from "@/lib/ordering/money";
import { CUSTOMER_STEPS, PAYMENT_LABEL, PAYMENT_METHOD_LABEL, isTerminal } from "@/lib/ordering/status";
import { cn } from "@/lib/utils";

/*
 * Confirmation + live status in one place. It polls the backend every
 * few seconds while the order is in flight and shows only what the
 * backend actually knows — statuses staff set, the rider name if they
 * entered one, a courier's own tracking link if there is one. No fake
 * map dots.
 */

const POLL_MS = 12_000;

function clock(iso: string, addMinutes = 0) {
  return new Intl.DateTimeFormat("en-AE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Dubai",
  }).format(new Date(new Date(iso).getTime() + addMinutes * 60_000));
}

export function OrderTracker({
  token,
  initial,
  placed,
  whatsapp,
  phoneHref,
  vapidPublicKey,
}: {
  token: string;
  initial: TrackingView;
  placed: boolean;
  whatsapp?: string;
  phoneHref?: string;
  vapidPublicKey?: string | null;
}) {
  const [view, setView] = React.useState(initial);
  const [stale, setStale] = React.useState(false);
  const done = isTerminal(view.status);

  React.useEffect(() => {
    if (done) return;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/orders/track/${token}`, { cache: "no-store" });
          if (res.ok) {
            setView(await res.json());
            setStale(false);
          } else setStale(true);
        } catch {
          setStale(true);
        }
      }
      timer = setTimeout(poll, view.status === "PENDING_PAYMENT" ? 3000 : POLL_MS);
    }
    timer = setTimeout(poll, view.status === "PENDING_PAYMENT" ? 2000 : POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, done, view.status]);

  // The basket is kept through online payment; clear it once the order is real.
  React.useEffect(() => {
    if (placed && view.status !== "PENDING_PAYMENT" && view.status !== "CANCELLED") cart.clearLines();
  }, [placed, view.status]);

  const failed = view.status === "CANCELLED" || view.status === "REJECTED";
  const currentIndex = CUSTOMER_STEPS.findIndex((s) => s.status === view.status);
  const when = (status: string) => view.history.find((h) => h.status === status)?.at;

  return (
    <div className="pb-20">
      <section className="relative overflow-hidden bg-black-iron text-warm-white">
        <ArchLines count={3} className="absolute -bottom-10 right-[-6%] h-[120%] w-[46%] text-terracotta/30 md:right-[6%] md:w-[24%]" />
        <div className="container-shazdeh relative py-10 md:py-14">
          {view.status === "PENDING_PAYMENT" ? (
            <>
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-warm-white/70">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Confirming payment
              </p>
              <h1 className="mt-4 text-[2.25rem] font-bold leading-none tracking-[-0.04em] md:text-[3.5rem]">One moment…</h1>
              <p className="mt-3 max-w-md text-[15px] text-warm-white/75">
                We&apos;re waiting for the payment provider to confirm. This page updates by itself.
              </p>
            </>
          ) : failed ? (
            <>
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-apricot-clay">
                <XCircle className="h-4 w-4" strokeWidth={1.6} /> Order {view.number}
              </p>
              <h1 className="mt-4 text-[2.25rem] font-bold leading-none tracking-[-0.04em] md:text-[3.5rem]">
                {view.paymentStatus === "FAILED" ? "Payment didn't go through." : "We couldn't complete this order."}
              </h1>
              {view.reason && <p className="mt-3 max-w-md text-[15px] text-warm-white/80">{view.reason}</p>}
              {view.paymentStatus === "PAID" && (
                <p className="mt-3 max-w-md text-[14px] text-warm-white/80">
                  You paid online — we&apos;ll refund the full amount to your card.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-apricot-clay">
                {placed ? "Order placed · " : ""}
                <span className="tabular-nums">{view.number}</span>
              </p>
              <h1 className="mt-4 text-[2.25rem] font-bold leading-none tracking-[-0.04em] md:text-[3.5rem]">
                {view.status === "DELIVERED" ? (
                  <>Nooshe jan, {view.firstName}.</>
                ) : placed ? (
                  <>Thank you, {view.firstName}.</>
                ) : (
                  CUSTOMER_STEPS[currentIndex]?.label
                )}
              </h1>
              <p lang="fa" dir="rtl" className="mt-2 text-left text-[15px] text-warm-white/60">
                {view.status === "DELIVERED" ? "نوش جان" : "سفارش شما ثبت شد"}
              </p>
              <p className="mt-5 text-[15px] tabular-nums text-warm-white/85">
                {view.status === "DELIVERED" && view.deliveredAt ? (
                  <>Delivered at {clock(view.deliveredAt)}</>
                ) : (
                  <>
                    Estimated arrival{" "}
                    <strong className="font-semibold text-warm-white">
                      {clock(view.placedAt, view.etaMin)}–{clock(view.placedAt, view.etaMax)}
                    </strong>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </section>

      <div className="container-shazdeh mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          {!failed && view.status !== "PENDING_PAYMENT" && (
            <section aria-labelledby="status-h" className="rounded-[18px] border border-black-iron/10 bg-white/60 p-5 sm:p-6">
              <div className="flex items-baseline justify-between">
                <h2 id="status-h" className="text-[1.125rem] font-bold tracking-[-0.025em]">
                  Order status
                </h2>
                {!done && (
                  <span className="text-[11.5px] text-dark-grey">{stale ? "Reconnecting…" : "Updates automatically"}</span>
                )}
              </div>
              {!done && vapidPublicKey && <NotifyMe token={token} vapidPublicKey={vapidPublicKey} />}
              <ol className="mt-5" aria-live="polite">
                {CUSTOMER_STEPS.map((step, i) => {
                  const reached = i <= currentIndex;
                  const current = i === currentIndex;
                  const at = when(step.status);
                  return (
                    <li key={step.status} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < CUSTOMER_STEPS.length - 1 && (
                        <span
                          aria-hidden
                          className={cn("absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-0.5", i < currentIndex ? "bg-terracotta" : "bg-black-iron/10")}
                        />
                      )}
                      <span
                        aria-hidden
                        className={cn(
                          "relative grid h-7 w-7 shrink-0 place-items-center rounded-full border-2",
                          reached ? "border-terracotta bg-terracotta text-white" : "border-black-iron/15 bg-warm-white",
                        )}
                      >
                        {reached && !current && <Check className="h-3.5 w-3.5" strokeWidth={2.6} />}
                        {current && !done && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
                        {current && done && <Check className="h-3.5 w-3.5" strokeWidth={2.6} />}
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className={cn("text-[14.5px]", reached ? "font-semibold" : "text-dark-grey")}>
                          {step.label}
                          {current && <span className="sr-only"> (current)</span>}
                        </p>
                        {current && <p className="mt-0.5 text-[13px] text-dark-grey">{step.detail}</p>}
                        {current && step.status === "OUT_FOR_DELIVERY" && view.driverName && (
                          <p className="mt-0.5 text-[13px] text-dark-grey">Your rider: {view.driverName}</p>
                        )}
                        {current && step.status === "OUT_FOR_DELIVERY" && view.trackingUrl && (
                          <a
                            href={view.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-medium text-terracotta-ink underline underline-offset-4"
                          >
                            Live courier tracking <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} />
                          </a>
                        )}
                      </div>
                      {at && reached && <span className="ml-auto pt-1 text-[12px] tabular-nums text-dark-grey">{clock(at)}</span>}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section className="rounded-[18px] border border-black-iron/10 bg-white/60 p-5 sm:p-6">
            <h2 className="text-[1.125rem] font-bold tracking-[-0.025em]">Need help with this order?</h2>
            <p className="mt-1 text-[13.5px] text-dark-grey">
              Quote order <span className="font-semibold tabular-nums text-black-iron">{view.number}</span>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-black-iron px-5 text-[13px] font-medium text-warm-white"
                >
                  <WhatsappIcon className="h-4 w-4" /> WhatsApp us
                </a>
              )}
              {phoneHref && (
                <a href={phoneHref} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black-iron/20 px-5 text-[13px] font-medium">
                  <Phone className="h-4 w-4" strokeWidth={1.5} /> Call the kitchen
                </a>
              )}
              <Link href="/order" className="inline-flex min-h-11 items-center rounded-full border border-black-iron/20 px-5 text-[13px] font-medium">
                {failed ? "Back to the menu" : "Order something else"}
              </Link>
            </div>
          </section>
        </div>

        <aside aria-label="Receipt" className="rounded-[18px] border border-black-iron/10 bg-white/60 p-5 sm:p-6 lg:self-start">
          <h2 className="text-[1.125rem] font-bold tracking-[-0.025em]">Your order</h2>
          <dl className="mt-3 space-y-1 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-dark-grey">Deliver to</dt>
              <dd className="text-right">
                {view.addressLine}
                <br />
                {view.areaName}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-dark-grey">Payment</dt>
              <dd className="text-right">
                {PAYMENT_METHOD_LABEL[view.paymentMethod]} · {PAYMENT_LABEL[view.paymentStatus]}
              </dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-2.5 border-y border-black-iron/10 py-4 text-[13.5px]">
            {view.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="tabular-nums text-dark-grey">{i.quantity}×</span> {i.name}
                  {i.portion && <span className="text-dark-grey"> · {i.portion}</span>}
                  {i.modifiers.length > 0 && <span className="block text-[12px] text-dark-grey">{i.modifiers.join(" · ")}</span>}
                </span>
                <span className="shrink-0 tabular-nums">{formatFils(i.lineTotalFils)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 text-[13.5px]">
            <Row label="Subtotal" value={formatFils(view.subtotalFils)} />
            <Row label="Delivery" value={view.deliveryFeeFils === 0 ? "Free" : formatFils(view.deliveryFeeFils)} />
            {view.serviceFeeFils > 0 && <Row label="Service fee" value={formatFils(view.serviceFeeFils)} />}
            {view.discountFils > 0 && <Row label={`Promo ${view.couponCode ?? ""}`} value={`−${formatFils(view.discountFils)}`} />}
            {!view.pricesIncludeVat && <Row label="VAT" value={formatFils(view.vatFils)} />}
            <div className="flex justify-between border-t border-black-iron/10 pt-2.5 text-[15px] font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatFils(view.totalFils)}</dd>
            </div>
            {view.pricesIncludeVat && <p className="text-[11.5px] text-dark-grey">Includes VAT of {formatFils(view.vatFils)}</p>}
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-dark-grey">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Opt-in push for this order: every status change reaches the phone,
 * even with the site closed. Hidden where the browser can't do push
 * (e.g. iPhone Safari outside the Home Screen app).
 */
function NotifyMe({ token, vapidPublicKey }: { token: string; vapidPublicKey: string }) {
  const [state, setState] = React.useState<"hidden" | "idle" | "busy" | "on" | "blocked">("hidden");

  React.useEffect(() => {
    if (!pushSupported()) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (Notification.permission === "denied") return setState("blocked");
      // Already allowed (e.g. a previous order): follow this one silently.
      if (Notification.permission === "granted" && (await subscribePush(vapidPublicKey, `/api/orders/track/${token}/push`))) {
        if (!cancelled) setState("on");
        return;
      }
      if (!cancelled) setState("idle");
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, vapidPublicKey]);

  if (state === "hidden") return null;
  if (state === "on") {
    return (
      <p className="mt-3 inline-flex items-center gap-2 text-[13px] text-olive-leaf">
        <BellRing className="h-4 w-4" /> We&apos;ll notify you at every step.
      </p>
    );
  }
  if (state === "blocked") {
    return <p className="mt-3 text-[12.5px] text-dark-grey">Notifications are blocked for this site in your browser settings.</p>;
  }
  return (
    <button
      type="button"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        const allowed = await requestNotifications();
        if (!allowed) return setState(Notification.permission === "denied" ? "blocked" : "idle");
        setState((await subscribePush(vapidPublicKey, `/api/orders/track/${token}/push`)) ? "on" : "idle");
      }}
      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-terracotta/40 px-4 text-[13px] font-medium text-terracotta-ink hover:bg-terracotta/[0.06] disabled:opacity-60"
    >
      {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
      Notify me about every step
    </button>
  );
}
