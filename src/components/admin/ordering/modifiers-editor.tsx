"use client";
import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, Field, IconButton, TextInput } from "@/components/admin/ui";

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
    <Card
      title="Options & add-ons"
      description="Choices customers make when ordering online. Saved separately."
      actions={
        <Button type="button" size="sm" onClick={save} disabled={busy || !dirty}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save options
        </Button>
      }
    >
      <div className="space-y-4">
        {groups.length === 0 && <p className="text-[13px] text-dark-grey">No options — customers order this dish as it is.</p>}
        {groups.map((g, gi) => (
          <div key={gi} className="rounded-[12px] border border-black-iron/[0.08] p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_88px_88px_auto] sm:items-end">
              <Field label="Question">
                <TextInput value={g.name} onChange={(e) => setGroup(gi, { name: e.target.value })} placeholder="e.g. Rice, Extras" />
              </Field>
              <Field label="Min">
                <TextInput type="number" min={0} value={g.minSelect} onChange={(e) => setGroup(gi, { minSelect: Number(e.target.value) })} />
              </Field>
              <Field label="Max">
                <TextInput type="number" min={1} value={g.maxSelect} onChange={(e) => setGroup(gi, { maxSelect: Number(e.target.value) })} />
              </Field>
              <div className="flex">
                <IconButton label="Move up" onClick={() => move(gi, -1)} disabled={gi === 0}>
                  <ArrowUp className="h-4 w-4" />
                </IconButton>
                <IconButton label="Move down" onClick={() => move(gi, 1)} disabled={gi === groups.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </IconButton>
                <IconButton label="Delete question" onClick={() => update((gs) => gs.filter((_, i) => i !== gi))} danger>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
            <p className="mt-2 text-[12px] text-dark-grey">
              {g.minSelect > 0
                ? `Required — customer picks ${g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`}`
                : `Optional — up to ${g.maxSelect}`}
            </p>
            <div className="mt-3 space-y-2">
              {g.options.map((o, oi) => (
                <div key={oi} className="grid grid-cols-[minmax(0,1fr)_100px_auto_auto] items-center gap-2">
                  <TextInput value={o.name} onChange={(e) => setOption(gi, oi, { name: e.target.value })} placeholder="Option" className="h-10" aria-label="Option name" />
                  <TextInput type="number" min={0} step="0.5" value={o.price} onChange={(e) => setOption(gi, oi, { price: Number(e.target.value) })} className="h-10" aria-label="Extra price (AED)" title="Extra price (AED)" />
                  <Switch checked={o.isAvailable} onCheckedChange={(v) => setOption(gi, oi, { isAvailable: v })} aria-label="In stock" />
                  <IconButton label="Remove option" onClick={() => setGroup(gi, { options: g.options.filter((_, j) => j !== oi) })}>
                    <X className="h-4 w-4" />
                  </IconButton>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setGroup(gi, { options: [...g.options, { name: "", price: 0, isAvailable: true }] })}
                className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-terracotta-ink hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add option
              </button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update((gs) => [...gs, { name: "", minSelect: 0, maxSelect: 1, options: [{ name: "", price: 0, isAvailable: true }] }])}
        >
          <Plus className="h-4 w-4" /> Add question
        </Button>
      </div>
    </Card>
  );
}
