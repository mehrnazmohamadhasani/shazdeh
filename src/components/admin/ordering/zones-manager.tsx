"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, EmptyState, Field, TextArea, TextInput } from "@/components/admin/ui";

/*
 * Delivery zones. Each zone sets fee, minimum and timing; its areas are
 * typed one per line — "Dubai Marina" or, to enable "use my location",
 * "Dubai Marina | 25.0805, 55.1403".
 */

export type ZoneRow = {
  id: string;
  name: string;
  fee: number;
  minOrder: number;
  freeDeliveryOver: number | null;
  etaMin: number;
  etaMax: number;
  radiusKm: number | null;
  isActive: boolean;
  order: number;
  areas: { name: string; lat: number | null; lng: number | null }[];
};

function areasToText(areas: ZoneRow["areas"]) {
  return areas.map((a) => (a.lat != null && a.lng != null ? `${a.name} | ${a.lat}, ${a.lng}` : a.name)).join("\n");
}

function parseAreas(text: string) {
  const out: { name: string; lat: number | null; lng: number | null }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const [name, coords] = line.split("|").map((s) => s.trim());
    const m = coords?.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    out.push({ name, lat: m ? Number(m[1]) : null, lng: m ? Number(m[2]) : null });
  }
  return out;
}

const BLANK: ZoneRow = {
  id: "",
  name: "",
  fee: 0,
  minOrder: 0,
  freeDeliveryOver: null,
  etaMin: 30,
  etaMax: 45,
  radiusKm: null,
  isActive: true,
  order: 0,
  areas: [],
};

export function ZonesManager({ zones }: { zones: ZoneRow[] }) {
  const [adding, setAdding] = React.useState(false);
  return (
    <>
      {zones.length === 0 && !adding && (
        <Card>
          <EmptyState
            title="No delivery zones yet"
            description="Customers can't check out until at least one zone with areas exists."
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Add zone
              </Button>
            }
          />
        </Card>
      )}
      {zones.map((z) => (
        <ZoneEditor key={z.id} zone={z} />
      ))}
      {adding ? (
        <ZoneEditor zone={{ ...BLANK, order: zones.length }} onDone={() => setAdding(false)} />
      ) : (
        zones.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add zone
          </Button>
        )
      )}
    </>
  );
}

function ZoneEditor({ zone, onDone }: { zone: ZoneRow; onDone?: () => void }) {
  const router = useRouter();
  const isNew = !zone.id;
  const [d, setD] = React.useState(zone);
  const [areasText, setAreasText] = React.useState(areasToText(zone.areas));
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof ZoneRow>(k: K, v: ZoneRow[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const numOrNull = (v: string) => (v.trim() === "" || Number(v) === 0 ? null : Number(v));
  const areaCount = parseAreas(areasText).length;

  async function save() {
    setBusy(true);
    try {
      const { id: _id, areas: _areas, ...rest } = d;
      void _id;
      void _areas;
      const res = await fetch(isNew ? "/api/admin/zones" : `/api/admin/zones/${zone.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, areas: parseAreas(areasText) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't save");
      toast.success("Zone saved");
      onDone?.();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete the zone “${zone.name}” and its areas?`)) return;
    const res = await fetch(`/api/admin/zones/${zone.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Zone deleted");
      router.refresh();
    } else toast.error("Couldn't delete");
  }

  return (
    <Card
      title={isNew ? "New zone" : zone.name}
      description={`${areaCount} area${areaCount === 1 ? "" : "s"}`}
      actions={
        <label className="flex items-center gap-2 text-[13px] text-dark-grey">
          Active
          <Switch checked={d.isActive} onCheckedChange={(v) => set("isActive", v)} />
        </label>
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label="Zone name" className="col-span-2 md:col-span-1">
          <TextInput value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Central" />
        </Field>
        <Field label="Delivery fee (AED)">
          <TextInput type="number" min={0} step="0.5" value={d.fee} onChange={(e) => set("fee", num(e.target.value))} />
        </Field>
        <Field label="Minimum order (AED)">
          <TextInput type="number" min={0} value={d.minOrder} onChange={(e) => set("minOrder", num(e.target.value))} />
        </Field>
        <Field label="Free delivery over (AED)" hint="Leave empty for none.">
          <TextInput type="number" min={0} placeholder="—" value={d.freeDeliveryOver ?? ""} onChange={(e) => set("freeDeliveryOver", numOrNull(e.target.value))} />
        </Field>
        <Field label="Delivery time (minutes)">
          <div className="flex items-center gap-2">
            <TextInput type="number" min={5} aria-label="Earliest" value={d.etaMin} onChange={(e) => set("etaMin", num(e.target.value))} />
            <span className="text-dark-grey">–</span>
            <TextInput type="number" min={5} aria-label="Latest" value={d.etaMax} onChange={(e) => set("etaMax", num(e.target.value))} />
          </div>
        </Field>
        <Field label="Max distance (km)" hint="Optional. Empty = no limit.">
          <TextInput type="number" min={0} step="0.5" placeholder="No limit" value={d.radiusKm || ""} onChange={(e) => set("radiusKm", numOrNull(e.target.value))} />
        </Field>
      </div>
      <Field
        label="Areas"
        hint="One per line. Add “| latitude, longitude” to let customers use their location."
        className="mt-4"
      >
        <TextArea value={areasText} onChange={(e) => setAreasText(e.target.value)} rows={5} className="font-mono text-[13px]" placeholder={"Dubai Marina | 25.0805, 55.1403\nJLT"} />
      </Field>
      <div className="mt-5 flex items-center justify-between">
        {!isNew ? (
          <Button variant="ghost" size="sm" onClick={remove} className="text-pomegranate-red hover:bg-pomegranate-red/[0.08]">
            <Trash2 className="h-4 w-4" /> Delete zone
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={save} disabled={busy || !d.name.trim()}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save zone
        </Button>
      </div>
    </Card>
  );
}
