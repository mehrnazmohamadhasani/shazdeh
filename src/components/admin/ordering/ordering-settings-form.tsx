"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Field, SwitchRow, TextInput } from "@/components/admin/ui";
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
      toast.success("Saved");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Card title="Taking orders">
        <div className="space-y-3">
          <SwitchRow
            label="Accept online orders"
            description="Kitchen staff can also pause this from the Orders board."
            checked={d.acceptingOrders}
            onCheckedChange={(v) => set("acceptingOrders", v)}
          />
          <SwitchRow
            label="Accept orders automatically"
            description="Skips the manual accept step."
            checked={d.autoAccept}
            onCheckedChange={(v) => set("autoAccept", v)}
          />
          <div className="grid gap-4 pt-1 sm:grid-cols-2">
            <Field label="Message when paused">
              <TextInput value={d.pausedMessage ?? ""} onChange={(e) => set("pausedMessage", text(e.target.value))} placeholder="We're very busy — please check back shortly." />
            </Field>
            <Field label="Email for new orders">
              <TextInput type="email" value={d.notifyEmail ?? ""} onChange={(e) => set("notifyEmail", text(e.target.value))} placeholder="orders@…" />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Delivery hours">
        <SwitchRow label="Same as opening hours" description="Set in Business details." checked={useSiteHours} onCheckedChange={setUseSiteHours} />
        {!useSiteHours && (
          <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {DAYS.map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[13px] text-dark-grey">{label}</span>
                <TextInput value={hours[key] ?? ""} onChange={(e) => setHours((h) => ({ ...h, [key]: e.target.value }))} placeholder="12:00 — 23:00" aria-label={`${label} delivery hours`} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Payments">
        <div className="grid gap-3 sm:grid-cols-3">
          <SwitchRow label="Cash on delivery" checked={d.paymentMethods.includes("CASH_ON_DELIVERY")} onCheckedChange={(v) => toggleMethod("CASH_ON_DELIVERY", v)} />
          <SwitchRow label="Card on delivery" description="Riders need a card machine." checked={d.paymentMethods.includes("CARD_ON_DELIVERY")} onCheckedChange={(v) => toggleMethod("CARD_ON_DELIVERY", v)} />
          <SwitchRow
            label="Pay online"
            description={onlineProvider ? `via ${onlineProvider}` : "Needs a payment provider set up first."}
            disabled={!onlineProvider}
            checked={d.paymentMethods.includes("ONLINE")}
            onCheckedChange={(v) => toggleMethod("ONLINE", v)}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="VAT (%)">
            <TextInput type="number" min={0} max={30} step="0.5" value={d.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))} />
          </Field>
          <Field label="Service fee (AED)">
            <TextInput type="number" min={0} step="0.5" value={d.serviceFee} onChange={(e) => set("serviceFee", Number(e.target.value))} />
          </Field>
          <SwitchRow label="Prices include VAT" description="Required for UAE customers." checked={d.pricesIncludeVat} onCheckedChange={(v) => set("pricesIncludeVat", v)} className="self-end" />
        </div>
      </Card>

      <Card title="Who delivers">
        <div role="radiogroup" aria-label="Who delivers" className="grid gap-3 sm:grid-cols-3">
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
                "min-h-12 rounded-[12px] border px-4 text-left text-[14px] font-medium transition-colors",
                d.deliveryModel === v ? "border-terracotta bg-terracotta/[0.06] text-terracotta-ink" : "border-black-iron/[0.1] hover:border-black-iron/25",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Kitchen latitude" hint="Only needed for distance limits on zones.">
            <TextInput type="number" step="any" value={d.kitchenLat ?? ""} onChange={(e) => set("kitchenLat", e.target.value === "" ? null : Number(e.target.value))} placeholder="25.2048" />
          </Field>
          <Field label="Kitchen longitude">
            <TextInput type="number" step="any" value={d.kitchenLng ?? ""} onChange={(e) => set("kitchenLng", e.target.value === "" ? null : Number(e.target.value))} placeholder="55.2708" />
          </Field>
        </div>
      </Card>

      <Card title="Legal details" description="Printed on receipts and in the website footer.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal business name">
            <TextInput value={d.legalName ?? ""} onChange={(e) => set("legalName", text(e.target.value))} />
          </Field>
          <Field label="Trade licence number">
            <TextInput value={d.tradeLicenseNo ?? ""} onChange={(e) => set("tradeLicenseNo", text(e.target.value))} />
          </Field>
          <Field label="Licensing authority">
            <TextInput value={d.licensingAuthority ?? ""} onChange={(e) => set("licensingAuthority", text(e.target.value))} placeholder="Dubai Department of Economy and Tourism" />
          </Field>
          <Field label="VAT number (TRN)">
            <TextInput value={d.trn ?? ""} onChange={(e) => set("trn", text(e.target.value))} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </Button>
      </div>
    </form>
  );
}
