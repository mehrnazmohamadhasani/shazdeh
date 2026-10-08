"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/*
 * Delivery zones. Each zone sets fee, minimum and timing; its areas are
 * typed one per line — "Dubai Marina" or, to enable "use my location",
 * "Dubai Marina | 25.0805, 55.1403".
 */

export type ZoneRow = {
  id: string;
  name: string;
  description: string | null;
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
  description: null,
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
    <div className="space-y-6">
      {zones.length === 0 && !adding && (
        <div className="rounded-md border border-dashed border-warm-white/15 p-10 text-center">
          <p className="text-xl font-bold text-warm-white">No delivery zones yet</p>
          <p className="mt-2 text-[14px] text-warm-white/60">Customers can&apos;t check out until at least one zone with areas exists.</p>
        </div>
      )}
      {zones.map((z) => (
        <ZoneEditor key={z.id} zone={z} />
      ))}
      {adding ? (
        <ZoneEditor zone={{ ...BLANK, order: zones.length }} onDone={() => setAdding(false)} />
      ) : (
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add zone
        </Button>
      )}
    </div>
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
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  async function save() {
    setBusy(true);
    try {
      const body = {
        name: d.name,
        description: d.description,
        fee: d.fee,
        minOrder: d.minOrder,
        freeDeliveryOver: d.freeDeliveryOver,
        etaMin: d.etaMin,
        etaMax: d.etaMax,
        radiusKm: d.radiusKm,
        isActive: d.isActive,
        order: d.order,
        areas: parseAreas(areasText),
      };
      const res = await fetch(isNew ? "/api/admin/zones" : `/api/admin/zones/${zone.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    if (!confirm(`Delete zone "${zone.name}" and its areas?`)) return;
    const res = await fetch(`/api/admin/zones/${zone.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Zone deleted");
      router.refresh();
    } else toast.error("Couldn't delete");
  }

  return (
    <section className="rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] p-6">
      <div className="flex items-center justify-between gap-4">
        <Input value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Zone name, e.g. Central" className="max-w-sm text-[16px] font-semibold" />
        <label className="flex items-center gap-2 text-[12px] text-warm-white/70">
          <Switch checked={d.isActive} onCheckedChange={(v) => set("isActive", v)} /> Active
        </label>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-6">
        <F label="Delivery fee (AED)"><Input type="number" min={0} step="0.5" value={d.fee} onChange={(e) => set("fee", num(e.target.value))} /></F>
        <F label="Minimum order (AED)"><Input type="number" min={0} value={d.minOrder} onChange={(e) => set("minOrder", num(e.target.value))} /></F>
        <F label="Free delivery over"><Input type="number" min={0} placeholder="—" value={d.freeDeliveryOver ?? ""} onChange={(e) => set("freeDeliveryOver", numOrNull(e.target.value))} /></F>
        <F label="Earliest (min)"><Input type="number" min={5} value={d.etaMin} onChange={(e) => set("etaMin", num(e.target.value))} /></F>
        <F label="Latest (min)"><Input type="number" min={5} value={d.etaMax} onChange={(e) => set("etaMax", num(e.target.value))} /></F>
        <F label="Max distance (km)"><Input type="number" min={0} step="0.5" placeholder="No limit" value={d.radiusKm || ""} onChange={(e) => set("radiusKm", numOrNull(e.target.value))} /></F>
      </div>
      <div className="mt-5">
        <F label="Areas in this zone — one per line, optional “| lat, lng”">
          <Textarea value={areasText} onChange={(e) => setAreasText(e.target.value)} rows={6} className="font-mono text-[12.5px]" placeholder={"Dubai Marina | 25.0805, 55.1403\nJLT"} />
        </F>
        <p className="mt-2 text-[11.5px] text-warm-white/50">
          {parseAreas(areasText).length} areas. Coordinates let “Use my location” suggest the nearest area. Moving an area name to another zone moves it.
          Dubai Municipality limits transit to 30 minutes without extra temperature control — set times accordingly.
        </p>
      </div>
      <div className="mt-5 flex justify-between">
        {!isNew ? (
          <Button variant="ghost" onClick={remove} className="text-pomegranate-red">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        ) : (
          <Button variant="ghost" onClick={onDone}>Cancel</Button>
        )}
        <Button onClick={save} disabled={busy || !d.name.trim()}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save zone
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
