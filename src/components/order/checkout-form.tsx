"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Banknote, Check, CreditCard, Loader2, Lock, MapPin, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { AreaPicker } from "@/components/order/area-picker";
import {
  cart,
  recentOrders,
  savedAddresses,
  savedContact,
  useCart,
  type SavedAddress,
} from "@/components/order/cart-store";
import { useBasket, useOrderData } from "@/components/order/order-data";
import { formatFils } from "@/lib/ordering/money";
import { normalizeUaeMobile } from "@/lib/ordering/phone";
import type { Totals } from "@/lib/ordering/pricing";
import { cn } from "@/lib/utils";

/*
 * Checkout: address → contact → payment → place order, on one page.
 * Guest only. Returning customers on the same device get their details
 * and addresses pre-filled. Totals shown here come from the server
 * (/api/order/quote), and the order is refused if they change between
 * quote and placement, so the customer always confirms the real price.
 */

type Quote = {
  totals: Totals;
  blockers: string[];
  issues: { message: string }[];
  coupon: { code: string; description: string | null } | null;
  couponError: string | null;
  deliveryError: string | null;
  zone: { name: string; etaMin: number; etaMax: number } | null;
};

type AddressType = "apartment" | "villa" | "office";

const METHOD_META = {
  CASH_ON_DELIVERY: { label: "Cash on delivery", hint: "Pay the rider in cash", Icon: Banknote },
  CARD_ON_DELIVERY: { label: "Card on delivery", hint: "Tap or chip at your door", Icon: Smartphone },
  ONLINE: { label: "Pay online", hint: "", Icon: CreditCard },
} as const;

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function CheckoutForm({ partners }: { partners: { label: string; url: string }[] }) {
  const cartState = useCart();

  // Coming back from a cancelled gateway payment: release that order.
  React.useEffect(() => {
    const cancelled = new URLSearchParams(window.location.search).get("cancelled");
    if (cancelled) {
      fetch(`/api/orders/${encodeURIComponent(cancelled)}/abandon`, { method: "POST" }).catch(() => {});
      toast("Payment cancelled — you haven't been charged.", { duration: 4000 });
      window.history.replaceState(null, "", "/order/checkout");
    }
  }, []);

  if (cartState.lines.length === 0) {
    return (
      <div className="container-shazdeh max-w-xl py-20 text-center">
        <h1 className="text-[2rem] font-bold tracking-[-0.04em]">Your basket is empty</h1>
        <p className="mt-3 text-dark-grey">Pick a few dishes first — we&apos;ll keep them warm.</p>
        <Link
          href="/order"
          className="mt-8 inline-flex min-h-12 items-center rounded-full bg-terracotta px-7 text-[13px] font-semibold text-white"
        >
          Browse the menu
        </Link>
      </div>
    );
  }
  // Mounted only on the client (the server snapshot has an empty basket),
  // so the form can read this device's saved details while initialising.
  return <CheckoutDetails partners={partners} />;
}

function CheckoutDetails({ partners }: { partners: { label: string; url: string }[] }) {
  const router = useRouter();
  const { config } = useOrderData();
  const cartState = useCart();
  const basket = useBasket();
  const [areaOpen, setAreaOpen] = React.useState(false);

  // Saved address for the chosen area (if any) and saved contact details.
  const [savedList] = React.useState<SavedAddress[]>(() => savedAddresses.list());
  const [initialAddress] = React.useState(() => savedList.find((a) => a.areaId === cartState.areaId) ?? null);
  const [initialContact] = React.useState(() => savedContact.get());

  const [addressType, setAddressType] = React.useState<AddressType>(initialAddress?.addressType ?? "apartment");
  const [building, setBuilding] = React.useState(initialAddress?.building ?? "");
  const [unit, setUnit] = React.useState(initialAddress?.unit ?? "");
  const [floor, setFloor] = React.useState(initialAddress?.floor ?? "");
  const [street, setStreet] = React.useState(initialAddress?.street ?? "");
  const [instructions, setInstructions] = React.useState(initialAddress?.instructions ?? "");
  const [saveAddress, setSaveAddress] = React.useState(true);
  const [savedId, setSavedId] = React.useState<string | null>(initialAddress?.id ?? null);

  const [name, setName] = React.useState(initialContact?.name ?? "");
  const [phone, setPhone] = React.useState(initialContact?.phone ?? "");
  const [email, setEmail] = React.useState(initialContact?.email ?? "");
  const [remember, setRemember] = React.useState(true);
  const [marketing, setMarketing] = React.useState(false);

  const [method, setMethod] = React.useState(config.paymentMethods[0] ?? "CASH_ON_DELIVERY");
  const [notes, setNotes] = React.useState("");
  const [cutlery, setCutlery] = React.useState(config.cutleryDefault);

  const [couponInput, setCouponInput] = React.useState("");
  const [coupon, setCoupon] = React.useState<string | null>(null);

  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [placing, setPlacing] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showErrors, setShowErrors] = React.useState(false);
  // One key per checkout visit: retries and double-taps can't create two orders.
  const [idempotencyKey] = React.useState(uid);

  function applySaved(a: SavedAddress) {
    setSavedId(a.id);
    setAddressType(a.addressType);
    setBuilding(a.building);
    setUnit(a.unit);
    setFloor(a.floor);
    setStreet(a.street);
    setInstructions(a.instructions);
    if (a.areaId !== cartState.areaId) cart.setArea(a.areaId, a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : null);
  }

  // Server quote — debounced, re-run whenever the basket, area or code changes.
  const normalizedPhone = normalizeUaeMobile(phone);
  const quoteBody = React.useMemo(
    () =>
      JSON.stringify({
        lines: cartState.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, optionIds: l.optionIds, notes: l.notes || null })),
        areaId: cartState.areaId,
        lat: cartState.lat,
        lng: cartState.lng,
        couponCode: coupon,
        phone: normalizedPhone,
      }),
    [cartState, coupon, normalizedPhone],
  );
  React.useEffect(() => {
    if (cartState.lines.length === 0) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setQuoting(true);
      try {
        const res = await fetch("/api/order/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: quoteBody,
          signal: ctrl.signal,
        });
        if (res.ok) setQuote((await res.json()) as Quote);
      } catch {
        /* aborted or offline — keep the last quote */
      } finally {
        if (!ctrl.signal.aborted) setQuoting(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [quoteBody, cartState.lines.length]);

  const errors = {
    building: !building.trim() ? (addressType === "villa" ? "Enter your villa number" : "Enter your building name") : null,
    unit: addressType !== "villa" && !unit.trim() ? "Enter your apartment or office number" : null,
    name: name.trim().length < 2 ? "Enter your name" : null,
    phone: !normalizedPhone ? "Enter a UAE mobile, e.g. 050 123 4567" : null,
    email: email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Check your email address" : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  async function placeOrder() {
    setShowErrors(true);
    setSubmitError(null);
    if (hasErrors) {
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    if (!quote || quote.blockers.length > 0 || !cartState.areaId) return;
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          lines: cartState.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, optionIds: l.optionIds, notes: l.notes || null })),
          address: {
            areaId: cartState.areaId,
            addressType,
            building: building.trim(),
            street: street.trim() || null,
            unit: addressType === "villa" ? null : unit.trim() || null,
            floor: addressType === "villa" ? null : floor.trim() || null,
            instructions: instructions.trim() || null,
            lat: cartState.lat,
            lng: cartState.lng,
          },
          customer: { name: name.trim(), phone, email: email.trim() || null, marketingOptIn: marketing },
          paymentMethod: method,
          couponCode: coupon,
          notes: notes.trim() || null,
          cutlery,
          expectedTotalFils: quote.totals.totalFils,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.quote) setQuote(json.quote as Quote);
        if (json.code === "coupon") setCoupon(null);
        setSubmitError(json.error ?? "We couldn't place your order. Please try again.");
        setPlacing(false);
        return;
      }

      // Remember this device's details for next time (customer's choice).
      savedContact.set(remember ? { name: name.trim(), phone, email: email.trim() } : null);
      if (saveAddress) {
        savedAddresses.save({
          id: savedId ?? uid(),
          label: addressType === "villa" ? `Villa ${building.trim()}` : `${building.trim()}${unit ? ` · ${unit.trim()}` : ""}`,
          areaId: cartState.areaId,
          addressType,
          building: building.trim(),
          street: street.trim(),
          unit: unit.trim(),
          floor: floor.trim(),
          instructions: instructions.trim(),
          lat: cartState.lat,
          lng: cartState.lng,
        });
      }
      recentOrders.add({ number: json.number, token: json.trackingToken, placedAt: new Date().toISOString() });

      if (json.redirectUrl) {
        // Basket is kept until payment succeeds, so a cancelled payment loses nothing.
        window.location.assign(json.redirectUrl);
        return;
      }
      router.replace(`/order/track/${json.trackingToken}?placed=1`);
    } catch {
      setSubmitError("Connection problem — check your internet and try again. You won't be charged twice.");
      setPlacing(false);
    }
  }

  const t = quote?.totals ?? basket.totals;
  const blockers = quote?.blockers ?? [];
  const methodLabel = (m: keyof typeof METHOD_META) =>
    m === "ONLINE" ? config.onlineProviderLabel ?? "Card" : METHOD_META[m].hint;
  const canPlace = !!quote && blockers.length === 0 && !quoting && !placing;

  return (
    <div className="container-shazdeh pb-36 pt-5 md:pb-20 md:pt-8">
      <Link href="/order" className="-ml-2 inline-flex min-h-11 items-center gap-2 px-2 text-[13px] font-medium text-dark-grey hover:text-black-iron">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to menu
      </Link>
      <h1 className="mt-2 text-[2rem] font-bold leading-none tracking-[-0.04em] md:text-[2.75rem]">Checkout</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          {/* 1 · Address */}
          <Step n={1} title="Delivery address">
            <button
              type="button"
              onClick={() => setAreaOpen(true)}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-[12px] border px-4 text-left",
                quote?.deliveryError ? "border-rose-sumac/50 bg-rose-sumac/[0.05]" : "border-black-iron/12",
              )}
            >
              <MapPin className="h-5 w-5 shrink-0 text-terracotta-ink" strokeWidth={1.6} />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-dark-grey">Area</span>
                <span className="block truncate text-[15px] font-semibold">{basket.area?.name ?? "Choose your area"}</span>
              </span>
              <span className="text-[12.5px] font-medium text-terracotta-ink">Change</span>
            </button>
            {quote?.deliveryError && (
              <p role="alert" className="mt-2 flex items-start gap-2 text-[13px] text-rose-sumac">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                {quote.deliveryError}
              </p>
            )}

            {savedList.length > 0 && (
              <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1">
                {savedList.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => applySaved(a)}
                    className={cn(
                      "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[12.5px] font-medium",
                      savedId === a.id ? "border-black-iron bg-black-iron text-warm-white" : "border-black-iron/15",
                    )}
                  >
                    {savedId === a.id && <Check className="h-3.5 w-3.5" strokeWidth={2} />}
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            <div role="radiogroup" aria-label="Address type" className="mt-4 grid grid-cols-3 gap-2">
              {(["apartment", "villa", "office"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={addressType === type}
                  onClick={() => setAddressType(type)}
                  className={cn(
                    "min-h-11 rounded-[10px] border text-[13px] font-medium capitalize transition-colors",
                    addressType === type ? "border-black-iron bg-black-iron text-warm-white" : "border-black-iron/12 hover:border-black-iron/30",
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field
                label={addressType === "villa" ? "Villa number" : "Building name"}
                value={building}
                onChange={setBuilding}
                error={showErrors ? errors.building : null}
                autoComplete="address-line1"
                className="col-span-2"
                placeholder={addressType === "villa" ? "e.g. Villa 14" : "e.g. Marina Gate 2"}
              />
              {addressType !== "villa" && (
                <>
                  <Field
                    label={addressType === "office" ? "Office number" : "Apartment"}
                    value={unit}
                    onChange={setUnit}
                    error={showErrors ? errors.unit : null}
                    autoComplete="address-line2"
                    placeholder="e.g. 1204"
                  />
                  <Field label="Floor" value={floor} onChange={setFloor} optional inputMode="numeric" placeholder="e.g. 12" />
                </>
              )}
              <Field
                label="Street / community"
                value={street}
                onChange={setStreet}
                optional
                className="col-span-2"
                autoComplete="street-address"
                placeholder={addressType === "villa" ? "e.g. Street 4, Springs 7" : "Optional"}
              />
              <Field
                label="Delivery instructions"
                value={instructions}
                onChange={setInstructions}
                optional
                className="col-span-2"
                placeholder="Gate code, landmark, call on arrival…"
                maxLength={300}
              />
            </div>
            <Checkbox checked={saveAddress} onChange={setSaveAddress} label="Save this address on this device" />
          </Step>

          {/* 2 · Contact */}
          <Step n={2} title="Your details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Full name"
                value={name}
                onChange={setName}
                error={showErrors ? errors.name : null}
                autoComplete="name"
                className="sm:col-span-2"
              />
              <Field
                label="Mobile number"
                value={phone}
                onChange={setPhone}
                error={showErrors ? errors.phone : null}
                autoComplete="tel"
                inputMode="tel"
                type="tel"
                placeholder="050 123 4567"
                hint="The rider calls this number on arrival."
              />
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                error={showErrors ? errors.email : null}
                autoComplete="email"
                inputMode="email"
                type="email"
                optional
                hint="For your receipt and order updates."
              />
            </div>
            <Checkbox checked={remember} onChange={setRemember} label="Remember my details on this device" />
            <Checkbox checked={marketing} onChange={setMarketing} label="Send me SHĀZDEH news and offers (optional)" />
          </Step>

          {/* 3 · Payment */}
          <Step n={3} title="Payment">
            {config.paymentMethods.length === 0 ? (
              <p className="text-[14px] text-dark-grey">No payment methods are available right now.</p>
            ) : (
              <div role="radiogroup" aria-label="Payment method" className="grid gap-2">
                {config.paymentMethods.map((m) => {
                  const meta = METHOD_META[m];
                  const on = method === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setMethod(m)}
                      className={cn(
                        "flex min-h-16 items-center gap-4 rounded-[12px] border px-4 text-left transition-colors",
                        on ? "border-black-iron bg-white" : "border-black-iron/12 hover:border-black-iron/30",
                      )}
                    >
                      <meta.Icon className="h-5 w-5 shrink-0 text-terracotta-ink" strokeWidth={1.5} />
                      <span className="flex-1">
                        <span className="block text-[14.5px] font-semibold">{meta.label}</span>
                        <span className="block text-[12.5px] text-dark-grey">{methodLabel(m)}</span>
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-[22px] w-[22px] place-items-center rounded-full border",
                          on ? "border-terracotta bg-terracotta text-white" : "border-black-iron/30",
                        )}
                      >
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={2.4} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {method === "ONLINE" && (
              <p className="mt-3 flex items-center gap-2 text-[12.5px] text-dark-grey">
                <Lock className="h-3.5 w-3.5" strokeWidth={1.7} /> You&apos;ll pay on our payment partner&apos;s secure page. We never see or store your card.
              </p>
            )}
          </Step>

          {/* 4 · Extras */}
          <Step n={4} title="Anything else?">
            <Field
              label="Note for the kitchen"
              value={notes}
              onChange={setNotes}
              optional
              placeholder="Allergies, celebrations, spice preferences…"
              maxLength={300}
            />
            <Checkbox checked={cutlery} onChange={setCutlery} label="Include cutlery and napkins" />
          </Step>
        </div>

        {/* Summary */}
        <aside aria-label="Order summary" className="lg:sticky lg:top-[92px] lg:self-start">
          <div className="rounded-[18px] border border-black-iron/10 bg-white/70 p-5 sm:p-6">
            <h2 className="text-[1.25rem] font-bold tracking-[-0.03em]">Order summary</h2>
            {quote?.zone && (
              <p className="mt-1 text-[12.5px] tabular-nums text-dark-grey">
                Arrives in about {quote.zone.etaMin}–{quote.zone.etaMax} min
              </p>
            )}
            <ul className="mt-4 space-y-2.5 border-b border-black-iron/10 pb-4 text-[13.5px]">
              {basket.lines.map((l) => (
                <li key={l.line.key} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    <span className="tabular-nums text-dark-grey">{l.quantity}×</span> {l.name}
                    {l.portion && <span className="text-dark-grey"> · {l.portion}</span>}
                    {l.modifiers.length > 0 && (
                      <span className="block text-[12px] text-dark-grey">{l.modifiers.map((m) => m.name).join(" · ")}</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatFils(l.lineTotalFils)}</span>
                </li>
              ))}
            </ul>

            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const code = couponInput.trim().toUpperCase();
                setCoupon(code || null);
              }}
            >
              <label className="sr-only" htmlFor="promo">
                Promo code
              </label>
              <input
                id="promo"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Promo code"
                autoComplete="off"
                autoCapitalize="characters"
                className="h-11 min-w-0 flex-1 rounded-[10px] border border-black-iron/15 bg-transparent px-3.5 text-[14px] uppercase placeholder:normal-case focus:border-terracotta/60 focus:outline-none"
              />
              <button type="submit" className="h-11 shrink-0 rounded-[10px] border border-black-iron/80 px-4 text-[12.5px] font-semibold">
                Apply
              </button>
            </form>
            {coupon && quote?.coupon && (
              <p className="mt-2 flex items-center justify-between text-[12.5px] text-olive-leaf">
                <span>
                  <Check className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} />
                  {quote.coupon.code} applied{quote.coupon.description ? ` — ${quote.coupon.description}` : ""}
                </span>
                <button
                  type="button"
                  className="min-h-9 px-1 text-dark-grey underline"
                  onClick={() => {
                    setCoupon(null);
                    setCouponInput("");
                  }}
                >
                  Remove
                </button>
              </p>
            )}
            {coupon && quote?.couponError && <p className="mt-2 text-[12.5px] text-rose-sumac">{quote.couponError}</p>}

            <dl className={cn("mt-4 space-y-2 text-[13.5px] transition-opacity", quoting && "opacity-60")}>
              <SummaryRow label="Subtotal" value={formatFils(t.subtotalFils)} />
              <SummaryRow label="Delivery" value={t.deliveryFeeFils === 0 ? "Free" : formatFils(t.deliveryFeeFils)} />
              {t.serviceFeeFils > 0 && <SummaryRow label="Service fee" value={formatFils(t.serviceFeeFils)} />}
              {t.discountFils > 0 && <SummaryRow label="Promo" value={`−${formatFils(t.discountFils)}`} accent />}
              {!config.pricesIncludeVat && <SummaryRow label={`VAT ${config.vatRate}%`} value={formatFils(t.vatFils)} />}
              <div className="flex items-baseline justify-between border-t border-black-iron/10 pt-3 text-[16px] font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatFils(t.totalFils)}</dd>
              </div>
              {config.pricesIncludeVat && (
                <p className="text-[11.5px] text-dark-grey tabular-nums">Includes VAT of {formatFils(t.vatFils)}</p>
              )}
            </dl>

            {(blockers.length > 0 || submitError) && (
              <div role="alert" className="mt-4 space-y-1 rounded-[12px] bg-rose-sumac/[0.07] p-3.5 text-[13px] text-rose-sumac">
                {submitError && <p className="font-semibold">{submitError}</p>}
                {blockers.map((b) => (
                  <p key={b}>{b}</p>
                ))}
                {quote?.issues.map((i) => (
                  <p key={i.message} className="text-black-iron/75">
                    {i.message}
                  </p>
                ))}
                {quote?.deliveryError && partners.length > 0 && (
                  <p className="pt-1 text-black-iron/75">
                    Outside our area? Find us on{" "}
                    {partners.map((p, i) => (
                      <React.Fragment key={p.label}>
                        {i > 0 && ", "}
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline">
                          {p.label}
                        </a>
                      </React.Fragment>
                    ))}
                    .
                  </p>
                )}
              </div>
            )}

            <PlaceButton
              className="mt-5 hidden lg:flex"
              onClick={placeOrder}
              disabled={!canPlace}
              placing={placing}
              total={t.totalFils}
              method={method}
            />
            <p className="mt-3 text-[11.5px] leading-[1.6] text-dark-grey">
              By placing your order you agree to our{" "}
              <Link href="/legal/terms" className="underline">
                Terms
              </Link>
              ,{" "}
              <Link href="/legal/refunds" className="underline">
                Cancellation & refund policy
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="underline">
                Privacy policy
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile: place order under the thumb */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black-iron/10 bg-warm-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <PlaceButton onClick={placeOrder} disabled={!canPlace} placing={placing} total={t.totalFils} method={method} />
      </div>

      <AreaPicker open={areaOpen} onOpenChange={setAreaOpen} partners={partners} />
    </div>
  );
}

function PlaceButton({
  onClick,
  disabled,
  placing,
  total,
  method,
  className,
}: {
  onClick: () => void;
  disabled: boolean;
  placing: boolean;
  total: number;
  method: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-14 w-full items-center justify-between rounded-full bg-terracotta px-6 text-[14px] font-semibold text-white transition-colors hover:bg-terracotta-ink disabled:bg-black-iron/25",
        className,
      )}
    >
      <span className="flex items-center gap-2">
        {placing && <Loader2 className="h-4 w-4 animate-spin" />}
        {placing ? "Placing order…" : method === "ONLINE" ? "Continue to payment" : "Place order"}
      </span>
      <span className="tabular-nums">{formatFils(total)}</span>
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="rounded-[18px] border border-black-iron/10 bg-white/50 p-5 sm:p-6">
      <h2 id={`step-${n}`} className="mb-4 flex items-center gap-3 text-[1.125rem] font-bold tracking-[-0.025em]">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-black-iron text-[12px] font-semibold text-warm-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  optional,
  hint,
  className,
  ...input
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  optional?: boolean;
  hint?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = React.useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-baseline justify-between text-[12.5px] font-medium">
        {label}
        {optional && <span className="text-[11.5px] font-normal text-dark-grey">Optional</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-d` : undefined}
        className={cn(
          "mt-1.5 h-12 w-full rounded-[10px] border bg-white/60 px-3.5 text-[15px] focus:outline-none focus:ring-1",
          error ? "border-rose-sumac focus:ring-rose-sumac/40" : "border-black-iron/15 focus:border-terracotta/60 focus:ring-terracotta/40",
        )}
        {...input}
      />
      {(error || hint) && (
        <p id={`${id}-d`} className={cn("mt-1 text-[12px]", error ? "text-rose-sumac" : "text-dark-grey")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-[13.5px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 accent-terracotta"
      />
      {label}
    </label>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-dark-grey">{label}</dt>
      <dd className={cn("tabular-nums", accent && "text-olive-leaf")}>{value}</dd>
    </div>
  );
}
