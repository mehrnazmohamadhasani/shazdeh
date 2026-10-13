"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, EmptyState, TextInput, IconButton } from "@/components/admin/ui";
import { slugify } from "@/lib/utils";
import { useAdminI18n } from "@/components/admin/i18n";
import type { Translate } from "@/lib/admin-i18n";

type Cat = { id: string; name: string; order: number; isActive: boolean; _count: { items: number } };

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

async function request(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? "Something went wrong");
  }
}

export function CategoriesManager({ initial }: { initial: Cat[] }) {
  const router = useRouter();
  const { t, locale } = useAdminI18n();
  const [names, setNames] = React.useState<Record<string, string>>(() => Object.fromEntries(initial.map((c) => [c.id, c.name])));
  const [busy, setBusy] = React.useState<string | null>(null);
  const [newName, setNewName] = React.useState("");

  // Pick up fresh names after a refresh without clobbering an edit in progress.
  const [synced, setSynced] = React.useState(initial);
  if (synced !== initial) {
    setSynced(initial);
    setNames(Object.fromEntries(initial.map((c) => [c.id, c.name])));
  }

  async function run(id: string, fn: () => Promise<void>, ok?: string) {
    setBusy(id);
    try {
      await fn();
      if (ok) toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error(apiErrorText((e as Error).message, t, locale === "fa"));
    } finally {
      setBusy(null);
    }
  }

  function rename(c: Cat) {
    const name = names[c.id]?.trim();
    if (!name || name === c.name) return setNames((n) => ({ ...n, [c.id]: c.name }));
    run(c.id, () => request(`/api/categories/${c.id}`, "PATCH", { name }), t("Category renamed"));
  }

  function move(index: number, dir: -1 | 1) {
    const list = [...initial];
    const to = index + dir;
    if (to < 0 || to >= list.length) return;
    [list[index], list[to]] = [list[to], list[index]];
    run(list[to].id, () =>
      Promise.all(
        list
          .map((c, i) => ({ c, order: i + 1 }))
          .filter(({ c, order }) => c.order !== order)
          .map(({ c, order }) => request(`/api/categories/${c.id}`, "PATCH", { order })),
      ).then(() => undefined),
    );
  }

  function remove(c: Cat) {
    if (c._count.items > 0) {
      toast.error(
        t("Move or delete the {n} dishes in “{name}” first.", {
          n: c._count.items,
          name: c.name,
        }),
      );
      return;
    }
    if (!confirm(t("Delete the category “{name}”?", { name: c.name }))) return;
    run(c.id, () => request(`/api/categories/${c.id}`, "DELETE"), t("Category deleted"));
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run("new", async () => {
      await request("/api/categories", "POST", { name, slug: slugify(name), order: initial.length + 1, isActive: true });
      setNewName("");
    }, t("Category added"));
  }

  return (
    <Card bodyClassName="p-0 md:p-0">
      {initial.length === 0 ? (
        <EmptyState title={t("No categories yet")} description={t("Add one below — every dish belongs to a category.")} />
      ) : (
        <ul className="divide-y divide-black-iron/[0.06]">
          {initial.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3 md:px-6">
              <TextInput
                value={names[c.id] ?? ""}
                onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))}
                onBlur={() => rename(c)}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                aria-label={t("Category name")}
                dir="auto"
                className="h-10 max-w-xs font-medium"
              />
              <span className="hidden flex-1 text-[13px] text-dark-grey sm:block">
                {t(c._count.items === 1 ? "{n} dish" : "{n} dishes", { n: c._count.items })}
              </span>
              <span className="flex-1 sm:hidden" />
              <label className="flex items-center gap-2 text-[13px] text-dark-grey">
                <Switch
                  checked={c.isActive}
                  disabled={busy !== null}
                  onCheckedChange={(v) => run(c.id, () => request(`/api/categories/${c.id}`, "PATCH", { isActive: v }), v ? t("Category shown") : t("Category hidden"))}
                />
                <span className="hidden sm:inline">{t("Shown")}</span>
              </label>
              <span className="flex items-center">
                <IconButton label={t("Move up")} disabled={i === 0 || busy !== null} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </IconButton>
                <IconButton label={t("Move down")} disabled={i === initial.length - 1 || busy !== null} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </IconButton>
                <IconButton label={t("Delete {name}", { name: c.name })} disabled={busy !== null} onClick={() => remove(c)} danger>
                  {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2 border-t border-black-iron/[0.06] p-4 md:px-6">
        <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("New category, e.g. Desserts")} aria-label={t("New category name")} dir="auto" className="max-w-xs" />
        <Button type="submit" size="sm" disabled={!newName.trim() || busy !== null} className="h-11">
          {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t("Add")}
        </Button>
      </form>
    </Card>
  );
}
