"use client";
import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/*
 * Options & add-ons for one dish. A group is a question the customer
 * answers ("Rice", "Extras"); min 1 / max 1 makes it a required single
 * choice, min 0 / max 3 an optional pick-up-to-three.
 */

type Option = { name: string; price: number; isAvailable: boolean };
type Group = { name: string; minSelect: number; maxSelect: number; options: Option[] };

export function ModifiersEditor({ itemId, initial }: { itemId: string; initial: Group[] }) {
  const [groups, setGroups] = React.useState<Group[]>(initial);
  const [busy, setBusy] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  function update(fn: (g: Group[]) => Group[]) {
    setGroups(fn);
    setDirty(true);
  }
  const setGroup = (gi: number, patch: Partial<Group>) => update((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const setOption = (gi: number, oi: number, patch: Partial<Option>) =>
    update((gs) => gs.map((g, i) => (i === gi ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : g)));
  const move = (gi: number, dir: -1 | 1) =>
    update((gs) => {
      const next = [...gs];
      const j = gi + dir;
      if (j < 0 || j >= next.length) return gs;
      [next[gi], next[j]] = [next[j], next[gi]];
      return next;
    });

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/menu-items/${itemId}/modifiers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't save options");
      toast.success("Options saved");
      setDirty(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] p-7">
      <p className="text-[10px] uppercase tracking-[0.32em] text-terracotta">Online ordering</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold tracking-[-0.035em] text-warm-white">Options & add-ons</h3>
          <p className="mt-1 text-[12.5px] text-warm-white/55">Saved separately from the dish details above.</p>
        </div>
        <Button type="button" onClick={save} disabled={busy || !dirty}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save options
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        {groups.length === 0 && <p className="text-[13px] text-warm-white/55">No options — customers add this dish as it is.</p>}
        {groups.map((g, gi) => (
          <div key={gi} className="rounded-md border border-warm-white/[0.08] bg-black-iron/40 p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_90px_90px_auto]">
              <div className="space-y-1.5">
                <Label>Question</Label>
                <Input value={g.name} onChange={(e) => setGroup(gi, { name: e.target.value })} placeholder="e.g. Rice, Extras, Spice level" />
              </div>
              <div className="space-y-1.5">
                <Label>Min</Label>
                <Input type="number" min={0} value={g.minSelect} onChange={(e) => setGroup(gi, { minSelect: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Max</Label>
                <Input type="number" min={1} value={g.maxSelect} onChange={(e) => setGroup(gi, { maxSelect: Number(e.target.value) })} />
              </div>
              <div className="flex items-end gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label="Move up" onClick={() => move(gi, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Move down" onClick={() => move(gi, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Delete group" onClick={() => update((gs) => gs.filter((_, i) => i !== gi))}>
                  <Trash2 className="h-4 w-4 text-pomegranate-red" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[11.5px] text-warm-white/50">
              {g.minSelect > 0 ? `Required — customer picks ${g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`}` : `Optional — up to ${g.maxSelect}`}
            </p>
            <div className="mt-3 space-y-2">
              {g.options.map((o, oi) => (
                <div key={oi} className="grid grid-cols-[minmax(0,1fr)_110px_auto_auto] items-center gap-2">
                  <Input value={o.name} onChange={(e) => setOption(gi, oi, { name: e.target.value })} placeholder="Option name" />
                  <Input type="number" min={0} step="0.5" value={o.price} onChange={(e) => setOption(gi, oi, { price: Number(e.target.value) })} aria-label="Extra price (AED)" />
                  <label className="flex items-center gap-1.5 text-[11px] text-warm-white/60">
                    <Switch checked={o.isAvailable} onCheckedChange={(v) => setOption(gi, oi, { isAvailable: v })} /> In stock
                  </label>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remove option"
                    onClick={() => setGroup(gi, { options: g.options.filter((_, j) => j !== oi) })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="ghost" onClick={() => setGroup(gi, { options: [...g.options, { name: "", price: 0, isAvailable: true }] })}>
                <Plus className="h-3.5 w-3.5" /> Option
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => update((gs) => [...gs, { name: "", minSelect: 0, maxSelect: 1, options: [{ name: "", price: 0, isAvailable: true }] }])}
        >
          <Plus className="h-4 w-4" /> Add option group
        </Button>
      </div>
    </div>
  );
}
