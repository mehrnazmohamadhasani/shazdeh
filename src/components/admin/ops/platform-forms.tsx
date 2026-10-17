"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Info, Loader2, Plus, ReceiptText, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Field, IconButton, Select, StatusPill, TextInput } from "@/components/admin/ui";
import { messageFromUnknown } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { useAdminI18n } from "@/components/admin/i18n";
import type { Translate } from "@/lib/admin-i18n";
import type { Flag } from "@/lib/ops/checks";
import { checkPlatformDraft, foodSales, type MenuEntry, type PlatformDraft } from "@/lib/ops/platform";
import type { SavePlatformOrderInput } from "@/lib/ops/platform-save-schema";

async function send(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json;
}

const text = (fils: number | null | undefined) => (fils == null ? "" : (fils / 100).toFixed(2));
const num = (s: string) => {
  const v = Number(s.replace(",", ".").trim());
  return s.trim() === "" || !Number.isFinite(v) ? null : v;
};
const fils = (s: string) => {
  const v = num(s);
  return v == null ? null : Math.round(v * 100);
};

/** A UTC instant → "YYYY-MM-DDTHH:mm" in Dubai, for a datetime-local input. */
function dubaiLocal(iso: string | null) {
  if (!iso) return "";
  return new Date(Date.parse(iso) + 4 * 3_600_000).toISOString().slice(0, 16);
}

/** A receipt uploaded as an invoice: read it again as a sale. */
export function ReadAsSaleButton({ documentId }: { documentId: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await send(`/api/admin/ops/documents/${documentId}/as-sale`);
          router.push(`/admin/ops/sales/receipts/${documentId}`);
          router.refresh();
        } catch (e) {
          toast.error(t(messageFromUnknown(e, "Could not read it")));
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
      {t("Read it as a platform sale")}
    </Button>
  );
}

function flagText(message: string, t: Translate): string {
  let m: RegExpMatchArray | null;
  if ((m = message.match(/^The dishes add up to (\S+), but the subtotal says (\S+)\.$/))) return t("The dishes add up to {sum}, but the subtotal says {subtotal}.", { sum: m[1], subtotal: m[2] });
  if ((m = message.match(/^Subtotal \+ fees − discount is (\S+), but the total says (\S+)\.$/))) return t("Subtotal + fees − discount is {sum}, but the total says {total}.", { sum: m[1], total: m[2] });
  if ((m = message.match(/^The receipt says (\d+) item\(s\), but (\d+) were read\.$/))) return t("The receipt says {printed} item(s), but {read} were read.", { printed: m[1], read: m[2] });
  if ((m = message.match(/^Menu prices add up to (\S+), but the receipt total is (\S+) — check the dishes\.$/))) return t("Menu prices add up to {sum}, but the receipt total is {total} — check the dishes.", { sum: m[1], total: m[2] });
  if ((m = message.match(/^Choose the menu dish for “(.*)”\.$/))) return t("Choose the menu dish for “{name}”.", { name: m[1] });
  if ((m = message.match(/^Check the menu dish for “(.*)”\.$/))) return t("Check the menu dish for “{name}”.", { name: m[1] });
  return t(message);
}

function PlatformFlags({ flags }: { flags: Flag[] }) {
  const { t } = useAdminI18n();
  if (!flags.length) return null;
  const icon = { error: XCircle, warn: AlertTriangle, info: Info };
  const tone = { error: "text-pomegranate-red", warn: "text-cinnamon-bark", info: "text-dark-grey" };
  return (
    <ul className="space-y-1.5 rounded-[16px] border border-black-iron/[0.07] bg-white p-4">
      {flags.map((f, i) => {
        const Icon = icon[f.level];
        return (
          <li key={i} className={cn("flex items-start gap-2 text-[13px]", tone[f.level])}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span dir="auto">{flagText(f.message, t)}</span>
          </li>
        );
      })}
    </ul>
  );
}

type ItemState = {
  key: string;
  rawName: string;
  category: string | null;
  quantity: string;
  lineTotal: string;
  menuItemId: string;
  /** How the suggestion was found; cleared once someone picks a dish. */
  via: "learned" | "name" | "picked" | null;
  confident: boolean;
};

/**
 * Review of one platform receipt: everything pre-filled from the reading,
 * every field editable, checks re-run on each keystroke. Saving records
 * the sale and remembers each dish name for this platform.
 */
export function PlatformReview({
  documentId,
  draft,
  itemCount,
  isPlatformReceipt,
  channels,
  menu,
}: {
  documentId: string;
  draft: PlatformDraft;
  itemCount: number | null;
  isPlatformReceipt: boolean;
  channels: { code: string; name: string }[];
  menu: MenuEntry[];
}) {
  const { t, money } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [channelCode, setChannelCode] = React.useState(draft.channelCode ?? "");
  const [orderNo, setOrderNo] = React.useState(draft.orderNo ?? "");
  const [altOrderId, setAltOrderId] = React.useState(draft.altOrderId ?? "");
  const [placedAt, setPlacedAt] = React.useState(dubaiLocal(draft.placedAt));
  const [fulfilment, setFulfilment] = React.useState<string>(draft.fulfilment ?? "");
  const [payment, setPayment] = React.useState(draft.payment ?? "");
  const [customer, setCustomer] = React.useState(draft.customerFirstName ?? "");
  const [subtotal, setSubtotal] = React.useState(text(draft.subtotalFils));
  const [deliveryFee, setDeliveryFee] = React.useState(text(draft.deliveryFeeFils));
  const [serviceFee, setServiceFee] = React.useState(text(draft.serviceFeeFils));
  const [discount, setDiscount] = React.useState(text(draft.discountFils || null));
  const [fundedBy, setFundedBy] = React.useState<SavePlatformOrderInput["discountFundedBy"]>("UNKNOWN");
  const [total, setTotal] = React.useState(text(draft.totalFils));
  const [note, setNote] = React.useState(draft.note ?? "");
  const [items, setItems] = React.useState<ItemState[]>(() =>
    draft.items.map((it, i) => ({
      key: `i${i}`,
      rawName: it.rawName,
      category: it.category,
      quantity: String(it.quantity),
      lineTotal: text(it.lineTotalFils),
      menuItemId: it.match?.menuItemId ?? "",
      via: it.match?.via ?? null,
      confident: !!it.match?.confident,
    })),
  );

  const priceOf = React.useCallback((id: string) => menu.find((m) => m.id === id)?.priceFils ?? null, [menu]);
  const categories = React.useMemo(() => [...new Set(menu.map((m) => m.category))], [menu]);

  const onScreen = React.useMemo(() => {
    const its = items.map((i) => ({
      rawName: i.rawName,
      quantity: Math.max(1, Math.round(num(i.quantity) ?? 1)),
      lineTotalFils: fils(i.lineTotal),
      menuItemId: i.menuItemId || null,
      menuPriceFils: i.menuItemId ? priceOf(i.menuItemId) : null,
      confident: i.confident || i.via === "picked",
    }));
    const base = {
      channelCode: channelCode || null,
      orderNo: orderNo.trim() || null,
      altOrderId: altOrderId.trim() || null,
      placedAt: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(placedAt) ? new Date(`${placedAt}:00+04:00`).toISOString() : null,
      businessDate: placedAt.slice(0, 10) || null,
      fulfilment: (fulfilment || null) as PlatformDraft["fulfilment"],
      payment: payment || null,
      customerFirstName: customer || null,
      subtotalFils: fils(subtotal),
      deliveryFeeFils: fils(deliveryFee),
      serviceFeeFils: fils(serviceFee),
      discountFils: Math.abs(fils(discount) ?? 0),
      totalFils: fils(total),
      note: note || null,
    };
    return {
      flags: checkPlatformDraft({ ...base, items: its }, { itemCount, isPlatformReceipt }),
      sales: foodSales({ ...base, items: its }),
    };
  }, [items, channelCode, orderNo, altOrderId, placedAt, fulfilment, payment, customer, subtotal, deliveryFee, serviceFee, discount, total, note, itemCount, isPlatformReceipt, priceOf]);

  const errors = onScreen.flags.filter((f) => f.level === "error");

  function update(key: string, patch: Partial<ItemState>) {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function save() {
    if (errors.length) return toast.error(t("Fix the red items first."));
    if (items.some((i) => !i.menuItemId) && !window.confirm(t("Some dishes aren't matched to the menu. Save anyway?"))) return;
    const input: SavePlatformOrderInput = {
      channelCode,
      orderNo: orderNo.trim(),
      altOrderId: altOrderId.trim() || null,
      placedAt,
      fulfilment: (fulfilment || null) as SavePlatformOrderInput["fulfilment"],
      payment: payment.trim() || null,
      customerFirstName: customer.trim() || null,
      items: items.map((i) => ({
        rawName: i.rawName.trim(),
        category: i.category,
        quantity: Math.max(1, Math.round(num(i.quantity) ?? 1)),
        lineTotal: num(i.lineTotal),
        menuItemId: i.menuItemId || null,
      })),
      subtotal: num(subtotal),
      deliveryFee: num(deliveryFee),
      serviceFee: num(serviceFee),
      discount: Math.abs(num(discount) ?? 0),
      discountFundedBy: fundedBy,
      total: num(total)!,
      note: note.trim() || null,
    };
    setBusy(true);
    try {
      await send("/api/admin/ops/platform-orders", { documentId, order: input });
      toast.success(t("Sale saved"));
      router.refresh();
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Could not save")));
      setBusy(false);
    }
  }

  const fieldError = (field: string) => onScreen.flags.some((f) => f.field === field && f.level !== "info");

  return (
    <div className="space-y-5">
      <Card title={t("Order")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Platform")} required>
            <Select value={channelCode} onChange={(e) => setChannelCode(e.target.value)} aria-invalid={fieldError("channel")}>
              <option value="">{t("Choose…")}</option>
              {channels.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Order number")} required hint={t("The number printed with # or “Order No”.")}>
            <TextInput dir="ltr" inputMode="numeric" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} aria-invalid={fieldError("orderNo")} />
          </Field>
          <Field label={t("Other number on the receipt")} hint={t("talabat's long number, Careem's large code.")}>
            <TextInput dir="ltr" inputMode="numeric" value={altOrderId} onChange={(e) => setAltOrderId(e.target.value)} />
          </Field>
          <Field label={t("Ordered at (Dubai time)")} required>
            <TextInput type="datetime-local" value={placedAt} onChange={(e) => setPlacedAt(e.target.value)} aria-invalid={fieldError("placedAt")} />
          </Field>
          <Field label={t("Delivery or pickup")}>
            <Select value={fulfilment} onChange={(e) => setFulfilment(e.target.value)}>
              <option value="">{t("Not shown")}</option>
              <option value="delivery">{t("Delivery")}</option>
              <option value="pickup">{t("Customer pickup")}</option>
            </Select>
          </Field>
          <Field label={t("Payment")}>
            <TextInput dir="ltr" value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="PREPAID" />
          </Field>
          <Field label={t("Customer first name")} hint={t("First name only — no surname or phone number.")}>
            <TextInput dir="auto" value={customer} onChange={(e) => setCustomer(e.target.value.split(/\s+/)[0] ?? "")} />
          </Field>
          <Field label={t("Note")}>
            <TextInput dir="auto" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title={t("Dishes")} bodyClassName="p-0">
        <ul className="divide-y divide-black-iron/[0.06]">
          {items.map((it) => {
            const price = it.menuItemId ? priceOf(it.menuItemId) : null;
            const qty = Math.max(1, Math.round(num(it.quantity) ?? 1));
            return (
              <li key={it.key} className="space-y-3 px-5 py-4 md:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p dir="auto" className="min-w-0 flex-1 text-[14.5px] font-medium">
                    {it.rawName}
                    {it.category && <span className="ms-2 text-[12px] font-normal uppercase tracking-wide text-dark-grey">{it.category}</span>}
                  </p>
                  {it.via === "learned" ? (
                    <StatusPill tone="good">{t("Remembered")}</StatusPill>
                  ) : it.via === "name" && it.confident ? (
                    <StatusPill tone="good">{t("Matched")}</StatusPill>
                  ) : it.via === "name" ? (
                    <StatusPill tone="warn">{t("Check")}</StatusPill>
                  ) : !it.menuItemId ? (
                    <StatusPill tone="bad">{t("Not matched")}</StatusPill>
                  ) : null}
                  <IconButton label={t("Remove dish")} onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
                <div className="grid gap-3 sm:grid-cols-[2fr_80px_120px]">
                  <Field label={t("Menu dish")}>
                    <Select value={it.menuItemId} onChange={(e) => update(it.key, { menuItemId: e.target.value, via: e.target.value ? "picked" : null })}>
                      <option value="">{t("Choose…")}</option>
                      {categories.map((c) => (
                        <optgroup key={c} label={c}>
                          {menu
                            .filter((m) => m.category === c)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} — {(m.priceFils / 100).toFixed(2)}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("Qty")}>
                    <TextInput inputMode="numeric" dir="ltr" value={it.quantity} onChange={(e) => update(it.key, { quantity: e.target.value })} />
                  </Field>
                  <Field label={t("Line total")}>
                    <TextInput
                      inputMode="decimal"
                      dir="ltr"
                      value={it.lineTotal}
                      onChange={(e) => update(it.key, { lineTotal: e.target.value })}
                      placeholder={price != null ? text(price * qty) : ""}
                    />
                  </Field>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="px-5 py-3 md:px-6">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setItems((l) => [...l, { key: `n${Date.now()}`, rawName: t("Added dish"), category: null, quantity: "1", lineTotal: "", menuItemId: "", via: null, confident: false }])
            }
          >
            <Plus className="h-4 w-4" />
            {t("Add a dish")}
          </Button>
        </div>
      </Card>

      <Card title={t("Money")}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("Subtotal (food)")}>
            <TextInput inputMode="decimal" dir="ltr" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} aria-invalid={fieldError("subtotal")} />
          </Field>
          <Field label={t("Delivery fee")}>
            <TextInput inputMode="decimal" dir="ltr" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
          </Field>
          <Field label={t("Service fee")}>
            <TextInput inputMode="decimal" dir="ltr" value={serviceFee} onChange={(e) => setServiceFee(e.target.value)} />
          </Field>
          <Field label={t("Discount")}>
            <TextInput inputMode="decimal" dir="ltr" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          <Field label={t("Discount paid by")}>
            <Select value={fundedBy} onChange={(e) => setFundedBy(e.target.value as typeof fundedBy)}>
              <option value="UNKNOWN">{t("Not known")}</option>
              <option value="RESTAURANT">{t("Restaurant")}</option>
              <option value="PLATFORM">{t("Platform")}</option>
              <option value="SHARED">{t("Shared")}</option>
            </Select>
          </Field>
          <Field label={t("Total (customer paid)")} required>
            <TextInput inputMode="decimal" dir="ltr" value={total} onChange={(e) => setTotal(e.target.value)} aria-invalid={fieldError("total")} />
          </Field>
        </div>
        <div className="mt-4 rounded-[12px] bg-black-iron/[0.03] px-4 py-3 text-[14px]">
          {onScreen.sales ? (
            <>
              <span className="font-semibold">{t("Food sale for SHĀZDEH: {amount}", { amount: money(onScreen.sales.fils) })}</span>
              <span className="block text-[12.5px] text-dark-grey">
                {onScreen.sales.source === "menu"
                  ? t("From menu prices — the receipt prints none.")
                  : t("Delivery and service fees are the platform's, not part of the sale. Commission comes from the fee rules.")}
              </span>
            </>
          ) : (
            <span className="text-cinnamon-bark">{t("Enter the subtotal or choose each dish to work out the sale.")}</span>
          )}
        </div>
      </Card>

      <PlatformFlags flags={onScreen.flags} />

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Save sale")}
        </Button>
      </div>
    </div>
  );
}

/** Remove a saved sale; the receipt opens again for correcting. */
export function UndoSaleButton({ orderId }: { orderId: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(t("Delete this sale? The receipt opens again so you can edit and save it."))) return;
        setBusy(true);
        try {
          await send(`/api/admin/ops/platform-orders/${orderId}/undo`);
          toast.success(t("Sale deleted"));
          router.refresh();
        } catch (e) {
          toast.error(t(messageFromUnknown(e, "Could not save")));
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {t("Delete")}
    </Button>
  );
}

/** A platform's fees from a date, from its contract or a statement. */
export function FeeRuleForm({ channelId }: { channelId: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [validFrom, setValidFrom] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [commission, setCommission] = React.useState("");
  const [paymentFee, setPaymentFee] = React.useState("");
  const [fixedFee, setFixedFee] = React.useState("");
  const [vatOnFees, setVatOnFees] = React.useState(true);
  const [note, setNote] = React.useState("");
  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {t("Add fee terms")}
      </Button>
    );
  }
  return (
    <form
      className="grid gap-3 rounded-[12px] border border-black-iron/[0.08] p-4 sm:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const c = num(commission);
        const p = num(paymentFee);
        const f = num(fixedFee);
        if (c == null && p == null && f == null) return toast.error(t("Enter at least one fee."));
        setBusy(true);
        try {
          await send(`/api/admin/ops/channels/${channelId}/fee-rules`, {
            validFrom,
            commissionPct: c,
            paymentFeePct: p,
            fixedFee: f,
            vatOnFees,
            note: note.trim() || null,
          });
          toast.success(t("Fee terms saved"));
          setOpen(false);
          router.refresh();
        } catch (err) {
          toast.error(t(messageFromUnknown(err, "Could not save")));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={t("Valid from")} required>
        <TextInput type="date" required value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
      </Field>
      <Field label={t("Commission (% of food sales)")}>
        <TextInput inputMode="decimal" dir="ltr" value={commission} onChange={(e) => setCommission(e.target.value)} />
      </Field>
      <Field label={t("Payment fee (%)")}>
        <TextInput inputMode="decimal" dir="ltr" value={paymentFee} onChange={(e) => setPaymentFee(e.target.value)} />
      </Field>
      <Field label={t("Fixed fee per order (AED)")}>
        <TextInput inputMode="decimal" dir="ltr" value={fixedFee} onChange={(e) => setFixedFee(e.target.value)} />
      </Field>
      <Field label={t("Source")} hint={t("e.g. contract page, September statement")}>
        <TextInput dir="auto" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-[13.5px]">
        <input type="checkbox" checked={vatOnFees} onChange={(e) => setVatOnFees(e.target.checked)} />
        {t("5 % VAT is added on these fees")}
      </label>
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}

export function DeleteFeeRuleButton({ ruleId }: { ruleId: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  return (
    <IconButton
      label={t("Delete fee terms")}
      danger
      onClick={async () => {
        if (!window.confirm(t("Delete these fee terms? Use this only for a mistake."))) return;
        const res = await fetch(`/api/admin/ops/fee-rules/${ruleId}`, { method: "DELETE" });
        if (!res.ok) return toast.error(t(messageFromUnknown(await res.json().catch(() => ({})), "Could not save")));
        router.refresh();
      }}
    >
      <Trash2 className="h-4 w-4" />
    </IconButton>
  );
}
