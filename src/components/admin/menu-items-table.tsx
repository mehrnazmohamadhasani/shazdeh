"use client";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronRight, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card, EmptyState, Select, StatusPill, TextInput, IconButton } from "@/components/admin/ui";
import { formatPrice, cn } from "@/lib/utils";

type Item = {
  id: string;
  name: string;
  imageUrl: string | null;
  price: number;
  isAvailable: boolean;
  isActive: boolean;
  order: number;
  category: { id: string; name: string };
};

type Cat = { id: string; name: string };

export function MenuItemsTable({ items, categories }: { items: Item[]; categories: Cat[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [activeCat, setActiveCat] = React.useState<string>("all");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) => (activeCat === "all" || i.category.id === activeCat) && (!q || i.name.toLowerCase().includes(q)),
    );
  }, [items, query, activeCat]);
  const canReorder = activeCat !== "all" && !query;

  async function patch(item: Item, body: Partial<Item>, message: string) {
    setPendingId(item.id);
    try {
      const res = await fetch(`/api/menu-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Couldn't update the dish");
      toast.success(message);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPendingId(null);
    }
  }

  /** Moves a dish within its category and renumbers the category 1…n. */
  async function move(item: Item, dir: -1 | 1) {
    const siblings = items.filter((i) => i.category.id === item.category.id).sort((a, b) => a.order - b.order);
    const from = siblings.findIndex((i) => i.id === item.id);
    const to = from + dir;
    if (to < 0 || to >= siblings.length) return;
    [siblings[from], siblings[to]] = [siblings[to], siblings[from]];
    setPendingId(item.id);
    try {
      const changed = siblings.map((s, idx) => ({ s, order: idx + 1 })).filter(({ s, order }) => s.order !== order);
      await Promise.all(
        changed.map(({ s, order }) =>
          fetch(`/api/menu-items/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order }),
          }).then((r) => {
            if (!r.ok) throw new Error("Couldn't reorder");
          }),
        ),
      );
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card bodyClassName="p-0 md:p-0">
      <div className="flex flex-col gap-2 border-b border-black-iron/[0.06] p-4 sm:flex-row md:px-6">
        <label className="relative flex-1">
          <span className="sr-only">Search dishes</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-grey" strokeWidth={1.6} />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dishes" className="pl-10" />
        </label>
        <Select value={activeCat} onChange={(e) => setActiveCat(e.target.value)} aria-label="Category" className="sm:w-56">
          <option value="all">All categories ({items.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({items.filter((i) => i.category.id === c.id).length})
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No dishes found" description="Try another search or category." />
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1fr)_96px_88px_88px_76px] items-center gap-3 border-b border-black-iron/[0.06] px-6 py-2.5 text-[12px] font-medium text-dark-grey md:grid">
            <span>Dish</span>
            <span className="text-right">Price</span>
            <span className="text-center">On menu</span>
            <span className="text-center">In stock</span>
            <span />
          </div>
          <ul className="divide-y divide-black-iron/[0.06]">
            {filtered.map((item, idx) => (
              <li
                key={item.id}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_96px_88px_88px_76px] md:px-6",
                  pendingId === item.id && "opacity-50",
                )}
              >
                <Link href={`/admin/menu-items/${item.id}`} className="flex min-w-0 items-center gap-3">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-cream">
                    {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-black-iron">{item.name}</span>
                    <span className="flex items-center gap-2 text-[12.5px] text-dark-grey">
                      <span className="truncate">{item.category.name}</span>
                      <span className="tabular-nums md:hidden">· {formatPrice(item.price)}</span>
                    </span>
                    <span className="mt-1 flex gap-1.5 md:hidden">
                      {!item.isActive && <StatusPill>Hidden</StatusPill>}
                      {item.isActive && !item.isAvailable && <StatusPill tone="warn">Sold out</StatusPill>}
                    </span>
                  </span>
                </Link>

                <span className="hidden text-right text-[14px] tabular-nums md:block">{formatPrice(item.price)}</span>
                <span className="hidden justify-center md:flex">
                  <Switch
                    checked={item.isActive}
                    disabled={pendingId === item.id}
                    aria-label={`Show ${item.name} on the menu`}
                    onCheckedChange={(v) => patch(item, { isActive: v }, v ? "Shown on the menu" : "Hidden from the menu")}
                  />
                </span>
                <span className="flex justify-center">
                  <Switch
                    checked={item.isAvailable}
                    disabled={pendingId === item.id}
                    aria-label={`${item.name} in stock`}
                    onCheckedChange={(v) => patch(item, { isAvailable: v }, v ? "Back in stock" : "Marked sold out")}
                  />
                </span>
                <span className="hidden items-center justify-end gap-0.5 md:flex">
                  {canReorder ? (
                    <>
                      <IconButton label="Move up" disabled={idx === 0 || pendingId !== null} onClick={() => move(item, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Move down" disabled={idx === filtered.length - 1 || pendingId !== null} onClick={() => move(item, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </IconButton>
                    </>
                  ) : (
                    <Link href={`/admin/menu-items/${item.id}`} aria-label={`Edit ${item.name}`} className="grid h-9 w-9 place-items-center rounded-full text-dark-grey hover:bg-black-iron/[0.05]">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {!canReorder && (
            <p className="border-t border-black-iron/[0.06] px-6 py-3 text-[12px] text-dark-grey">
              Choose a category to reorder its dishes.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
