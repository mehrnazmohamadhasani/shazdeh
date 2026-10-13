"use client";
import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, Field, IconButton, TextInput } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import type { Translate } from "@/lib/admin-i18n";

/*
 * Options & add-ons for one dish. A group is a question the customer
 * answers ("Rice", "Extras"); min 1 / max 1 makes it a required single
 * choice, min 0 / max 3 an optional pick-up-to-three.
 */

type Option = { name: string; price: number; isAvailable: boolean };
type Group = { name: string; minSelect: number; maxSelect: number; options: Option[] };

/**
 * API errors in the admin language. Validation errors arrive as
 * "field: message"; in Persian the field path is dropped and the message
 * translated (or a general "check your input" when there's no entry).
 */
function apiErrorText(msg: string, t: Translate, fa: boolean) {
  const m = fa ? /^[\w.]+: (.+)$/.exec(msg) : null;
  if (!m) return t(msg);
  const text = t(m[1]);
  return text !== m[1] ? text : t("Validation failed");
}

export function ModifiersEditor({ itemId, initial }: { itemId: string; initial: Group[] }) {
  const { t, locale } = useAdminI18n();
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
      if (!res.ok) {
        const error = (await res.json().catch(() => null))?.error;
        throw new Error(error ? apiErrorText(error, t, locale === "fa") : t("Couldn't save options"));
      }
      toast.success(t("Options saved"));
      setDirty(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={t("Options & add-ons")}
      description={t("Choices customers make when ordering online. Saved separately.")}
      actions={
        <Button type="button" size="sm" onClick={save} disabled={busy || !dirty}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("Save options")}
        </Button>
      }
    >
      <div className="space-y-4">
        {groups.length === 0 && <p className="text-[13px] text-dark-grey">{t("No options — customers order this dish as it is.")}</p>}
        {groups.map((g, gi) => (
          <div key={gi} className="rounded-[12px] border border-black-iron/[0.08] p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_88px_88px_auto] sm:items-end">
              <Field label={t("Question")}>
                <TextInput value={g.name} onChange={(e) => setGroup(gi, { name: e.target.value })} placeholder={t("e.g. Rice, Extras")} dir="auto" />
              </Field>
              <Field label={t("Min")}>
                <TextInput type="number" dir="ltr" min={0} value={g.minSelect} onChange={(e) => setGroup(gi, { minSelect: Number(e.target.value) })} />
              </Field>
              <Field label={t("Max")}>
                <TextInput type="number" dir="ltr" min={1} value={g.maxSelect} onChange={(e) => setGroup(gi, { maxSelect: Number(e.target.value) })} />
              </Field>
              <div className="flex">
                <IconButton label={t("Move up")} onClick={() => move(gi, -1)} disabled={gi === 0}>
                  <ArrowUp className="h-4 w-4" />
                </IconButton>
                <IconButton label={t("Move down")} onClick={() => move(gi, 1)} disabled={gi === groups.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </IconButton>
                <IconButton label={t("Delete question")} onClick={() => update((gs) => gs.filter((_, i) => i !== gi))} danger>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
            <p className="mt-2 text-[12px] text-dark-grey">
              {g.minSelect > 0
                ? t("Required — customer picks {n}", { n: g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}` })
                : t("Optional — up to {n}", { n: g.maxSelect })}
            </p>
            <div className="mt-3 space-y-2">
              {g.options.map((o, oi) => (
                <div key={oi} className="grid grid-cols-[minmax(0,1fr)_100px_auto_auto] items-center gap-2">
                  <TextInput value={o.name} onChange={(e) => setOption(gi, oi, { name: e.target.value })} placeholder={t("Option")} className="h-10" aria-label={t("Option name")} dir="auto" />
                  <TextInput type="number" min={0} step="0.5" value={o.price} onChange={(e) => setOption(gi, oi, { price: Number(e.target.value) })} className="h-10" aria-label={t("Extra price (AED)")} title={t("Extra price (AED)")} dir="ltr" />
                  <Switch checked={o.isAvailable} onCheckedChange={(v) => setOption(gi, oi, { isAvailable: v })} aria-label={t("In stock")} />
                  <IconButton label={t("Remove option")} onClick={() => setGroup(gi, { options: g.options.filter((_, j) => j !== oi) })}>
                    <X className="h-4 w-4" />
                  </IconButton>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setGroup(gi, { options: [...g.options, { name: "", price: 0, isAvailable: true }] })}
                className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-terracotta-ink hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> {t("Add option")}
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
          <Plus className="h-4 w-4" /> {t("Add question")}
        </Button>
      </div>
    </Card>
  );
}
