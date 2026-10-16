"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Loader2, MessageCircle, Minus, Phone, Plus, Search, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Field, Select, TextArea, TextInput } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import { messageFromUnknown } from "@/lib/error-message";
import { mobileCountries, readMobile } from "@/lib/ordering/phone";
import { validateSelection, type PricingGroup, type Totals } from "@/lib/ordering/pricing";
import type { OrderArea, OrderCategory, OrderProduct, OrderVariant } from "@/lib/ordering/types";
import { cn } from "@/lib/utils";

/*
 * Entering an order a customer sent on WhatsApp or by phone. Phone first:
 * pick dishes, type the number (a returning customer's name and last
 * address fill in), choose the area and pay-on-delivery method, save.
 * Prices come from the server's quote, exactly as on the website; the
 * order then appears on the board like any other. Afterwards the tracking
 * link can be sent to the customer on WhatsApp in one tap.
 */

type Line = { key: string; product: OrderProduct; variant: OrderVariant; quantity: number; optionIds: string[]; notes: string };
type Quote = {
  totals: Totals;
  issues: { index: number; message: string }[];
  deliveryError: string | null;
  couponError: string | null;
  coupon: { code: string } | null;
  zone: { name: string; minOrderFils: number } | null;
};
type Done = { number: string; trackingToken: string; phone: string; name: string };

const newKey = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, "");

/** Countries that order most often come first in the picker; the rest follow by name. */
const FIRST_COUNTRIES = ["AE", "SA", "OM", "QA", "KW", "BH", "IR", "IN", "PK", "GB", "DE", "US"];

function flag(code: string) {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** The option check the server runs, on a line's own groups. */
function optionError(l: Line) {
  return validateSelection({ id: l.variant.itemId, name: "", portion: null, priceFils: 0, orderable: true, groups: l.variant.groups }, l.optionIds);
}

/** Required groups start with their first available options picked, so most dishes are one tap. */
function defaultOptions(groups: PricingGroup[]) {
  return groups.flatMap((g) => g.options.filter((o) => o.isAvailable).slice(0, g.minSelect).map((o) => o.id));
}

export function NewOrderForm({ menu, areas, zones }: { menu: OrderCategory[]; areas: OrderArea[]; zones: { id: string; name: string }[] }) {
  const { t, locale, money } = useAdminI18n();
  const [source, setSource] = React.useState<"WHATSAPP" | "PHONE">("WHATSAPP");
  const [query, setQuery] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([]);
  const [phone, setPhone] = React.useState("");
  // Only for numbers typed without +code / 00code; WhatsApp numbers can be from anywhere.
  const [country, setCountry] = React.useState("AE");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [known, setKnown] = React.useState<string | null>(null);
  const [address, setAddress] = React.useState({
    areaId: "",
    addressType: "apartment" as "apartment" | "villa" | "office",
    building: "",
    street: "",
    unit: "",
    floor: "",
    instructions: "",
    lat: null as number | null,
    lng: null as number | null,
  });
  const [payment, setPayment] = React.useState<"CASH_ON_DELIVERY" | "CARD_ON_DELIVERY">("CASH_ON_DELIVERY");
  const [coupon, setCoupon] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [cutlery, setCutlery] = React.useState(false);
  const [lastQuote, setQuote] = React.useState<Quote | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [done, setDone] = React.useState<Done | null>(null);
  const idempotencyKey = React.useRef(newKey());
  const uid = React.useId();

  const title = (p: OrderProduct) => (locale === "fa" && p.nameFa ? p.nameFa : p.title);
  const mobile = readMobile(phone, country);
  const e164 = mobile?.e164 ?? null;
  const countryName = React.useMemo(() => {
    const names = new Intl.DisplayNames([locale === "fa" ? "fa" : "en"], { type: "region" });
    return (code: string) => names.of(code) ?? code;
  }, [locale]);
  const countries = React.useMemo(() => {
    const all = mobileCountries().map((c) => ({ ...c, name: countryName(c.code) }));
    const first = FIRST_COUNTRIES.flatMap((code) => all.filter((c) => c.code === code));
    const rest = all.filter((c) => !FIRST_COUNTRIES.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name, locale));
    return { first, rest };
  }, [countryName, locale]);

  // Live price from the server whenever the basket, area, number or code changes.
  const cartLines = React.useMemo(() => lines.map((l) => ({ itemId: l.variant.itemId, quantity: l.quantity, optionIds: l.optionIds, notes: l.notes.trim() || null })), [lines]);
  React.useEffect(() => {
    if (cartLines.length === 0) return;
    let live = true;
    const timer = setTimeout(async () => {
      setQuoting(true);
      try {
        const res = await fetch("/api/order/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: cartLines, areaId: address.areaId || null, couponCode: coupon.trim() || null, phone: e164, lat: address.lat, lng: address.lng }),
        });
        const body = await res.json().catch(() => ({}));
        if (live && res.ok) setQuote(body);
      } finally {
        if (live) setQuoting(false);
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [cartLines, address.areaId, address.lat, address.lng, coupon, e164]);

  // An emptied basket has no total (the last quote is kept but not shown).
  const quote = cartLines.length ? lastQuote : null;

  // A returning customer: fill the name and the last address (never overwriting what was typed).
  React.useEffect(() => {
    if (!e164) return;
    let live = true;
    fetch(`/api/admin/orders/customer?phone=${encodeURIComponent(e164)}`)
      .then((r) => r.json())
      .then((body) => {
        const c = body?.customer;
        if (!live || !c) return;
        setKnown(c.name);
        setName((n) => n || c.name);
        setEmail((m) => m || c.email || "");
        setAddress((a) =>
          a.building
            ? a
            : {
                ...a,
                areaId: c.address.areaId ?? a.areaId,
                addressType: c.address.addressType,
                building: c.address.building ?? "",
                street: c.address.street ?? "",
                unit: c.address.unit ?? "",
                floor: c.address.floor ?? "",
                instructions: c.address.instructions ?? "",
                lat: c.address.lat,
                lng: c.address.lng,
              },
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [e164]);

  function add(product: OrderProduct, variant: OrderVariant) {
    setLines((ls) => {
      const same = ls.find((l) => l.variant.itemId === variant.itemId && l.optionIds.join() === defaultOptions(variant.groups).join() && !l.notes);
      if (same) return ls.map((l) => (l === same ? { ...l, quantity: Math.min(30, l.quantity + 1) } : l));
      return [...ls, { key: newKey(), product, variant, quantity: 1, optionIds: defaultOptions(variant.groups), notes: "" }];
    });
  }
  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function toggleOption(line: Line, group: PricingGroup, optionId: string) {
    const inGroup = new Set(group.options.map((o) => o.id));
    const mine = line.optionIds.filter((id) => inGroup.has(id));
    const others = line.optionIds.filter((id) => !inGroup.has(id));
    let next: string[];
    if (mine.includes(optionId)) next = mine.filter((id) => id !== optionId);
    else if (group.maxSelect === 1) next = [optionId];
    else next = mine.length < group.maxSelect ? [...mine, optionId] : mine;
    update(line.key, { optionIds: [...others, ...next] });
  }

  const q = query.trim().toLowerCase();
  const shown = menu
    .map((c) => ({
      ...c,
      products: c.products.filter((p) => !q || p.title.toLowerCase().includes(q) || (p.nameFa ?? "").includes(query.trim())),
    }))
    .filter((c) => c.products.length > 0);

  const linesValid = lines.every((l) => optionError(l) === null);
  const problems = [
    lines.length === 0 && t("Add at least one dish."),
    !linesValid && t("A dish needs a choice (size or option)."),
    !phone.trim() ? t("Enter the customer's mobile number.") : !e164 && t("That mobile number isn't valid. Pick the country, or type it with + and the country code."),
    name.trim().length < 2 && t("Enter the customer's name."),
    !address.areaId && t("Choose the area."),
    !address.building.trim() && t("Enter the building or villa."),
    quote?.deliveryError,
    quote?.issues[0]?.message,
    coupon.trim() && quote && !quote.coupon && (quote.couponError ?? t("That promo code can't be used.")),
  ].filter(Boolean) as string[];

  async function save() {
    if (!quote || problems.length || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          source,
          lines: cartLines,
          address: {
            ...address,
            street: address.street || null,
            unit: address.unit || null,
            floor: address.floor || null,
            instructions: address.instructions || null,
          },
          customer: { name: name.trim(), phone: e164, email: email.trim() || null, marketingOptIn: false },
          paymentMethod: payment,
          couponCode: coupon.trim() || null,
          notes: notes.trim() || null,
          cutlery,
          expectedTotalFils: quote.totals.totalFils,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.quote) setQuote(body.quote);
        throw body;
      }
      setDone({ number: body.number, trackingToken: body.trackingToken, phone: e164!, name: name.trim() });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "The order couldn't be saved.")));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    idempotencyKey.current = newKey();
    setDone(null);
    setLines([]);
    setPhone("");
    setName("");
    setEmail("");
    setKnown(null);
    setAddress({ areaId: "", addressType: "apartment", building: "", street: "", unit: "", floor: "", instructions: "", lat: null, lng: null });
    setPayment("CASH_ON_DELIVERY");
    setCoupon("");
    setNotes("");
    setCutlery(false);
    setQuote(null);
  }

  if (done) return <Saved done={done} onAnother={reset} />;

  const minShort = quote?.totals.shortOfMinimumFils ?? 0;

  return (
    <div className="space-y-5 pb-28">
      {/* Where the order came from */}
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("Order came by")}>
        {(
          [
            ["WHATSAPP", t("WhatsApp"), MessageCircle],
            ["PHONE", t("Phone call"), Phone],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={source === value}
            onClick={() => setSource(value)}
            className={cn(
              "flex h-14 items-center justify-center gap-2 rounded-[14px] border text-[15px] font-medium transition-colors",
              source === value ? "border-terracotta bg-terracotta/[0.07] text-terracotta-ink" : "border-black-iron/[0.1] bg-white text-black-iron hover:border-black-iron/25",
            )}
          >
            <Icon className="h-5 w-5" /> {label}
          </button>
        ))}
      </div>

      <Card title={t("Dishes")} bodyClassName="p-0">
        {lines.length > 0 && (
          <ul className="divide-y divide-black-iron/[0.06] border-b border-black-iron/[0.06]">
            {lines.map((l, i) => {
              const issue = quote?.issues.find((x) => x.index === i);
              const choiceError = optionError(l);
              return (
                <li key={l.key} className="space-y-2 p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-black-iron">
                        {title(l.product)}
                        {l.variant.portion ? <span className="text-dark-grey"> · {l.variant.portion}</span> : null}
                      </p>
                      {(issue || choiceError) && <p className="mt-0.5 text-[12.5px] text-pomegranate-red">{issue?.message ?? t("Choose an option below.")}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={t("One less")}
                        onClick={() => (l.quantity > 1 ? update(l.key, { quantity: l.quantity - 1 }) : setLines((ls) => ls.filter((x) => x.key !== l.key)))}
                        className="grid h-10 w-10 place-items-center rounded-full border border-black-iron/[0.12] text-black-iron"
                      >
                        {l.quantity > 1 ? <Minus className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                      <span className="w-8 text-center text-[16px] font-semibold tabular-nums">{l.quantity}</span>
                      <button
                        type="button"
                        aria-label={t("One more")}
                        onClick={() => update(l.key, { quantity: Math.min(30, l.quantity + 1) })}
                        className="grid h-10 w-10 place-items-center rounded-full border border-black-iron/[0.12] text-black-iron"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {l.variant.groups.map((g) => (
                    <div key={g.id}>
                      <p className="mb-1 text-[12px] text-dark-grey">
                        {g.name}
                        {g.minSelect > 0 && ` · ${t("required")}`}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {g.options.map((o) => {
                          const on = l.optionIds.includes(o.id);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              disabled={!o.isAvailable}
                              onClick={() => toggleOption(l, g, o.id)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-40",
                                on ? "border-terracotta bg-terracotta/[0.08] text-terracotta-ink" : "border-black-iron/[0.12] bg-white text-black-iron",
                              )}
                            >
                              {o.name}
                              {o.priceFils > 0 && ` +${money(o.priceFils)}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <TextInput
                    value={l.notes}
                    onChange={(e) => update(l.key, { notes: e.target.value.slice(0, 200) })}
                    placeholder={t("Note for the kitchen (optional)")}
                    className="h-10 text-[13.5px]"
                  />
                </li>
              );
            })}
          </ul>
        )}
        <div className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-grey" />
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Find a dish")} className="ps-9" />
          </div>
          <div className="mt-3 max-h-[46vh] space-y-4 overflow-y-auto pe-1">
            {shown.map((c) => (
              <div key={c.slug}>
                <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-[0.12em] text-dark-grey">{c.name}</p>
                <ul className="space-y-1.5">
                  {c.products.map((p) => (
                    <li key={p.key} className="flex flex-wrap items-center gap-2 rounded-[12px] border border-black-iron/[0.07] bg-white px-3 py-2">
                      <span className="min-w-0 flex-1 text-[14.5px] text-black-iron">{title(p)}</span>
                      {p.variants.map((v) => (
                        <button
                          key={v.itemId}
                          type="button"
                          disabled={!v.orderable}
                          onClick={() => add(p, v)}
                          className="inline-flex h-9 items-center gap-1 rounded-full bg-black-iron/[0.05] px-3 text-[13px] font-medium text-black-iron transition-colors hover:bg-terracotta/[0.1] disabled:opacity-35"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {v.portion ? `${v.portion} · ` : ""}
                          {money(v.priceFils)}
                          {!v.orderable && ` · ${t("sold out")}`}
                        </button>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {shown.length === 0 && <p className="py-4 text-center text-[13px] text-dark-grey">{t("No dish matches.")}</p>}
          </div>
        </div>
      </Card>

      <Card title={t("Customer")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor={`${uid}-phone`} label={t("Mobile number")}>
            <div className="flex gap-2" dir="ltr">
              <Select
                aria-label={t("Country of the number")}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-[7.5rem] shrink-0 px-2"
              >
                {[...countries.first, ...countries.rest].map((c, i) => (
                  // Country names come from Intl, which may word a few differently on the server.
                  <option key={`${c.code}-${i < countries.first.length ? "top" : "all"}`} value={c.code} suppressHydrationWarning>
                    {flag(c.code)} +{c.callingCode} {c.name}
                  </option>
                ))}
              </Select>
              <TextInput
                id={`${uid}-phone`}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={country === "AE" ? "050 123 4567" : t("Number, or paste it with +")}
                className="min-w-0 flex-1"
              />
            </div>
            {mobile ? (
              <p className="mt-1.5 flex items-center gap-1 text-[12.5px] text-olive-leaf" dir="auto">
                <Check className="h-3.5 w-3.5 shrink-0" />
                {mobile.country ? `${flag(mobile.country)} ${countryName(mobile.country)} · ` : ""}
                <bdi dir="ltr">{mobile.international}</bdi>
              </p>
            ) : phone.trim().length >= 6 ? (
              <p className="mt-1.5 text-[12.5px] text-pomegranate-red">
                {t("Not a valid mobile number in {country}. Pick the country, or type it with + and the country code.", { country: countryName(country) })}
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] text-dark-grey">{t("Any country: pick it, or paste the number from WhatsApp with +.")}</p>
            )}
          </Field>
          <Field htmlFor={`${uid}-name`} label={t("Name")}>
            <TextInput id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
        </div>
        {known && (
          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-olive-leaf">
            <UserCheck className="h-4 w-4" /> {t("Returning customer — name and last address filled in. Check them.")}
          </p>
        )}
        <div className="mt-4">
          <Field htmlFor={`${uid}-email`} label={t("Email (optional — they get the order by email)")}>
            <TextInput id={`${uid}-email`} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </Field>
        </div>
      </Card>

      <Card title={t("Delivery address")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor={`${uid}-area`} label={t("Area")}>
            <Select id={`${uid}-area`} value={address.areaId} onChange={(e) => setAddress((a) => ({ ...a, areaId: e.target.value, lat: null, lng: null }))}>
              <option value="">{t("Choose…")}</option>
              {zones.map((z) => (
                <optgroup key={z.id} label={z.name}>
                  {areas
                    .filter((a) => a.zoneId === z.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field htmlFor={`${uid}-type`} label={t("Type")}>
            <Select id={`${uid}-type`} value={address.addressType} onChange={(e) => setAddress((a) => ({ ...a, addressType: e.target.value as typeof a.addressType }))}>
              <option value="apartment">{t("Apartment")}</option>
              <option value="villa">{t("Villa")}</option>
              <option value="office">{t("Office")}</option>
            </Select>
          </Field>
          <Field htmlFor={`${uid}-building`} label={t("Building or villa")}>
            <TextInput id={`${uid}-building`} value={address.building} onChange={(e) => setAddress((a) => ({ ...a, building: e.target.value }))} />
          </Field>
          <Field htmlFor={`${uid}-street`} label={t("Street (optional)")}>
            <TextInput id={`${uid}-street`} value={address.street} onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))} />
          </Field>
          <Field htmlFor={`${uid}-unit`} label={t("Apartment / office no. (optional)")}>
            <TextInput id={`${uid}-unit`} value={address.unit} onChange={(e) => setAddress((a) => ({ ...a, unit: e.target.value }))} />
          </Field>
          <Field htmlFor={`${uid}-floor`} label={t("Floor (optional)")}>
            <TextInput id={`${uid}-floor`} value={address.floor} onChange={(e) => setAddress((a) => ({ ...a, floor: e.target.value }))} />
          </Field>
        </div>
        <div className="mt-4">
          <Field htmlFor={`${uid}-instructions`} label={t("Directions for the driver (optional)")}>
            <TextArea id={`${uid}-instructions`} rows={2} value={address.instructions} onChange={(e) => setAddress((a) => ({ ...a, instructions: e.target.value }))} />
          </Field>
        </div>
      </Card>

      <Card title={t("Payment and notes")}>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("Payment")}>
          {(
            [
              ["CASH_ON_DELIVERY", t("Cash on delivery")],
              ["CARD_ON_DELIVERY", t("Card on delivery")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={payment === value}
              onClick={() => setPayment(value)}
              className={cn(
                "h-12 rounded-[12px] border text-[14px] font-medium transition-colors",
                payment === value ? "border-terracotta bg-terracotta/[0.07] text-terracotta-ink" : "border-black-iron/[0.1] bg-white text-black-iron",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field htmlFor={`${uid}-coupon`} label={t("Promo code (optional)")}>
            <TextInput id={`${uid}-coupon`} value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} dir="ltr" />
          </Field>
          <Field htmlFor={`${uid}-notes`} label={t("Order note (optional)")}>
            <TextInput id={`${uid}-notes`} value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 300))} />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-[14px] text-black-iron">
          <input type="checkbox" checked={cutlery} onChange={(e) => setCutlery(e.target.checked)} className="h-5 w-5 accent-terracotta" />
          {t("Add cutlery")}
        </label>
      </Card>

      {/* Total and save, always within thumb reach. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black-iron/[0.07] bg-warm-white/95 px-4 pb-[max(0.75rem,var(--safe-bottom))] pt-3 backdrop-blur lg:start-60">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            {quote ? (
              <>
                <p className="text-[18px] font-bold leading-tight text-black-iron">
                  {money(quote.totals.totalFils)}
                  {quoting && <Loader2 className="ms-2 inline h-4 w-4 animate-spin text-dark-grey" />}
                </p>
                <p className="truncate text-[12px] text-dark-grey">
                  {t("Dishes")} {money(quote.totals.subtotalFils)} · {t("Delivery")} {money(quote.totals.deliveryFeeFils)}
                  {quote.totals.discountFils > 0 && ` · ${t("Discount")} −${money(quote.totals.discountFils)}`}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-dark-grey">{lines.length ? t("Working out the total…") : t("Add dishes to see the total.")}</p>
            )}
            {problems[0] ? (
              <p className="truncate text-[12px] text-pomegranate-red">{problems[0]}</p>
            ) : minShort > 0 && quote?.zone ? (
              <p className="truncate text-[12px] text-cinnamon-bark">{t("Below the {zone} minimum by {amount} — allowed for staff orders.", { zone: quote.zone.name, amount: money(minShort) })}</p>
            ) : null}
          </div>
          <Button size="lg" disabled={!quote || quoting || problems.length > 0 || saving} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("Save order")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** After saving: the number, and the tracking link for the customer — one tap to send on WhatsApp. */
function Saved({ done, onAnother }: { done: Done; onAnother: () => void }) {
  const { t } = useAdminI18n();
  const link = `${window.location.origin}/order/track/${done.trackingToken}`;
  const message = t("Hi {name}, thank you for your order {number} from SHĀZDEH. Follow it here: {link}", { name: done.name, number: done.number, link });
  const wa = `https://wa.me/${done.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message.replace(/[⁨⁩]/g, ""))}`;
  return (
    <Card>
      <div className="flex flex-col items-center py-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-olive-leaf/[0.12] text-olive-leaf">
          <Check className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-[22px] font-bold text-black-iron">{t("Order {number} saved", { number: done.number })}</h2>
        <p className="mt-1 max-w-sm text-[14px] text-dark-grey">{t("It is on the order board as accepted. Send the customer the tracking link:")}</p>
        <div className="mt-5 flex w-full max-w-sm flex-col gap-2">
          <Button asChild size="lg">
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> {t("Send link on WhatsApp")}
            </a>
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              void navigator.clipboard?.writeText(link).then(() => toast.success(t("Link copied.")));
            }}
          >
            <Copy className="h-4 w-4" /> {t("Copy tracking link")}
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button asChild variant="ghost" size="md">
              <Link href="/admin/orders">
                <ExternalLink className="h-4 w-4" /> {t("Order board")}
              </Link>
            </Button>
            <Button variant="ghost" size="md" onClick={onAnother}>
              <Plus className="h-4 w-4" /> {t("Another order")}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
