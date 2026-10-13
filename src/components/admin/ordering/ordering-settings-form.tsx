"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Field, SwitchRow, TextInput } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import { cn } from "@/lib/utils";

export type OrderingSettingsDraft = {
  acceptingOrders: boolean;
  pausedMessage: string | null;
  deliveryHours: string | null;
  kitchenLat: number | null;
  kitchenLng: number | null;
  vatRate: number;
  pricesIncludeVat: boolean;
  serviceFee: number;
  paymentMethods: ("CASH_ON_DELIVERY" | "CARD_ON_DELIVERY" | "ONLINE")[];
  deliveryModel: "OWN_FLEET" | "THIRD_PARTY" | "HYBRID";
  autoAccept: boolean;
  notifyEmail: string | null;
  legalName: string | null;
  tradeLicenseNo: string | null;
  licensingAuthority: string | null;
  trn: string | null;
};

const DAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;

function parseHours(raw: string | null): Record<string, string> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function OrderingSettingsForm({
  initial,
  onlineProvider,
  siteHours,
}: {
  initial: OrderingSettingsDraft;
  onlineProvider: string | null;
  siteHours: string | null;
}) {
  const router = useRouter();
  const { t } = useAdminI18n();
  const [d, setD] = React.useState(initial);
  const [useSiteHours, setUseSiteHours] = React.useState(!initial.deliveryHours);
  const [hours, setHours] = React.useState<Record<string, string>>(parseHours(initial.deliveryHours ?? siteHours));
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof OrderingSettingsDraft>(k: K, v: OrderingSettingsDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const text = (v: string) => v || null;

  function toggleMethod(m: OrderingSettingsDraft["paymentMethods"][number], on: boolean) {
    set("paymentMethods", on ? [...new Set([...d.paymentMethods, m])] : d.paymentMethods.filter((x) => x !== m));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const cleanHours = Object.fromEntries(Object.entries(hours).filter(([, v]) => v.trim()));
      const res = await fetch("/api/admin/ordering", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, deliveryHours: useSiteHours ? null : JSON.stringify(cleanHours) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't save");
      toast.success(t("Saved"));
      router.refresh();
    } catch (err) {
      toast.error(t((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Card title={t("Taking orders")}>
        <div className="space-y-3">
          <SwitchRow
            label={t("Accept online orders")}
            description={t("Kitchen staff can also pause this from the Orders board.")}
            checked={d.acceptingOrders}
            onCheckedChange={(v) => set("acceptingOrders", v)}
          />
          <SwitchRow
            label={t("Accept orders automatically")}
            description={t("Skips the manual accept step.")}
            checked={d.autoAccept}
            onCheckedChange={(v) => set("autoAccept", v)}
          />
          <div className="grid gap-4 pt-1 sm:grid-cols-2">
            <Field label={t("Message when paused")}>
              <TextInput dir="auto" value={d.pausedMessage ?? ""} onChange={(e) => set("pausedMessage", text(e.target.value))} placeholder="We're very busy — please check back shortly." />
            </Field>
            <Field label={t("Email for new orders")}>
              <TextInput dir="ltr" type="email" value={d.notifyEmail ?? ""} onChange={(e) => set("notifyEmail", text(e.target.value))} placeholder="orders@…" />
            </Field>
          </div>
        </div>
      </Card>

      <Card title={t("Delivery hours")}>
        <SwitchRow label={t("Same as opening hours")} description={t("Set in Business details.")} checked={useSiteHours} onCheckedChange={setUseSiteHours} />
        {!useSiteHours && (
          <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {DAYS.map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[13px] text-dark-grey">{t(label)}</span>
                <TextInput dir="ltr" value={hours[key] ?? ""} onChange={(e) => setHours((h) => ({ ...h, [key]: e.target.value }))} placeholder="12:00 — 23:00" aria-label={t("{day} delivery hours", { day: t(label) })} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t("Payments")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <SwitchRow label={t("Cash on delivery")} checked={d.paymentMethods.includes("CASH_ON_DELIVERY")} onCheckedChange={(v) => toggleMethod("CASH_ON_DELIVERY", v)} />
          <SwitchRow label={t("Card on delivery")} description={t("Riders need a card machine.")} checked={d.paymentMethods.includes("CARD_ON_DELIVERY")} onCheckedChange={(v) => toggleMethod("CARD_ON_DELIVERY", v)} />
          <SwitchRow
            label={t("Pay online")}
            description={onlineProvider ? t("via {provider}", { provider: onlineProvider }) : t("Needs a payment provider set up first.")}
            disabled={!onlineProvider}
            checked={d.paymentMethods.includes("ONLINE")}
            onCheckedChange={(v) => toggleMethod("ONLINE", v)}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label={t("VAT (%)")}>
            <TextInput dir="ltr" type="number" min={0} max={30} step="0.5" value={d.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))} />
          </Field>
          <Field label={t("Service fee (AED)")}>
            <TextInput dir="ltr" type="number" min={0} step="0.5" value={d.serviceFee} onChange={(e) => set("serviceFee", Number(e.target.value))} />
          </Field>
          <SwitchRow label={t("Prices include VAT")} description={t("Required for UAE customers.")} checked={d.pricesIncludeVat} onCheckedChange={(v) => set("pricesIncludeVat", v)} className="self-end" />
        </div>
      </Card>

      <Card title={t("Who delivers")}>
        <div role="radiogroup" aria-label={t("Who delivers")} className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["OWN_FLEET", "Our riders"],
              ["THIRD_PARTY", "A courier company"],
              ["HYBRID", "Both"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={d.deliveryModel === v}
              onClick={() => set("deliveryModel", v)}
              className={cn(
                "min-h-12 rounded-[12px] border px-4 text-start text-[14px] font-medium transition-colors",
                d.deliveryModel === v ? "border-terracotta bg-terracotta/[0.06] text-terracotta-ink" : "border-black-iron/[0.1] hover:border-black-iron/25",
              )}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t("Kitchen latitude")} hint={t("Only needed for distance limits on zones.")}>
            <TextInput dir="ltr" type="number" step="any" value={d.kitchenLat ?? ""} onChange={(e) => set("kitchenLat", e.target.value === "" ? null : Number(e.target.value))} placeholder="25.2048" />
          </Field>
          <Field label={t("Kitchen longitude")}>
            <TextInput dir="ltr" type="number" step="any" value={d.kitchenLng ?? ""} onChange={(e) => set("kitchenLng", e.target.value === "" ? null : Number(e.target.value))} placeholder="55.2708" />
          </Field>
        </div>
      </Card>

      <Card title={t("Legal details")} description={t("Printed on receipts and in the website footer.")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Legal business name")}>
            <TextInput dir="auto" value={d.legalName ?? ""} onChange={(e) => set("legalName", text(e.target.value))} />
          </Field>
          <Field label={t("Trade licence number")}>
            <TextInput dir="ltr" value={d.tradeLicenseNo ?? ""} onChange={(e) => set("tradeLicenseNo", text(e.target.value))} />
          </Field>
          <Field label={t("Licensing authority")}>
            <TextInput dir="auto" value={d.licensingAuthority ?? ""} onChange={(e) => set("licensingAuthority", text(e.target.value))} placeholder="Dubai Department of Economy and Tourism" />
          </Field>
          <Field label={t("VAT number (TRN)")}>
            <TextInput dir="ltr" value={d.trn ?? ""} onChange={(e) => set("trn", text(e.target.value))} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("Save")}
        </Button>
      </div>
    </form>
  );
}
