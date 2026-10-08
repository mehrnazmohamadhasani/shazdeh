"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, EmptyState, Field, Select, StatusPill, TextInput } from "@/components/admin/ui";

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

function summary(c: CouponRow) {
  if (c.type === "FREE_DELIVERY") return "Free delivery";
  return c.type === "PERCENT" ? `${c.value}% off` : `${c.value} AED off`;
}

export function CouponsManager({ coupons }: { coupons: CouponRow[] }) {
  const [adding, setAdding] = React.useState(false);
  return (
    <>
      {coupons.length === 0 && !adding && (
        <Card>
          <EmptyState
            title="No promo codes"
            description="Codes are checked and applied by the server at checkout."
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> New promo code
              </Button>
            }
          />
        </Card>
      )}
      {adding && <CouponEditor coupon={BLANK} onDone={() => setAdding(false)} />}
      {coupons.map((c) => (
        <CouponEditor key={c.id} coupon={c} />
      ))}
      {coupons.length > 0 && !adding && (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> New promo code
        </Button>
      )}
    </>
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
    <Card
      title={isNew ? "New promo code" : <span className="font-mono">{coupon.code}</span>}
      description={isNew ? undefined : `${summary(coupon)} · used ${coupon.usedCount}×`}
      actions={
        <span className="flex items-center gap-3">
          {!isNew && !coupon.isActive && <StatusPill>Off</StatusPill>}
          <Switch checked={d.isActive} aria-label="Active" onCheckedChange={(v) => set("isActive", v)} />
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="Code">
          <TextInput value={d.code} onChange={(e) => set("code", e.target.value.toUpperCase())} className="font-mono uppercase" placeholder="WELCOME10" />
        </Field>
        <Field label="Discount">
          <Select value={d.type} onChange={(e) => set("type", e.target.value as CouponRow["type"])}>
            <option value="PERCENT">% off</option>
            <option value="FIXED">AED off</option>
            <option value="FREE_DELIVERY">Free delivery</option>
          </Select>
        </Field>
        {d.type !== "FREE_DELIVERY" && (
          <Field label={d.type === "PERCENT" ? "Percent" : "Amount (AED)"}>
            <TextInput type="number" min={0} value={d.value} onChange={(e) => set("value", Number(e.target.value))} />
          </Field>
        )}
        <Field label="Minimum order (AED)">
          <TextInput type="number" min={0} value={d.minSubtotal} onChange={(e) => set("minSubtotal", Number(e.target.value))} />
        </Field>
        {d.type === "PERCENT" && (
          <Field label="Max discount (AED)">
            <TextInput type="number" min={0} placeholder="No cap" value={d.maxDiscount ?? ""} onChange={(e) => set("maxDiscount", nOrNull(e.target.value))} />
          </Field>
        )}
        <Field label="Total uses">
          <TextInput type="number" min={1} placeholder="Unlimited" value={d.usageLimit ?? ""} onChange={(e) => set("usageLimit", nOrNull(e.target.value))} />
        </Field>
        <Field label="Uses per customer">
          <TextInput type="number" min={1} placeholder="Unlimited" value={d.perPhoneLimit ?? ""} onChange={(e) => set("perPhoneLimit", nOrNull(e.target.value))} />
        </Field>
        <Field label="Starts">
          <TextInput type="datetime-local" value={toLocal(d.startsAt)} onChange={(e) => set("startsAt", fromLocal(e.target.value))} />
        </Field>
        <Field label="Ends">
          <TextInput type="datetime-local" value={toLocal(d.endsAt)} onChange={(e) => set("endsAt", fromLocal(e.target.value))} />
        </Field>
        <Field label="Note for customers" className="col-span-2">
          <TextInput value={d.description ?? ""} onChange={(e) => set("description", e.target.value || null)} placeholder="e.g. 10% off your first order" />
        </Field>
      </div>
      <div className="mt-5 flex items-center justify-between">
        {isNew ? (
          <Button variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="text-pomegranate-red hover:bg-pomegranate-red/[0.08]" onClick={remove}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
        <Button size="sm" onClick={save} disabled={busy || d.code.length < 3}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </Button>
      </div>
    </Card>
  );
}
