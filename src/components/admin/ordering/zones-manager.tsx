"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, EmptyState, Field, TextArea, TextInput } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";

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
  const { t } = useAdminI18n();
  const [adding, setAdding] = React.useState(false);
  return (
    <>
      {zones.length === 0 && !adding && (
        <Card>
          <EmptyState
            title={t("No delivery zones yet")}
            description={t("Customers can't check out until at least one zone with areas exists.")}
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> {t("Add zone")}
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
            <Plus className="h-4 w-4" /> {t("Add zone")}
          </Button>
        )
      )}
    </>
  );
}

function ZoneEditor({ zone, onDone }: { zone: ZoneRow; onDone?: () => void }) {
  const { t } = useAdminI18n();
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
      toast.success(t("Zone saved"));
      onDone?.();
      router.refresh();
    } catch (e) {
      toast.error(t((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(t("Delete the zone “{name}” and its areas?", { name: zone.name }))) return;
    const res = await fetch(`/api/admin/zones/${zone.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("Zone deleted"));
      router.refresh();
    } else toast.error(t("Couldn't delete"));
  }

  return (
    <Card
      title={isNew ? t("New zone") : <span dir="auto">{zone.name}</span>}
      description={t(areaCount === 1 ? "{n} area" : "{n} areas", { n: areaCount })}
      actions={
        <label className="flex items-center gap-2 text-[13px] text-dark-grey">
          {t("Active")}
          <Switch checked={d.isActive} onCheckedChange={(v) => set("isActive", v)} />
        </label>
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label={t("Zone name")} className="col-span-2 md:col-span-1">
          <TextInput dir="auto" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder={t("e.g. Central")} />
        </Field>
        <Field label={t("Delivery fee (AED)")}>
          <TextInput dir="ltr" type="number" min={0} step="0.5" value={d.fee} onChange={(e) => set("fee", num(e.target.value))} />
        </Field>
        <Field label={t("Minimum order (AED)")}>
          <TextInput dir="ltr" type="number" min={0} value={d.minOrder} onChange={(e) => set("minOrder", num(e.target.value))} />
        </Field>
        <Field label={t("Free delivery over (AED)")} hint={t("Leave empty for none.")}>
          <TextInput dir="ltr" type="number" min={0} placeholder="—" value={d.freeDeliveryOver ?? ""} onChange={(e) => set("freeDeliveryOver", numOrNull(e.target.value))} />
        </Field>
        <Field label={t("Delivery time (minutes)")}>
          <div className="flex items-center gap-2">
            <TextInput dir="ltr" type="number" min={5} aria-label={t("Earliest")} value={d.etaMin} onChange={(e) => set("etaMin", num(e.target.value))} />
            <span className="text-dark-grey">–</span>
            <TextInput dir="ltr" type="number" min={5} aria-label={t("Latest")} value={d.etaMax} onChange={(e) => set("etaMax", num(e.target.value))} />
          </div>
        </Field>
        <Field label={t("Max distance (km)")} hint={t("Optional. Empty = no limit.")}>
          <TextInput dir="ltr" type="number" min={0} step="0.5" placeholder={t("No limit")} value={d.radiusKm || ""} onChange={(e) => set("radiusKm", numOrNull(e.target.value))} />
        </Field>
      </div>
      <Field
        label={t("Areas")}
        hint={t("One per line. Add “| latitude, longitude” to let customers use their location.")}
        className="mt-4"
      >
        <TextArea dir="ltr" value={areasText} onChange={(e) => setAreasText(e.target.value)} rows={5} className="font-mono text-[13px]" placeholder={"Dubai Marina | 25.0805, 55.1403\nJLT"} />
      </Field>
      <div className="mt-5 flex items-center justify-between">
        {!isNew ? (
          <Button variant="destructive-ghost" size="sm" onClick={remove}>
            <Trash2 className="h-4 w-4" /> {t("Delete zone")}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onDone}>
            {t("Cancel")}
          </Button>
        )}
        <Button size="sm" onClick={save} disabled={busy || !d.name.trim()}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("Save zone")}
        </Button>
      </div>
    </Card>
  );
}
