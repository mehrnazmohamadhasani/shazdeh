"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  prepMinutes: number;
  autoAccept: boolean;
  cutleryDefault: boolean;
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
      toast.success("Ordering settings saved");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-8">
      <Card title="Taking orders">
        <Row label="Accept online orders" hint="Master switch. Kitchen staff can also pause from the Orders board.">
          <Switch checked={d.acceptingOrders} onCheckedChange={(v) => set("acceptingOrders", v)} />
        </Row>
        <F label="Message when paused">
          <Input value={d.pausedMessage ?? ""} onChange={(e) => set("pausedMessage", e.target.value || null)} placeholder="We're very busy right now — please check back shortly." />
        </F>
        <Row label="Auto-accept orders" hint="Skip the manual accept step. Leave off until the kitchen routine is settled.">
          <Switch checked={d.autoAccept} onCheckedChange={(v) => set("autoAccept", v)} />
        </Row>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="New-order email (kitchen inbox)">
            <Input type="email" value={d.notifyEmail ?? ""} onChange={(e) => set("notifyEmail", e.target.value || null)} placeholder="orders@…" />
          </F>
          <F label="Typical prep time (min)">
            <Input type="number" min={0} value={d.prepMinutes} onChange={(e) => set("prepMinutes", Number(e.target.value))} />
          </F>
        </div>
      </Card>

      <Card title="Delivery hours">
        <Row label="Same as opening hours" hint="Use the hours set in Brand Settings.">
          <Switch checked={useSiteHours} onCheckedChange={setUseSiteHours} />
        </Row>
        {!useSiteHours && (
          <div className="grid gap-3 sm:grid-cols-2">
            {DAYS.map(([key, label]) => (
              <F key={key} label={label}>
                <Input value={hours[key] ?? ""} onChange={(e) => setHours((h) => ({ ...h, [key]: e.target.value }))} placeholder="12:00 — 23:00 (empty = closed)" />
              </F>
            ))}
          </div>
        )}
        <p className="text-[12px] text-warm-white/50">Times are Dubai time. Late nights work: “18:00 — 02:00”.</p>
      </Card>

      <Card title="Payments">
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["CASH_ON_DELIVERY", "Cash on delivery", null],
              ["CARD_ON_DELIVERY", "Card on delivery", "Riders need a card machine"],
              ["ONLINE", "Pay online", onlineProvider ? `via ${onlineProvider}` : "Needs a payment provider configured on the server"],
            ] as const
          ).map(([m, label, hint]) => {
            const disabled = m === "ONLINE" && !onlineProvider;
            return (
              <label key={m} className={cn("flex items-start gap-3 rounded-md border border-warm-white/[0.08] p-3.5", disabled && "opacity-50")}>
                <Switch checked={d.paymentMethods.includes(m)} disabled={disabled} onCheckedChange={(v) => toggleMethod(m, v)} />
                <span>
                  <span className="block text-[13px] font-medium text-warm-white">{label}</span>
                  {hint && <span className="block text-[11px] text-warm-white/55">{hint}</span>}
                </span>
              </label>
            );
          })}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <F label="VAT rate (%)">
            <Input type="number" min={0} max={30} step="0.5" value={d.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))} />
          </F>
          <F label="Service fee (AED)">
            <Input type="number" min={0} step="0.5" value={d.serviceFee} onChange={(e) => set("serviceFee", Number(e.target.value))} />
          </F>
          <Row label="Menu prices include VAT" hint="Required for UAE consumer prices.">
            <Switch checked={d.pricesIncludeVat} onCheckedChange={(v) => set("pricesIncludeVat", v)} />
          </Row>
        </div>
      </Card>

      <Card title="Delivery operation">
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["OWN_FLEET", "Own riders", "SHĀZDEH riders deliver every order"],
              ["THIRD_PARTY", "Logistics partner", "A courier company delivers"],
              ["HYBRID", "Both", "Choose per order at dispatch"],
            ] as const
          ).map(([v, label, hint]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={d.deliveryModel === v}
              onClick={() => set("deliveryModel", v)}
              className={cn(
                "rounded-md border p-3.5 text-left",
                d.deliveryModel === v ? "border-terracotta bg-terracotta/10" : "border-warm-white/[0.08]",
              )}
            >
              <span className="block text-[13px] font-medium text-warm-white">{label}</span>
              <span className="block text-[11px] text-warm-white/55">{hint}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Kitchen latitude">
            <Input type="number" step="any" value={d.kitchenLat ?? ""} onChange={(e) => set("kitchenLat", e.target.value === "" ? null : Number(e.target.value))} placeholder="25.2048" />
          </F>
          <F label="Kitchen longitude">
            <Input type="number" step="any" value={d.kitchenLng ?? ""} onChange={(e) => set("kitchenLng", e.target.value === "" ? null : Number(e.target.value))} placeholder="55.2708" />
          </F>
        </div>
        <Row label="Cutlery ticked by default" hint="Off is kinder to the planet; customers can still opt in.">
          <Switch checked={d.cutleryDefault} onCheckedChange={(v) => set("cutleryDefault", v)} />
        </Row>
      </Card>

      <Card title="Legal identity (receipts & footer)">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Legal business name"><Input value={d.legalName ?? ""} onChange={(e) => set("legalName", e.target.value || null)} /></F>
          <F label="Trade licence number"><Input value={d.tradeLicenseNo ?? ""} onChange={(e) => set("tradeLicenseNo", e.target.value || null)} /></F>
          <F label="Licensing authority"><Input value={d.licensingAuthority ?? ""} onChange={(e) => set("licensingAuthority", e.target.value || null)} placeholder="Dubai Department of Economy and Tourism" /></F>
          <F label="VAT TRN"><Input value={d.trn ?? ""} onChange={(e) => set("trn", e.target.value || null)} placeholder="15-digit TRN" /></F>
        </div>
        <p className="text-[12px] text-warm-white/50">
          UAE consumer-protection rules expect the seller&apos;s name, licence and licensing authority to be shown; the TRN is required on tax invoices if registered.
        </p>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy} size="lg">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
        </Button>
      </div>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] p-6">
      <h2 className="text-xl font-bold tracking-[-0.03em] text-warm-white">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-start justify-between gap-6">
      <span>
        <span className="block text-[13.5px] font-medium text-warm-white">{label}</span>
        {hint && <span className="block text-[11.5px] text-warm-white/55">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
