"use client";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Star,
  Leaf,
  Flame,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatPrice, cn } from "@/lib/utils";

type Item = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  price: number;
  currency: string;
  isAvailable: boolean;
  isBestseller: boolean;
  isSignature: boolean;
  isNew: boolean;
  isVegetarian: boolean;
  spicyLevel: number;
  category: { id: string; name: string };
};

type Cat = { id: string; name: string };

export function MenuItemsTable({
  items,
  categories,
}: {
  items: Item[];
  categories: Cat[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [activeCat, setActiveCat] = React.useState<string>("all");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (activeCat !== "all" && i.category.id !== activeCat) return false;
      if (q && !i.name.toLowerCase().includes(q) && !i.slug.includes(q))
        return false;
      return true;
    });
  }, [items, query, activeCat]);

  async function toggleAvailable(item: Item, value: boolean) {
    setPendingId(item.id);
    try {
      const res = await fetch(`/api/menu-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: value }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(value ? "Marked available" : "Marked sold out");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPendingId(null);
    }
  }

  async function remove(item: Item) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setPendingId(item.id);
    try {
      const res = await fetch(`/api/menu-items/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Dish deleted");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-warm-white/45"
            strokeWidth={1.5}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dishes…"
            className="pl-10"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <CatChip
            active={activeCat === "all"}
            onClick={() => setActiveCat("all")}
            label="All"
            count={items.length}
          />
          {categories.map((c) => {
            const count = items.filter((i) => i.category.id === c.id).length;
            return (
              <CatChip
                key={c.id}
                active={activeCat === c.id}
                onClick={() => setActiveCat(c.id)}
                label={c.name}
                count={count}
              />
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] overflow-hidden">
        <div className="hidden md:grid grid-cols-[64px_minmax(0,1fr)_120px_120px_140px_120px_60px] items-center px-4 py-3 border-b border-warm-white/[0.08] text-[10px] tracking-[0.22em] uppercase font-medium text-warm-white/55">
          <span></span>
          <span>Dish</span>
          <span>Category</span>
          <span>Price</span>
          <span>Tags</span>
          <span>Available</span>
          <span></span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-bold text-2xl tracking-[-0.03em] text-warm-white/70">
              No dishes found.
            </p>
            <p className="mt-2 text-warm-white/50 text-[13px] font-light">
              Try a different search or category.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-warm-white/[0.06]">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "grid grid-cols-[64px_minmax(0,1fr)_auto] md:grid-cols-[64px_minmax(0,1fr)_120px_120px_140px_120px_60px] gap-3 md:gap-2 items-center px-4 py-3.5 transition-colors hover:bg-warm-white/[0.03]",
                  pendingId === item.id && "opacity-50",
                )}
              >
                <div className="relative h-12 w-12 rounded-sm overflow-hidden bg-black-iron border border-warm-white/[0.06]">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="text-warm-white text-[13px] truncate font-medium">
                    {item.name}
                  </p>
                  <p className="text-warm-white/45 text-[11px] truncate font-mono">
                    {item.slug}
                  </p>
                  <p className="md:hidden text-warm-white/55 text-[11px] mt-1 font-light">
                    {item.category.name} ·{" "}
                    {formatPrice(item.price, item.currency)}
                  </p>
                </div>
                <span className="hidden md:block text-warm-white/70 text-[13px] truncate font-light">
                  {item.category.name}
                </span>
                <span className="hidden md:block text-terracotta text-[13px] font-medium tabular-nums">
                  {formatPrice(item.price, item.currency)}
                </span>
                <div className="hidden md:flex flex-wrap gap-1">
                  {item.isSignature && (
                    <Badge variant="signature">Sig</Badge>
                  )}
                  {item.isBestseller && !item.isSignature && (
                    <Badge variant="default">
                      <Star className="h-2.5 w-2.5" strokeWidth={1.6} /> Best
                    </Badge>
                  )}
                  {item.isNew && <Badge variant="new">New</Badge>}
                  {item.isVegetarian && (
                    <Badge variant="veg">
                      <Leaf className="h-2.5 w-2.5" strokeWidth={1.6} />
                    </Badge>
                  )}
                  {item.spicyLevel > 0 && (
                    <Badge variant="spicy">
                      <Flame className="h-2.5 w-2.5" strokeWidth={1.6} />
                    </Badge>
                  )}
                </div>
                <div className="hidden md:flex items-center gap-2">
                  <Switch
                    checked={item.isAvailable}
                    onCheckedChange={(v) => toggleAvailable(item, v)}
                    disabled={pendingId === item.id}
                  />
                  <span className="text-warm-white/55">
                    {item.isAvailable ? (
                      <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} />
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <Link
                    href={`/admin/menu-items/${item.id}`}
                    className="grid place-items-center h-8 w-8 rounded-md text-warm-white/55 hover:text-warm-white hover:bg-warm-white/[0.06] transition-colors"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Link>
                  <button
                    onClick={() => remove(item)}
                    className="grid place-items-center h-8 w-8 rounded-md text-warm-white/55 hover:text-pomegranate-red hover:bg-pomegranate-red/[0.10] transition-colors"
                    aria-label="Delete"
                    disabled={pendingId === item.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CatChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-pill text-[10px] tracking-[0.22em] uppercase font-medium transition-colors border",
        active
          ? "bg-terracotta text-warm-white border-terracotta"
          : "bg-transparent text-warm-white/65 hover:text-warm-white border-warm-white/15",
      )}
    >
      {label}
      <span
        className={cn(
          "text-[10px] tabular-nums",
          active ? "text-warm-white/80" : "text-warm-white/45",
        )}
      >
        {count}
      </span>
    </button>
  );
}
