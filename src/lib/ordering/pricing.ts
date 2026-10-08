/*
 * Pricing engine — pure and isomorphic.
 *
 * The browser runs it for an instant basket preview; the server runs the
 * very same code against fresh database rows when quoting and placing an
 * order. The client only ever sends ids and quantities — never prices,
 * fees or discounts — so nothing it computes is trusted.
 */

export type PricingOption = {
  id: string;
  name: string;
  priceFils: number;
  isAvailable: boolean;
};

export type PricingGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: PricingOption[];
};

export type PricingItem = {
  id: string;
  name: string;
  portion: string | null;
  priceFils: number;
  /** Active, available, and in an active category. */
  orderable: boolean;
  groups: PricingGroup[];
};

export type CartLineInput = {
  itemId: string;
  quantity: number;
  optionIds: string[];
  notes?: string | null;
};

export type PricedModifier = { group: string; name: string; priceFils: number };

export type PricedLine = {
  index: number;
  itemId: string;
  name: string;
  portion: string | null;
  quantity: number;
  unitPriceFils: number;
  lineTotalFils: number;
  notes: string | null;
  modifiers: PricedModifier[];
};

export type LineIssue = {
  index: number;
  itemId: string;
  code: "not_found" | "unavailable" | "invalid_options";
  message: string;
};

export const MAX_QUANTITY_PER_LINE = 30;
export const MAX_LINES = 40;

/** Checks a selection against an item's option groups. Returns an error message or null. */
export function validateSelection(
  item: PricingItem,
  optionIds: string[],
): string | null {
  if (new Set(optionIds).size !== optionIds.length) {
    return "An option was selected twice.";
  }
  const known = new Map<string, { group: PricingGroup; option: PricingOption }>();
  for (const group of item.groups) {
    for (const option of group.options) known.set(option.id, { group, option });
  }
  for (const id of optionIds) {
    const hit = known.get(id);
    if (!hit) return "One of the selected options no longer exists.";
    if (!hit.option.isAvailable) return `${hit.option.name} is not available right now.`;
  }
  for (const group of item.groups) {
    const count = optionIds.filter((id) => known.get(id)?.group.id === group.id).length;
    if (count < group.minSelect) {
      return group.minSelect === 1
        ? `Please choose ${group.name.toLowerCase()}.`
        : `Please choose at least ${group.minSelect} for ${group.name.toLowerCase()}.`;
    }
    if (count > group.maxSelect) {
      return `Choose up to ${group.maxSelect} for ${group.name.toLowerCase()}.`;
    }
  }
  return null;
}

export function unitPriceFils(item: PricingItem, optionIds: string[]): number {
  let total = item.priceFils;
  for (const group of item.groups) {
    for (const option of group.options) {
      if (optionIds.includes(option.id)) total += option.priceFils;
    }
  }
  return total;
}

export function priceLines(
  lines: CartLineInput[],
  lookup: (itemId: string) => PricingItem | undefined,
): { priced: PricedLine[]; issues: LineIssue[] } {
  const priced: PricedLine[] = [];
  const issues: LineIssue[] = [];

  lines.forEach((line, index) => {
    const item = lookup(line.itemId);
    if (!item) {
      issues.push({ index, itemId: line.itemId, code: "not_found", message: "This dish is no longer on the menu." });
      return;
    }
    if (!item.orderable) {
      issues.push({ index, itemId: item.id, code: "unavailable", message: `${item.name} is sold out right now.` });
      return;
    }
    const error = validateSelection(item, line.optionIds);
    if (error) {
      issues.push({ index, itemId: item.id, code: "invalid_options", message: error });
      return;
    }
    const quantity = Math.max(1, Math.min(MAX_QUANTITY_PER_LINE, Math.floor(line.quantity)));
    const unit = unitPriceFils(item, line.optionIds);
    const modifiers: PricedModifier[] = [];
    for (const group of item.groups) {
      for (const option of group.options) {
        if (line.optionIds.includes(option.id)) {
          modifiers.push({ group: group.name, name: option.name, priceFils: option.priceFils });
        }
      }
    }
    priced.push({
      index,
      itemId: item.id,
      name: item.name,
      portion: item.portion,
      quantity,
      unitPriceFils: unit,
      lineTotalFils: unit * quantity,
      notes: line.notes?.trim() || null,
      modifiers,
    });
  });

  return { priced, issues };
}

export type ZoneTerms = {
  id: string;
  name: string;
  feeFils: number;
  minOrderFils: number;
  freeOverFils: number | null;
  etaMin: number;
  etaMax: number;
};

export type CouponTerms = {
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_DELIVERY";
  value: number;
  minSubtotalFils: number;
  maxDiscountFils: number | null;
  description?: string | null;
};

export type Totals = {
  subtotalFils: number;
  deliveryFeeFils: number;
  serviceFeeFils: number;
  discountFils: number;
  vatFils: number;
  totalFils: number;
  /** How much more is needed to reach the zone minimum (0 when met). */
  shortOfMinimumFils: number;
  /** How much more unlocks free delivery, when the zone offers it. */
  shortOfFreeDeliveryFils: number | null;
  couponApplied: boolean;
  couponMessage: string | null;
};

export function computeTotals({
  subtotalFils,
  zone,
  coupon,
  serviceFeeFils,
  vatRate,
  pricesIncludeVat,
}: {
  subtotalFils: number;
  zone: ZoneTerms | null;
  coupon: CouponTerms | null;
  serviceFeeFils: number;
  vatRate: number;
  pricesIncludeVat: boolean;
}): Totals {
  const freeByThreshold =
    !!zone && zone.freeOverFils !== null && subtotalFils >= zone.freeOverFils;
  const deliveryFeeFils = zone && !freeByThreshold ? zone.feeFils : 0;

  let discountFils = 0;
  let couponApplied = false;
  let couponMessage: string | null = null;
  if (coupon) {
    if (subtotalFils < coupon.minSubtotalFils) {
      couponMessage = `Add ${formatShort(coupon.minSubtotalFils - subtotalFils)} more to use ${coupon.code}.`;
    } else {
      if (coupon.type === "PERCENT") {
        discountFils = Math.floor((subtotalFils * Math.min(100, Math.max(0, coupon.value))) / 100);
      } else if (coupon.type === "FIXED") {
        discountFils = Math.round(coupon.value * 100);
      } else {
        discountFils = deliveryFeeFils;
      }
      if (coupon.maxDiscountFils !== null) discountFils = Math.min(discountFils, coupon.maxDiscountFils);
      discountFils = Math.max(0, Math.min(discountFils, subtotalFils + deliveryFeeFils));
      couponApplied = true;
      if (coupon.type === "FREE_DELIVERY" && deliveryFeeFils === 0) {
        couponMessage = "Delivery is already free for this order.";
      }
    }
  }

  const beforeVat = subtotalFils + deliveryFeeFils + serviceFeeFils - discountFils;
  let vatFils: number;
  let totalFils: number;
  if (pricesIncludeVat) {
    totalFils = beforeVat;
    vatFils = Math.round((totalFils * vatRate) / (100 + vatRate));
  } else {
    vatFils = Math.round((beforeVat * vatRate) / 100);
    totalFils = beforeVat + vatFils;
  }

  return {
    subtotalFils,
    deliveryFeeFils,
    serviceFeeFils,
    discountFils,
    vatFils,
    totalFils,
    shortOfMinimumFils: zone ? Math.max(0, zone.minOrderFils - subtotalFils) : 0,
    shortOfFreeDeliveryFils:
      zone && zone.freeOverFils !== null && zone.feeFils > 0
        ? Math.max(0, zone.freeOverFils - subtotalFils)
        : null,
    couponApplied,
    couponMessage,
  };
}

function formatShort(fils: number) {
  const aed = fils / 100;
  return `${Number.isInteger(aed) ? aed : aed.toFixed(2)} AED`;
}
