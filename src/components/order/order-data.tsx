"use client";
import * as React from "react";
import { useCart, type CartLine } from "@/components/order/cart-store";
import { computeTotals, priceLines, type PricedLine, type Totals, type ZoneTerms } from "@/lib/ordering/pricing";
import {
  variantToPricingItem,
  type OrderArea,
  type OrderCategory,
  type OrderingConfig,
  type OrderProduct,
  type OrderVariant,
} from "@/lib/ordering/types";

/*
 * Menu, coverage and settings for the ordering screens, plus a derived
 * basket preview. The preview uses the same pricing engine as the
 * server, so what customers see matches the final quote unless
 * something changes in between (which checkout then flags).
 */

export type OrderData = {
  categories: OrderCategory[];
  areas: OrderArea[];
  zones: ZoneTerms[];
  config: OrderingConfig;
};

type Entry = { product: OrderProduct; variant: OrderVariant };

type Ctx = OrderData & {
  lookup: (itemId: string) => Entry | undefined;
  areaById: (id: string | null) => OrderArea | undefined;
  zoneById: (id: string | null | undefined) => ZoneTerms | undefined;
};

const OrderDataContext = React.createContext<Ctx | null>(null);

export function OrderDataProvider({ data, children }: { data: OrderData; children: React.ReactNode }) {
  const value = React.useMemo<Ctx>(() => {
    const index = new Map<string, Entry>();
    for (const c of data.categories) {
      for (const p of c.products) for (const v of p.variants) index.set(v.itemId, { product: p, variant: v });
    }
    const areas = new Map(data.areas.map((a) => [a.id, a]));
    const zones = new Map(data.zones.map((z) => [z.id, z]));
    return {
      ...data,
      lookup: (id) => index.get(id),
      areaById: (id) => (id ? areas.get(id) : undefined),
      zoneById: (id) => (id ? zones.get(id) : undefined),
    };
  }, [data]);
  return <OrderDataContext.Provider value={value}>{children}</OrderDataContext.Provider>;
}

export function useOrderData() {
  const ctx = React.useContext(OrderDataContext);
  if (!ctx) throw new Error("useOrderData outside OrderDataProvider");
  return ctx;
}

export type BasketLine = PricedLine & { line: CartLine; product: OrderProduct; variant: OrderVariant };

export type Basket = {
  lines: BasketLine[];
  /** Lines that can no longer be ordered (sold out, removed, options changed). */
  stale: { line: CartLine; name: string; message: string }[];
  count: number;
  area: OrderArea | undefined;
  zone: ZoneTerms | undefined;
  totals: Totals;
};

export function useBasket(): Basket {
  const cart = useCart();
  const { lookup, areaById, zoneById, config } = useOrderData();
  return React.useMemo(() => {
    const { priced, issues } = priceLines(cart.lines, (id) => {
      const e = lookup(id);
      return e ? variantToPricingItem(e.product, e.variant) : undefined;
    });
    const lines: BasketLine[] = priced.map((p) => {
      const line = cart.lines[p.index];
      const e = lookup(line.itemId)!;
      return { ...p, line, product: e.product, variant: e.variant };
    });
    const stale = issues.map((i) => ({
      line: cart.lines[i.index],
      name: lookup(i.itemId)?.product.title ?? "A dish",
      message: i.message,
    }));
    const area = areaById(cart.areaId);
    const zone = zoneById(area?.zoneId);
    const subtotalFils = lines.reduce((s, l) => s + l.lineTotalFils, 0);
    const totals = computeTotals({
      subtotalFils,
      zone: zone ?? null,
      coupon: null,
      serviceFeeFils: config.serviceFeeFils,
      vatRate: config.vatRate,
      pricesIncludeVat: config.pricesIncludeVat,
    });
    return {
      lines,
      stale,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      area,
      zone,
      totals,
    };
  }, [cart, lookup, areaById, zoneById, config]);
}
