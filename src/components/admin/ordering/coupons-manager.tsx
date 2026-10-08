"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
};

const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

export function CouponsManager({ coupons }: { coupons: CouponRow[] }) {
  const [adding, setAdding] = React.useState(false);
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-[13px] text-warm-white/60">
        Codes are checked and applied on the server. Phone numbers aren&apos;t verified yet, so “per phone” limits deter casual reuse
        but can be bypassed with another number — keep big welcome offers small or capped until SMS verification is added.
      </p>
      {coupons.map((c) => (
        <CouponEditor key={c.id} coupon={c} />
      ))}
      {adding ? (
        <CouponEditor coupon={BLANK} onDone={() => setAdding(false)} />
      ) : (
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> New promo code
        </Button>
      )}
    </div>
  );
}

function CouponEditor({ coupon, onDone }: { coupon: CouponRow; onDone?: () => void }) {
  const router = useRouter();
  const isNew = !coupon.id;
  const [d, setD] = React.useState(coupon);
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof CouponRow>(k: K, v: CouponRow[K]) => setD((x) => ({ ...x, [k]: v }));
  const nOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  async function save() {
    setBusy(true);
    try {
      const { id: _id, usedCount: _u, ...body } = d;
      void _id;
      void _u;
      const res = await fetch(isNew ? "/api/admin/coupons" : `/api/admin/coupons/${coupon.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't save");
      toast.success("Promo code saved");
      onDone?.();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete ${coupon.code}?`)) return;
    const res = await fetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else toast.error("Couldn't delete");
  }

  return (
    <section className="rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] p-5">
      <div className="grid gap-4 md:grid-cols-6">
        <F label="Code"><Input value={d.code} onChange={(e) => set("code", e.target.value.toUpperCase())} className="font-mono uppercase" placeholder="WELCOME10" /></F>
        <F label="Type">
          <select
            value={d.type}
            onChange={(e) => set("type", e.target.value as CouponRow["type"])}
            className="flex h-12 w-full rounded-md border border-warm-white/10 bg-black-iron/60 px-3 text-[13px] text-warm-white"
          >
            <option value="PERCENT">% off</option>
            <option value="FIXED">AED off</option>
            <option value="FREE_DELIVERY">Free delivery</option>
          </select>
        </F>
        {d.type !== "FREE_DELIVERY" && (
          <F label={d.type === "PERCENT" ? "Percent" : "Amount (AED)"}><Input type="number" min={0} value={d.value} onChange={(e) => set("value", Number(e.target.value))} /></F>
        )}
        <F label="Min. subtotal"><Input type="number" min={0} value={d.minSubtotal} onChange={(e) => set("minSubtotal", Number(e.target.value))} /></F>
        <F label="Max discount"><Input type="number" min={0} placeholder="—" value={d.maxDiscount ?? ""} onChange={(e) => set("maxDiscount", nOrNull(e.target.value))} /></F>
        <F label="Description"><Input value={d.description ?? ""} onChange={(e) => set("description", e.target.value || null)} placeholder="Shown to customer" /></F>
        <F label="Starts"><Input type="datetime-local" value={toLocal(d.startsAt)} onChange={(e) => set("startsAt", fromLocal(e.target.value))} /></F>
        <F label="Ends"><Input type="datetime-local" value={toLocal(d.endsAt)} onChange={(e) => set("endsAt", fromLocal(e.target.value))} /></F>
        <F label="Total uses"><Input type="number" min={1} placeholder="∞" value={d.usageLimit ?? ""} onChange={(e) => set("usageLimit", nOrNull(e.target.value))} /></F>
        <F label="Uses per phone"><Input type="number" min={1} placeholder="∞" value={d.perPhoneLimit ?? ""} onChange={(e) => set("perPhoneLimit", nOrNull(e.target.value))} /></F>
        <div className="flex items-end gap-3 md:col-span-2">
          <label className="flex min-h-12 items-center gap-2 text-[12px] text-warm-white/70">
            <Switch checked={d.isActive} onCheckedChange={(v) => set("isActive", v)} /> Active
          </label>
          {!isNew && <span className="pb-3.5 text-[12px] tabular-nums text-warm-white/50">Used {coupon.usedCount}×</span>}
        </div>
      </div>
      <div className="mt-4 flex justify-between">
        {isNew ? (
          <Button variant="ghost" onClick={onDone}>Cancel</Button>
        ) : (
          <Button variant="ghost" className="text-pomegranate-red" onClick={remove}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
        <Button onClick={save} disabled={busy || d.code.length < 3}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </Button>
      </div>
    </section>
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
