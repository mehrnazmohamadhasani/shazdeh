"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, EmptyState, TextInput, IconButton } from "@/components/admin/ui";
import { slugify } from "@/lib/utils";

type Cat = { id: string; name: string; order: number; isActive: boolean; _count: { items: number } };

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
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function rename(c: Cat) {
    const name = names[c.id]?.trim();
    if (!name || name === c.name) return setNames((n) => ({ ...n, [c.id]: c.name }));
    run(c.id, () => request(`/api/categories/${c.id}`, "PATCH", { name }), "Category renamed");
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
      toast.error(`Move or delete the ${c._count.items} dishes in “${c.name}” first.`);
      return;
    }
    if (!confirm(`Delete the category “${c.name}”?`)) return;
    run(c.id, () => request(`/api/categories/${c.id}`, "DELETE"), "Category deleted");
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run("new", async () => {
      await request("/api/categories", "POST", { name, slug: slugify(name), order: initial.length + 1, isActive: true });
      setNewName("");
    }, "Category added");
  }

  return (
    <Card bodyClassName="p-0 md:p-0">
      {initial.length === 0 ? (
        <EmptyState title="No categories yet" description="Add one below — every dish belongs to a category." />
      ) : (
        <ul className="divide-y divide-black-iron/[0.06]">
          {initial.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3 md:px-6">
              <TextInput
                value={names[c.id] ?? ""}
                onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))}
                onBlur={() => rename(c)}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                aria-label="Category name"
                className="h-10 max-w-xs font-medium"
              />
              <span className="hidden flex-1 text-[13px] text-dark-grey sm:block">
                {c._count.items} {c._count.items === 1 ? "dish" : "dishes"}
              </span>
              <span className="flex-1 sm:hidden" />
              <label className="flex items-center gap-2 text-[13px] text-dark-grey">
                <Switch
                  checked={c.isActive}
                  disabled={busy !== null}
                  onCheckedChange={(v) => run(c.id, () => request(`/api/categories/${c.id}`, "PATCH", { isActive: v }), v ? "Category shown" : "Category hidden")}
                />
                <span className="hidden sm:inline">Shown</span>
              </label>
              <span className="flex items-center">
                <IconButton label="Move up" disabled={i === 0 || busy !== null} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </IconButton>
                <IconButton label="Move down" disabled={i === initial.length - 1 || busy !== null} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </IconButton>
                <IconButton label={`Delete ${c.name}`} disabled={busy !== null} onClick={() => remove(c)} danger>
                  {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2 border-t border-black-iron/[0.06] p-4 md:px-6">
        <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category, e.g. Desserts" aria-label="New category name" className="max-w-xs" />
        <Button type="submit" size="sm" disabled={!newName.trim() || busy !== null} className="h-11">
          {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </form>
    </Card>
  );
}
