"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Copy, Download, Loader2, Plus, Printer, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, EmptyState, Field, Select, StatusPill, SwitchRow, TextInput, chipButtonClass } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import type { Translate } from "@/lib/admin-i18n";

export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENT" | "FIXED" | "FREE_DELIVERY";
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perPhoneLimit: number | null;
  usedCount: number;
  isActive: boolean;
  isGift: boolean;
  firstOrderOnly: boolean;
  /** Read-only counts for QR gifts. */
  scanCount: number;
  claimCount: number;
  giftUsedCount: number;
  /** The QR link, e.g. https://shazdeh.ae/g/GIFT15. */
  scanUrl: string;
};

const BLANK: CouponRow = {
  id: "",
  code: "",
  description: null,
  type: "PERCENT",
  value: 10,
  minSubtotal: 0,
  maxDiscount: null,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  perPhoneLimit: 1,
  usedCount: 0,
  isActive: true,
  isGift: false,
  firstOrderOnly: false,
  scanCount: 0,
  claimCount: 0,
  giftUsedCount: 0,
  scanUrl: "",
};

const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function summary(c: CouponRow, t: Translate) {
  if (c.type === "FREE_DELIVERY") return t("Free delivery");
  return c.type === "PERCENT" ? t("{n}% off", { n: c.value }) : t("{n} AED off", { n: c.value });
}

export function CouponsManager({ coupons }: { coupons: CouponRow[] }) {
  const { t } = useAdminI18n();
  const [adding, setAdding] = React.useState(false);
  return (
    <>
      {coupons.length === 0 && !adding && (
        <Card>
          <EmptyState
            title={t("No promo codes")}
            description={t("Codes are checked and applied by the server at checkout.")}
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> {t("New promo code")}
              </Button>
            }
          />
        </Card>
      )}
      {/* At the top, so it is found without scrolling past every code. */}
      {coupons.length > 0 && !adding && (
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> {t("New promo code")}
        </Button>
      )}
      {adding && <CouponEditor coupon={BLANK} onDone={() => setAdding(false)} />}
      {coupons.map((c) => (
        <CouponEditor key={c.id} coupon={c} />
      ))}
    </>
  );
}

function CouponEditor({ coupon, onDone }: { coupon: CouponRow; onDone?: () => void }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const isNew = !coupon.id;
  const [d, setD] = React.useState(coupon);
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof CouponRow>(k: K, v: CouponRow[K]) => setD((x) => ({ ...x, [k]: v }));
  const nOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  async function save() {
    setBusy(true);
    try {
      const { id: _id, usedCount: _u, scanCount: _s, claimCount: _c, giftUsedCount: _g, scanUrl: _url, ...body } = d;
      void [_id, _u, _s, _c, _g, _url];
      const res = await fetch(isNew ? "/api/admin/coupons" : `/api/admin/coupons/${coupon.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't save");
      toast.success(t("Promo code saved"));
      onDone?.();
      router.refresh();
    } catch (e) {
      toast.error(t((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(t("Delete {code}?", { code: coupon.code }))) return;
    const res = await fetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else toast.error(t("Couldn't delete"));
  }

  return (
    <Card
      title={isNew ? t("New promo code") : <span className="font-mono">{coupon.code}</span>}
      description={
        isNew
          ? undefined
          : coupon.isGift
            ? t("{summary} · QR gift · {scans} scans · {claims} claimed · {used} redeemed", {
                summary: summary(coupon, t),
                scans: coupon.scanCount,
                claims: coupon.claimCount,
                used: coupon.giftUsedCount,
              })
            : t("{summary} · used {n}×", { summary: summary(coupon, t), n: coupon.usedCount })
      }
      actions={
        <span className="flex items-center gap-3">
          {!isNew && !coupon.isActive && <StatusPill>{t("Off")}</StatusPill>}
          <Switch checked={d.isActive} aria-label={t("Active")} onCheckedChange={(v) => set("isActive", v)} />
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label={t("Code")}>
          <TextInput dir="ltr" value={d.code} onChange={(e) => set("code", e.target.value.toUpperCase())} className="font-mono uppercase" placeholder="WELCOME10" />
        </Field>
        <Field label={t("Discount")}>
          <Select value={d.type} onChange={(e) => set("type", e.target.value as CouponRow["type"])}>
            <option value="PERCENT">{t("% off")}</option>
            <option value="FIXED">{t("AED off")}</option>
            <option value="FREE_DELIVERY">{t("Free delivery")}</option>
          </Select>
        </Field>
        {d.type !== "FREE_DELIVERY" && (
          <Field label={d.type === "PERCENT" ? t("Percent") : t("Amount (AED)")}>
            <TextInput dir="ltr" type="number" min={0} value={d.value} onChange={(e) => set("value", Number(e.target.value))} />
          </Field>
        )}
        <Field label={t("Minimum order (AED)")}>
          <TextInput dir="ltr" type="number" min={0} value={d.minSubtotal} onChange={(e) => set("minSubtotal", Number(e.target.value))} />
        </Field>
        {d.type === "PERCENT" && (
          <Field label={t("Max discount (AED)")}>
            <TextInput dir="ltr" type="number" min={0} placeholder={t("No cap")} value={d.maxDiscount ?? ""} onChange={(e) => set("maxDiscount", nOrNull(e.target.value))} />
          </Field>
        )}
        <Field label={t("Total uses")}>
          <TextInput dir="ltr" type="number" min={1} placeholder={t("Unlimited")} value={d.usageLimit ?? ""} onChange={(e) => set("usageLimit", nOrNull(e.target.value))} />
        </Field>
        <Field label={t("Uses per customer")}>
          <TextInput dir="ltr" type="number" min={1} placeholder={t("Unlimited")} value={d.perPhoneLimit ?? ""} onChange={(e) => set("perPhoneLimit", nOrNull(e.target.value))} />
        </Field>
        <Field label={t("Starts")}>
          <TextInput dir="ltr" type="datetime-local" value={toLocal(d.startsAt)} onChange={(e) => set("startsAt", fromLocal(e.target.value))} />
        </Field>
        <Field label={t("Ends")}>
          <TextInput dir="ltr" type="datetime-local" value={toLocal(d.endsAt)} onChange={(e) => set("endsAt", fromLocal(e.target.value))} />
        </Field>
        <Field label={t("Note for customers")} className="col-span-2">
          <TextInput dir="auto" value={d.description ?? ""} onChange={(e) => set("description", e.target.value || null)} placeholder={t("e.g. 10% off your first order")} />
        </Field>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <SwitchRow
          label={t("QR gift")}
          description={t("Customers scan a card from their bag and leave their mobile and email. The gift is then applied by itself when they order with that mobile.")}
          checked={d.isGift}
          onCheckedChange={(v) => set("isGift", v)}
        />
        <SwitchRow
          label={t("First website order only")}
          description={t("Only for a mobile that hasn't ordered from us before.")}
          checked={d.firstOrderOnly}
          onCheckedChange={(v) => set("firstOrderOnly", v)}
        />
      </div>
      {!isNew && coupon.isGift && <GiftQr coupon={coupon} />}
      <div className="mt-5 flex items-center justify-between">
        {isNew ? (
          <Button variant="ghost" size="sm" onClick={onDone}>
            {t("Cancel")}
          </Button>
        ) : (
          <Button variant="destructive-ghost" size="sm" onClick={remove}>
            <Trash2 className="h-4 w-4" /> {t("Delete")}
          </Button>
        )}
        <Button size="sm" onClick={save} disabled={busy || d.code.length < 3}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("Save")}
        </Button>
      </div>
    </Card>
  );
}

/** The saved gift's QR: preview, the link, downloads and the printable bag card. */
function GiftQr({ coupon }: { coupon: CouponRow }) {
  const { t } = useAdminI18n();
  const qr = `/api/admin/coupons/${coupon.id}/qr`;
  return (
    <div className="mt-4 flex flex-col gap-4 rounded-[12px] border border-black-iron/[0.08] p-4 sm:flex-row sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- an admin-only SVG from our own API */}
      <img src={qr} alt={t("QR code for {code}", { code: coupon.code })} width={128} height={128} className="h-32 w-32 shrink-0 self-center rounded-[8px] border border-black-iron/[0.08]" />
      <div className="min-w-0 space-y-3">
        <p className="break-all font-mono text-[13px] text-dark-grey" dir="ltr">
          {coupon.scanUrl}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chipButtonClass}
            onClick={() => navigator.clipboard.writeText(coupon.scanUrl).then(() => toast.success(t("Link copied")))}
          >
            <Copy className="h-3.5 w-3.5" /> {t("Copy link")}
          </button>
          <a className={chipButtonClass} href={`${qr}?format=svg&download=1`}>
            <Download className="h-3.5 w-3.5" /> SVG
          </a>
          <a className={chipButtonClass} href={`${qr}?format=png&download=1`}>
            <Download className="h-3.5 w-3.5" /> PNG
          </a>
          <a className={chipButtonClass} href={`${qr}?format=card`} target="_blank" rel="noopener">
            <Printer className="h-3.5 w-3.5" /> {t("Bag card (A6)")}
          </a>
          <Link className={chipButtonClass} href={`/admin/gift-claims?code=${encodeURIComponent(coupon.code)}`}>
            <Users className="h-3.5 w-3.5" /> {t("Gift claims")}
          </Link>
        </div>
      </div>
    </div>
  );
}
