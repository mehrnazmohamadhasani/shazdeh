"use client";
import * as React from "react";
import { Grid2x2, Rows3, Search, X } from "lucide-react";
import type { MenuCategoryWithItems } from "@/lib/menu";
import type { DishCardData } from "@/lib/dish";
import { DishCard } from "@/components/menu/dish-card";
import { DishDialog } from "@/components/menu/dish-dialog";
import { cn } from "@/lib/utils";

/*
 * Menu explorer.
 *
 * Phones: only a slim category rail is sticky (search & layout sit in
 * the flow above the dishes) so the plates keep the screen. Dishes are
 * a two-up grid — photography stays the hero while a 30-dish menu
 * remains a comfortable scroll.
 * Desktop: one sticky bar carrying categories and search.
 */

export function MenuExplorer({
  categories,
  whatsapp,
}: {
  categories: MenuCategoryWithItems[];
  whatsapp?: string;
}) {
  const [active, setActive] = React.useState(categories[0]?.slug ?? "");
  const [query, setQuery] = React.useState("");
  const [layout, setLayout] = React.useState<"grid" | "list">("grid");
  const [selected, setSelected] = React.useState<DishCardData | null>(null);

  const sectionRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const chipRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const deferredQuery = React.useDeferredValue(query);

  const filtered = React.useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => {
          if (q) {
            const hay = [i.name, i.nameFa, i.description, i.ingredients]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        }),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, deferredQuery]);

  const total = filtered.reduce((n, c) => n + c.items.length, 0);
  const isFiltering = deferredQuery.trim() !== "";

  const scrollToCategory = (slug: string) => {
    sectionRefs.current[slug]?.scrollIntoView({ block: "start" });
    setActive(slug);
  };

  // Track the category in view; keep its chip visible in the rail.
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const slug = (visible[0]?.target as HTMLElement | undefined)?.dataset
          .slug;
        if (slug) {
          setActive(slug);
          chipRefs.current[slug]?.scrollIntoView({
            block: "nearest",
            inline: "center",
          });
        }
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [filtered]);

  const reset = () => setQuery("");

  const search = (idSuffix: string, className?: string) => (
    <div className={cn("relative", className)}>
      <label htmlFor={`menu-search-${idSuffix}`} className="sr-only">
        Search the menu
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-grey"
        strokeWidth={1.5}
      />
      <input
        id={`menu-search-${idSuffix}`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search — saffron, lamb, herbs…"
        autoComplete="off"
        className="h-11 w-full rounded-pill border border-black-iron/15 bg-white/60 pl-11 pr-11 text-[14px] font-normal text-black-iron placeholder:text-dark-grey/80 transition-colors focus:border-terracotta/60 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-dark-grey hover:bg-black-iron/5 hover:text-black-iron"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );

  return (
    <div className="relative">
      {/* Sticky category rail (+ desktop controls) */}
      <div className="glass-soft sticky top-[calc(68px+var(--safe-top))] z-30 border-y border-black-iron/[0.07] md:top-[calc(84px+var(--safe-top))]">
        <div className="container-shazdeh flex items-center gap-6">
          <nav
            aria-label="Menu categories"
            className="no-scrollbar -mx-2 flex min-w-0 flex-1 gap-1 overflow-x-auto px-2 py-2.5"
          >
            {filtered.map((c) => (
              <button
                key={c.id}
                ref={(el) => {
                  chipRefs.current[c.slug] = el;
                }}
                type="button"
                aria-current={active === c.slug ? "true" : undefined}
                onClick={() => scrollToCategory(c.slug)}
                className={cn(
                  "relative h-10 shrink-0 rounded-pill px-4 text-[11px] font-medium uppercase tracking-[0.2em] transition-colors duration-300",
                  active === c.slug
                    ? "bg-terracotta text-white"
                    : "text-dark-grey hover:text-black-iron",
                )}
              >
                {c.name}
                <span
                  className={cn(
                    "ml-2 tabular-nums",
                    active === c.slug ? "text-white/75" : "text-dark-grey/70",
                  )}
                >
                  {c.items.length}
                </span>
              </button>
            ))}
          </nav>
          {search("desktop", "hidden w-72 shrink-0 py-2.5 lg:block")}
        </div>
      </div>

      {/* Search (phones/tablets) and layout — in the flow */}
      <div className="container-shazdeh flex flex-col gap-3 pt-8 sm:flex-row sm:items-center sm:justify-between md:pt-10">
        {search("mobile", "sm:w-80 lg:hidden")}
        <div
          role="group"
          aria-label="Layout"
          className="hidden items-center gap-1 rounded-pill border border-black-iron/15 p-1 sm:ml-auto sm:flex"
        >
          <LayoutToggle
            active={layout === "grid"}
            onClick={() => setLayout("grid")}
            icon={Grid2x2}
            label="Grid view"
          />
          <LayoutToggle
            active={layout === "list"}
            onClick={() => setLayout("list")}
            icon={Rows3}
            label="List view"
          />
        </div>
      </div>

      <div className="container-shazdeh pb-28 pt-12 md:pt-16">
        <p aria-live="polite" className="sr-only">
          {isFiltering ? `${total} ${total === 1 ? "dish" : "dishes"} shown` : ""}
        </p>

        {total === 0 ? (
          <div className="mx-auto max-w-md py-24 text-center">
            <p className="t-h3">Nothing matches that — yet.</p>
            <p className="t-body mt-3 text-dark-grey">
              Try another ingredient, or browse the full menu.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-8 h-12 rounded-pill border border-black-iron/25 px-7 text-[11px] font-medium uppercase tracking-[0.2em] hover:border-terracotta hover:text-terracotta-ink"
            >
              Show all dishes
            </button>
          </div>
        ) : (
          <div className="space-y-24 md:space-y-36">
            {filtered.map((cat, ci) => (
              <section
                key={cat.id}
                id={cat.slug}
                data-slug={cat.slug}
                ref={(el) => {
                  sectionRefs.current[cat.slug] = el;
                }}
                aria-labelledby={`cat-${cat.slug}`}
                className="scroll-mt-[150px] md:scroll-mt-[190px]"
              >
                <header className="mb-10 border-b border-black-iron/10 pb-8 md:mb-14">
                  <h2 id={`cat-${cat.slug}`} className="t-h2">
                    {cat.name}
                  </h2>
                </header>

                <div
                  className={cn(
                    layout === "grid"
                      ? "grid grid-cols-2 gap-x-3 gap-y-12 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16"
                      : "border-b border-[var(--color-border)]",
                  )}
                >
                  {cat.items.map((item, i) => (
                    <DishCard
                      key={item.id}
                      dish={item}
                      layout={layout === "grid" ? "card" : "row"}
                      onSelect={setSelected}
                      imagePriority={ci === 0 && i < 2}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <DishDialog
        dish={selected}
        onOpenChange={(o) => !o && setSelected(null)}
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-8 w-10 place-items-center rounded-pill transition-colors",
        active
          ? "bg-black-iron text-warm-white"
          : "text-dark-grey hover:text-black-iron",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
    </button>
  );
}
