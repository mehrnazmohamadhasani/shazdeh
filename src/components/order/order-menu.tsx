"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Clock, Leaf, MapPin, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AreaPicker } from "@/components/order/area-picker";
import { BasketPanel } from "@/components/order/basket-panel";
import { ProductSheet, type SheetTarget } from "@/components/order/product-sheet";
import { cart, recentOrders, useCart, type RecentOrder } from "@/components/order/cart-store";
import { useBasket, useOrderData } from "@/components/order/order-data";
import { formatFils } from "@/lib/ordering/money";
import type { OrderProduct } from "@/lib/ordering/types";
import { cn } from "@/lib/utils";

/*
 * Direct ordering — the menu screen.
 *
 * Flow: confirm the area → browse → tap a dish → add. Categories stay
 * reachable in a sticky rail, the basket is a sticky column on desktop
 * and a thumb-height bar on phones. No motion beyond what helps.
 */

type Partner = { label: string; url: string };

const noopSubscribe = () => () => {};

/** The last order placed on this device in the past 6 hours, as a stable string snapshot. */
function recentOrderSnapshot() {
  const last = recentOrders.list()[0];
  return JSON.stringify(last && Date.now() - new Date(last.placedAt).getTime() < 6 * 3600_000 ? last : null);
}

export function OrderMenu({ partners, whatsapp }: { partners: Partner[]; whatsapp?: string }) {
  const { categories, config } = useOrderData();
  const { areaId } = useCart();
  const basket = useBasket();
  const [sheet, setSheet] = React.useState<SheetTarget>(null);
  const [deepLinkDone, setDeepLinkDone] = React.useState(false);
  const [areaOpen, setAreaOpen] = React.useState(false);
  const [basketOpen, setBasketOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [vegOnly, setVegOnly] = React.useState(false);
  const [active, setActive] = React.useState(categories[0]?.slug ?? "");
  const hydrated = React.useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Deep link from dish pages: /order?dish=<slug> opens that dish once.
  const deepSlug = React.useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("dish"),
    () => null,
  );
  const deepProduct = React.useMemo(
    () => (deepSlug ? categories.flatMap((c) => c.products).find((p) => p.variants.some((v) => v.slug === deepSlug)) : undefined),
    [deepSlug, categories],
  );
  const activeSheet: SheetTarget = sheet ?? (!deepLinkDone && deepProduct ? { product: deepProduct } : null);

  // A recent order from this device, offered as "Track your order".
  const recentRaw = React.useSyncExternalStore(noopSubscribe, recentOrderSnapshot, () => "null");
  const recent = React.useMemo(() => JSON.parse(recentRaw) as RecentOrder | null, [recentRaw]);

  // Ask for the area up-front, once, if none is chosen yet.
  React.useEffect(() => {
    if (hydrated && !areaId && config.canOrder) {
      const t = setTimeout(() => setAreaOpen(true), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const q = query.trim().toLowerCase();
  const visible = React.useMemo(
    () =>
      categories
        .map((c) => ({
          ...c,
          products: c.products.filter(
            (p) =>
              (!vegOnly || p.isVegetarian) &&
              (!q ||
                p.title.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q) ||
                p.nameFa?.includes(query.trim())),
          ),
        }))
        .filter((c) => c.products.length > 0),
    [categories, q, query, vegOnly],
  );
  const loved = React.useMemo(
    () => categories.flatMap((c) => c.products).filter((p) => p.isBestseller || p.isSignature).slice(0, 8),
    [categories],
  );

  // Scroll-spy for the category rail.
  React.useEffect(() => {
    const els = visible.map((c) => document.getElementById(`cat-${c.slug}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id.slice(4));
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [visible]);

  React.useEffect(() => {
    document.getElementById(`rail-${active}`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  const counts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const l of basket.lines) m.set(l.product.key, (m.get(l.product.key) ?? 0) + l.quantity);
    return m;
  }, [basket.lines]);

  function quickAdd(p: OrderProduct) {
    const orderable = p.variants.filter((v) => v.orderable);
    // One portion and nothing to choose: add straight from the list.
    const simple = p.variants.length === 1 && orderable.length === 1 && orderable[0].groups.length === 0;
    if (simple && config.canOrder) {
      cart.add(orderable[0].itemId, [], 1);
      toast.success(`Added ${p.title}`, { duration: 1500, position: "top-center" });
    } else {
      setSheet({ product: p });
    }
  }

  const zone = basket.zone;

  return (
    <>
      <section className="container-shazdeh pt-6 md:pt-10">
        <p className="eyebrow eyebrow-accent">Order direct · Delivery across Dubai</p>
        <h1 className="mt-3 text-[2.125rem] font-bold leading-[1] tracking-[-0.04em] md:text-[3.25rem]">
          From our kitchen to your door.
        </h1>

        <div className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] md:max-w-3xl">
          <button
            type="button"
            onClick={() => setAreaOpen(true)}
            className="flex min-h-14 items-center gap-3 rounded-[14px] border border-black-iron/12 bg-white/60 px-4 text-left transition-colors hover:border-black-iron/30"
          >
            <MapPin className="h-5 w-5 shrink-0 text-terracotta-ink" strokeWidth={1.6} />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-dark-grey">Deliver to</span>
              <span className="block truncate text-[15px] font-semibold">
                {hydrated && basket.area ? basket.area.name : "Choose your area"}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" strokeWidth={1.6} />
          </button>
          <div className="flex min-h-14 items-center gap-3 rounded-[14px] bg-cream px-4 text-[13px]">
            <Clock className="h-4 w-4 shrink-0 text-terracotta-ink" strokeWidth={1.6} />
            <span className="tabular-nums">
              {hydrated && zone ? (
                <>
                  <strong className="font-semibold">{zone.etaMin}–{zone.etaMax} min</strong>
                  <span className="text-dark-grey">
                    {" · "}
                    {zone.feeFils === 0 ? "Free delivery" : `${formatFils(zone.feeFils)} delivery`}
                  </span>
                </>
              ) : (
                <span className={cn(config.kitchenOpen ? "text-olive-leaf" : "text-rose-sumac", "font-medium")}>
                  {config.kitchenLabel}
                </span>
              )}
            </span>
          </div>
        </div>

        {!config.canOrder && <ClosedNotice partners={partners} whatsapp={whatsapp} />}

        {recent && (
          <Link
            href={`/order/track/${recent.token}`}
            className="mt-3 flex min-h-12 items-center justify-between rounded-[14px] bg-black-iron px-4 text-[13.5px] text-warm-white md:max-w-3xl"
          >
            <span>
              Track your order <strong className="tabular-nums">{recent.number}</strong>
            </span>
            <span aria-hidden>→</span>
          </Link>
        )}
      </section>

      {/* Sticky rail */}
      <div className="sticky top-[calc(60px+var(--safe-top))] z-30 mt-6 border-y border-black-iron/[0.07] bg-warm-white/95 backdrop-blur md:top-[calc(68px+var(--safe-top))]">
        <div className="container-shazdeh flex items-center gap-2 py-2">
          <label className="relative shrink-0">
            <span className="sr-only">Search the menu</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-grey" strokeWidth={1.6} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-10 w-[7.5rem] rounded-full border border-black-iron/12 bg-transparent pl-9 pr-3 text-[13.5px] transition-[width] focus:w-[12rem] focus:border-terracotta/60 focus:outline-none sm:w-44 sm:focus:w-56"
            />
          </label>
          <button
            type="button"
            aria-pressed={vegOnly}
            onClick={() => setVegOnly((v) => !v)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors",
              vegOnly ? "border-olive-leaf bg-olive-leaf text-white" : "border-black-iron/12 hover:border-olive-leaf",
            )}
          >
            <Leaf className="h-3.5 w-3.5" strokeWidth={1.7} /> Veg
          </button>
          <nav aria-label="Menu categories" className="no-scrollbar -mr-6 flex flex-1 gap-1 overflow-x-auto pr-6">
            {visible.map((c) => (
              <a
                key={c.slug}
                id={`rail-${c.slug}`}
                href={`#cat-${c.slug}`}
                aria-current={active === c.slug ? "true" : undefined}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[13px] font-medium transition-colors",
                  active === c.slug ? "bg-black-iron text-warm-white" : "text-black-iron/70 hover:text-black-iron",
                )}
              >
                {c.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="container-shazdeh grid gap-10 pb-32 pt-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-20">
        <div className="min-w-0">
          {!q && !vegOnly && loved.length > 0 && (
            <section aria-labelledby="loved-heading" className="mb-10">
              <h2 id="loved-heading" className="text-[1.375rem] font-bold tracking-[-0.03em]">
                Most loved
              </h2>
              <ul className="no-scrollbar -mx-6 mt-4 flex snap-x scroll-px-6 gap-3 overflow-x-auto px-6 sm:mx-0 sm:scroll-px-0 sm:px-0">
                {loved.map((p, i) => (
                  <li key={p.key} className="w-[44%] shrink-0 snap-start sm:w-[30%] xl:w-[23%]">
                    <button type="button" onClick={() => setSheet({ product: p })} className="group block w-full text-left">
                      <div className="arch relative aspect-[4/5] overflow-hidden bg-cream">
                        {p.imageUrl && (
                          <Image
                            src={p.imageUrl}
                            alt=""
                            fill
                            preload={i < 2}
                            sizes="(min-width: 1280px) 180px, (min-width: 640px) 28vw, 44vw"
                            className="img-zoom object-cover"
                          />
                        )}
                      </div>
                      <p className="mt-3 text-[14px] font-semibold leading-tight">{p.title}</p>
                      <p className="mt-1 text-[13px] tabular-nums text-dark-grey">{formatFils(p.fromPriceFils)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {visible.length === 0 && (
            <div className="rounded-[14px] bg-cream px-6 py-12 text-center">
              <p className="text-[16px] font-semibold">Nothing matches “{query || "vegetarian"}”.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setVegOnly(false);
                }}
                className="mt-3 min-h-11 text-[13px] font-medium text-terracotta-ink underline underline-offset-4"
              >
                Clear search
              </button>
            </div>
          )}

          {visible.map((c) => (
            <section key={c.slug} id={`cat-${c.slug}`} aria-labelledby={`h-${c.slug}`} className="mb-10 scroll-mt-[140px]">
              <div className="flex items-baseline justify-between gap-4 border-b border-black-iron/10 pb-3">
                <h2 id={`h-${c.slug}`} className="text-[1.375rem] font-bold tracking-[-0.03em]">
                  {c.name}
                </h2>
                {c.tagline && <span className="caption hidden sm:inline">{c.tagline}</span>}
              </div>
              <ul className="grid md:grid-cols-2 md:gap-x-8">
                {c.products.map((p) => (
                  <li key={p.key} className="border-b border-black-iron/[0.07]">
                    <ProductRow
                      product={p}
                      count={counts.get(p.key) ?? 0}
                      onOpen={() => setSheet({ product: p })}
                      onAdd={() => quickAdd(p)}
                      canOrder={config.canOrder}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <MenuFootnote config={config} />
        </div>

        <aside className="hidden lg:block" aria-label="Basket">
          <div className="sticky top-[calc(132px+var(--safe-top))] max-h-[calc(100svh-150px-var(--safe-top))] overflow-y-auto rounded-[18px] border border-black-iron/10 bg-white/70">
            <BasketPanel
              onEdit={(product, line) => setSheet({ product, editing: line })}
              onChooseArea={() => setAreaOpen(true)}
            />
          </div>
        </aside>
      </div>

      {/* Mobile basket bar */}
      {hydrated && basket.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-[max(1rem,var(--safe-left))] pb-[max(0.75rem,var(--safe-bottom))] pt-3 lg:hidden">
          <button
            type="button"
            onClick={() => setBasketOpen(true)}
            className="flex h-14 w-full items-center justify-between rounded-full bg-terracotta px-5 text-white shadow-[0_14px_40px_-12px_rgba(176,57,27,0.6)]"
          >
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-white/20 px-2 text-[12.5px] font-semibold tabular-nums">
              {basket.count}
            </span>
            <span className="text-[14px] font-semibold">View basket</span>
            <span className="text-[14px] font-semibold tabular-nums">{formatFils(basket.totals.totalFils)}</span>
          </button>
        </div>
      )}

      <Dialog open={basketOpen} onOpenChange={setBasketOpen}>
        <DialogContent className="bg-warm-white sm:max-w-[480px]">
          <DialogTitle className="sr-only">Your basket</DialogTitle>
          <BasketPanel
            className="bg-warm-white"
            onEdit={(product, line) => {
              setBasketOpen(false);
              setSheet({ product, editing: line });
            }}
            onChooseArea={() => {
              setBasketOpen(false);
              setAreaOpen(true);
            }}
            onNavigate={() => setBasketOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ProductSheet
        target={activeSheet}
        onClose={() => {
          setSheet(null);
          setDeepLinkDone(true);
        }}
        canOrder={config.canOrder}
      />
      <AreaPicker open={areaOpen} onOpenChange={setAreaOpen} partners={partners} />
    </>
  );
}

function ProductRow({
  product: p,
  count,
  onOpen,
  onAdd,
  canOrder,
}: {
  product: OrderProduct;
  count: number;
  onOpen: () => void;
  onAdd: () => void;
  canOrder: boolean;
}) {
  const soldOut = p.variants.every((v) => !v.orderable);
  return (
    <article className="group relative flex gap-4 py-5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terracotta">
      <div className="min-w-0 flex-1">
        <h3 className="text-[15.5px] font-semibold leading-snug tracking-[-0.01em]">
          <button type="button" onClick={onOpen} className="stretched text-left focus-visible:outline-none">
            {p.title}
          </button>
        </h3>
        {p.nameFa && (
          <p lang="fa" dir="rtl" className="mt-0.5 text-left text-[13px] text-dark-grey">
            {p.nameFa}
          </p>
        )}
        {p.description && <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.55] text-dark-grey">{p.description}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <span className="font-semibold tabular-nums">
            {p.variants.length > 1 && <span className="font-normal text-dark-grey">from </span>}
            {formatFils(p.fromPriceFils)}
          </span>
          {p.isSignature && <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-terracotta-ink">Signature</span>}
          {p.isBestseller && !p.isSignature && (
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-dark-grey">Most loved</span>
          )}
          {p.isVegetarian && (
            <span className="inline-flex items-center gap-1 text-[12px] text-olive-leaf">
              <Leaf className="h-3 w-3" strokeWidth={1.8} aria-hidden /> Veg
            </span>
          )}
          {soldOut && <span className="text-[12px] font-medium text-rose-sumac">Sold out today</span>}
        </div>
      </div>

      <div className="relative h-[104px] w-[104px] shrink-0 sm:h-28 sm:w-28">
        <div className="arch relative h-full w-full overflow-hidden bg-cream">
          {p.imageUrl ? (
            <Image
              src={p.imageUrl}
              alt=""
              fill
              sizes="112px"
              className={cn("object-cover", soldOut && "opacity-50 grayscale")}
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center font-[family-name:var(--font-logo)] text-4xl text-black-iron/15">
              {p.title[0]}
            </span>
          )}
        </div>
        {!soldOut && canOrder && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add ${p.title}`}
            className={cn(
              "absolute -bottom-2 -right-2 z-[2] grid h-11 min-w-11 place-items-center rounded-full border-[3px] border-warm-white px-2 text-[13px] font-semibold shadow-sm transition-colors",
              count > 0 ? "bg-black-iron text-warm-white" : "bg-terracotta text-white hover:bg-terracotta-ink",
            )}
          >
            {count > 0 ? <span className="tabular-nums">{count}</span> : <Plus className="h-5 w-5" strokeWidth={2} />}
          </button>
        )}
      </div>
    </article>
  );
}

function ClosedNotice({ partners, whatsapp }: { partners: Partner[]; whatsapp?: string }) {
  const { config } = useOrderData();
  return (
    <div role="status" className="mt-3 rounded-[14px] border border-rose-sumac/25 bg-rose-sumac/[0.06] px-4 py-4 md:max-w-3xl">
      <p className="text-[14.5px] font-semibold text-rose-sumac">
        {!config.acceptingOrders
          ? config.pausedMessage || "Online ordering is paused right now."
          : `We're closed — ${config.kitchenLabel.toLowerCase()}.`}
      </p>
      <p className="mt-1 text-[13.5px] text-dark-grey">
        You can still browse the menu{partners.length || whatsapp ? ", or reach us here:" : "."}
      </p>
      {(partners.length > 0 || whatsapp) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center rounded-full bg-black-iron px-4 text-[12.5px] font-medium text-warm-white"
            >
              WhatsApp the kitchen
            </a>
          )}
          {partners.map((p) => (
            <a
              key={p.label}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center rounded-full border border-black-iron/20 px-4 text-[12.5px] font-medium hover:border-terracotta"
            >
              {p.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuFootnote({ config }: { config: { vatRate: number; pricesIncludeVat: boolean } }) {
  return (
    <p className="mt-6 max-w-2xl text-[12px] leading-[1.6] text-dark-grey">
      {config.pricesIncludeVat ? `All prices are in AED and include ${config.vatRate}% VAT. ` : "Prices are in AED, VAT is added at checkout. "}
      Dishes may contain or come into contact with nuts, dairy, gluten, sesame and other allergens — open a dish for its
      ingredients and allergens, and tell us about any allergy before ordering.{" "}
      <Link href="/legal/delivery" className="underline underline-offset-2">
        Delivery policy
      </Link>
      .
    </p>
  );
}
