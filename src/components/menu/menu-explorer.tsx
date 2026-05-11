"use client";
import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Leaf, Sparkles, Star, X, Grid2x2, Rows3 } from "lucide-react";
import type { MenuCategoryWithItems } from "@/lib/menu";
import type { DishCardData } from "@/components/menu/dish-card";
import { DishCard } from "@/components/menu/dish-card";
import { DishDialog } from "@/components/menu/dish-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/*
 * Menu explorer — Light style. Warm-white ground, hairline borders,
 * sticky filter rail, soft fades on category change. Built for the
 * Aesop / luxury hospitality feel: lots of whitespace, restrained
 * filter chips, no heavy chrome.
 */

type Filter = "all" | "veg" | "signature" | "bestseller";

const FILTERS: { id: Filter; label: string; icon?: React.ElementType }[] = [
  { id: "all", label: "Everything" },
  { id: "signature", label: "Signature", icon: Sparkles },
  { id: "bestseller", label: "Bestseller", icon: Star },
  { id: "veg", label: "Vegetarian", icon: Leaf },
];

export function MenuExplorer({
  categories,
  whatsapp,
}: {
  categories: MenuCategoryWithItems[];
  whatsapp?: string;
}) {
  const [active, setActive] = React.useState<string>(categories[0]?.slug ?? "");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const [layout, setLayout] = React.useState<"grid" | "list">("grid");
  const [selected, setSelected] = React.useState<DishCardData | null>(null);

  const sectionRefs = React.useRef<Record<string, HTMLElement | null>>({});

  const filteredCategories = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => {
          if (filter === "veg" && !i.isVegetarian) return false;
          if (filter === "signature" && !i.isSignature) return false;
          if (filter === "bestseller" && !i.isBestseller) return false;
          if (q.length > 0) {
            const hay = [i.name, i.nameFa, i.description]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        }),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, filter, query]);

  const totalShown = filteredCategories.reduce(
    (acc, c) => acc + c.items.length,
    0,
  );

  const scrollToCategory = (slug: string) => {
    const el = sectionRefs.current[slug];
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 180;
      window.scrollTo({ top, behavior: "smooth" });
    }
    setActive(slug);
  };

  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const slug = (visible[0].target as HTMLElement).dataset.slug;
          if (slug) setActive(slug);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75] },
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [filteredCategories]);

  return (
    <div className="relative bg-warm-white text-black-iron">
      {/* Sticky filter bar */}
      <div className="sticky top-[70px] md:top-[84px] z-30 bg-warm-white/85 backdrop-blur-xl border-b border-black-iron/[0.06]">
        <div className="container-shazdeh py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xl">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-black-iron/40"
                strokeWidth={1.5}
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dishes — saffron, lamb, herbs…"
                className="pl-11 pr-10 h-11 bg-cream/40 border-black-iron/10"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 grid place-items-center h-6 w-6 rounded-full text-black-iron/50 hover:text-black-iron hover:bg-black-iron/5"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>

            <div className="hidden md:flex items-center gap-1 p-1 rounded-pill bg-cream/40 border border-black-iron/10">
              <LayoutToggle
                active={layout === "grid"}
                onClick={() => setLayout("grid")}
                icon={Grid2x2}
                label="Grid"
              />
              <LayoutToggle
                active={layout === "list"}
                onClick={() => setLayout("list")}
                icon={Rows3}
                label="List"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3.5 h-8 rounded-pill text-[10px] tracking-[0.22em] uppercase font-medium transition-all duration-300 border",
                    filter === f.id
                      ? "bg-terracotta text-warm-white border-terracotta"
                      : "bg-transparent text-black-iron/65 hover:text-black-iron border-black-iron/15 hover:border-black-iron/30",
                  )}
                >
                  {Icon && <Icon className="h-3 w-3" strokeWidth={1.6} />}
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Category nav */}
          <div className="flex gap-1 overflow-x-auto pt-1 no-scrollbar -mx-2 px-2">
            {filteredCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => scrollToCategory(c.slug)}
                className={cn(
                  "shrink-0 px-4 h-9 rounded-pill text-[11px] tracking-[0.22em] uppercase font-medium transition-colors",
                  active === c.slug
                    ? "text-terracotta"
                    : "text-black-iron/55 hover:text-black-iron",
                )}
              >
                {c.name}
                <span className="ml-1.5 text-black-iron/35 tabular-nums">
                  {c.items.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="container-shazdeh pt-16 md:pt-24 pb-32">
        {totalShown === 0 ? (
          <div className="py-32 text-center">
            <p className="font-bold text-4xl tracking-[-0.03em] text-black-iron/70">
              No dishes found.
            </p>
            <p className="mt-3 text-black-iron/50 text-sm font-light">
              Try a different search or filter.
            </p>
          </div>
        ) : (
          <div className="space-y-32 md:space-y-44">
            {filteredCategories.map((cat, ci) => (
              <section
                key={cat.id}
                data-slug={cat.slug}
                ref={(el) => {
                  sectionRefs.current[cat.slug] = el;
                }}
                className="scroll-mt-44"
              >
                <div className="grid grid-cols-12 gap-y-6 lg:gap-x-10 mb-14 md:mb-20 items-end">
                  <div className="col-span-12 lg:col-span-8">
                    <p className="text-[10px] tracking-[0.32em] uppercase text-terracotta">
                      {String(ci + 1).padStart(2, "0")} ·{" "}
                      {cat.tagline ?? "Course"}
                    </p>
                    <h2 className="mt-5 font-bold text-4xl md:text-6xl lg:text-7xl tracking-[-0.045em] leading-[0.94]">
                      {cat.name}
                    </h2>
                    {cat.description && (
                      <p className="mt-6 max-w-2xl text-black-iron/65 text-[15px] md:text-[17px] font-light leading-[1.6]">
                        {cat.description}
                      </p>
                    )}
                  </div>
                  <div className="col-span-12 lg:col-span-4 lg:text-right">
                    <p className="text-[10px] tracking-[0.32em] uppercase text-black-iron/45">
                      {cat.items.length}{" "}
                      {cat.items.length === 1 ? "Dish" : "Dishes"}
                    </p>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${cat.id}-${layout}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      layout === "grid"
                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 md:gap-x-8 gap-y-14"
                        : "",
                    )}
                  >
                    {cat.items.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.7,
                          delay: i * 0.04,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <DishCard
                          dish={item}
                          layout={layout === "grid" ? "card" : "row"}
                          onClick={() => setSelected(item)}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </section>
            ))}
          </div>
        )}
      </div>

      <DishDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        dish={selected}
        whatsapp={whatsapp}
      />
    </div>
  );
}

function LayoutToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-3 rounded-pill text-[10px] tracking-[0.22em] uppercase font-medium flex items-center gap-1.5 transition-colors",
        active
          ? "bg-black-iron text-warm-white"
          : "text-black-iron/60 hover:text-black-iron",
      )}
      aria-label={label}
    >
      <Icon className="h-3 w-3" strokeWidth={1.6} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
