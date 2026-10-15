import type { Flag } from "./checks";
import type { PlatformItem, PlatformReading } from "./platform-reading";

/*
 * Turns a platform receipt reading into a sale ready to confirm: which
 * channel, which order IDs, which menu items, what SHĀZDEH actually sold,
 * and what doesn't add up. No layout rules per platform: dish names are
 * matched to the menu by their words (spelling variants allowed), size,
 * vegetarian heading and price, plus what people confirmed before.
 *
 * Money here is in fils. A receipt's total includes the customer's
 * delivery and service fees, which go to the platform — SHĀZDEH's sale
 * is the food subtotal.
 */

export type MenuEntry = { id: string; name: string; category: string; priceFils: number; isVegetarian: boolean };
export type LearnedAlias = { key: string; menuItemId: string; sameChannel: boolean };

export type DishMatch = { menuItemId: string; via: "learned" | "name"; confident: boolean } | null;

const STOP = new Set(["portion", "regular", "the", "of", "with", "x", "aed", "dish", "plate"]);
const SIZE = new Set(["large", "small", "medium"]);
const VEG = new Set(["vegetarian", "veg", "vegan", "veggie"]);

function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** The key a confirmed match is remembered under: the name plus the heading above it. */
export function aliasKey(name: string, category: string | null): string {
  const n = words(name).join(" ");
  const c = category ? words(category.replace(/\(\d+\)/g, "")).join(" ") : "";
  return c ? `${n} | ${c}` : n;
}

function parts(text: string) {
  const all = words(text);
  return {
    content: all.filter((w) => !STOP.has(w) && !SIZE.has(w) && !VEG.has(w) && !/^\d+$/.test(w)),
    size: all.filter((w) => SIZE.has(w)),
    veg: all.some((w) => VEG.has(w)),
  };
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Same word, or a transliteration one letter apart ("gheymeh" / "gheimeh", "ghorme" / "ghormeh"). */
function similar(a: string, b: string) {
  return a === b || (a.length >= 5 && b.length >= 5 && editDistanceAtMostOne(a, b));
}

function score(raw: ReturnType<typeof parts>, rawCategory: ReturnType<typeof parts> | null, unitPriceFils: number | null, m: MenuEntry) {
  const menu = parts(m.name);
  const menuCategory = parts(m.category);
  const menuVeg = m.isVegetarian || menuCategory.veg;
  const rawVeg = raw.veg || !!rawCategory?.veg;
  const matchedRaw = raw.content.filter((w) => menu.content.some((x) => similar(w, x))).length;
  if (matchedRaw === 0) return 0;
  const matchedMenu = menu.content.filter((w) => raw.content.some((x) => similar(w, x))).length;
  let s = (matchedRaw + matchedMenu) / (raw.content.length + menu.content.length);

  // A menu name with a size ("Sabzi Khordan — Small") needs the same size on the receipt.
  if (menu.size.length) {
    if (!raw.size.length) s -= 0.15;
    else s += raw.size.some((w) => menu.size.includes(w)) ? 0.1 : -0.5;
  }
  if (rawVeg && !menuVeg) s -= 0.5;
  else if (!rawVeg && menuVeg) s -= 0.1;
  else if (rawVeg && menuVeg) s += 0.05;

  if (unitPriceFils != null) s += unitPriceFils === m.priceFils ? 0.2 : -0.1;
  if (rawCategory?.content.length && rawCategory.content.every((w) => menuCategory.content.some((x) => similar(w, x)))) s += 0.05;
  return s;
}

/**
 * The menu item a receipt line is. A name confirmed before (on this
 * platform, then any) wins; otherwise the best-scoring menu item, marked
 * confident only when it is a clear winner.
 */
export function matchDish(
  item: { name: string; category: string | null; unitPriceFils: number | null },
  menu: MenuEntry[],
  aliases: LearnedAlias[] = [],
): DishMatch {
  const key = aliasKey(item.name, item.category);
  const learned = aliases.find((a) => a.key === key && a.sameChannel) ?? aliases.find((a) => a.key === key);
  if (learned && menu.some((m) => m.id === learned.menuItemId)) return { menuItemId: learned.menuItemId, via: "learned", confident: true };

  const raw = parts(item.name);
  const rawCategory = item.category ? parts(item.category.replace(/\(\d+\)/g, "")) : null;
  const ranked = menu
    .map((m) => ({ m, s: score(raw, rawCategory, item.unitPriceFils, m) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s);
  if (!ranked.length) return null;
  const [best, second] = ranked;
  const confident = best.s >= 0.8 && (!second || best.s - second.s >= 0.15);
  return { menuItemId: best.m.id, via: "name", confident };
}

// ─── From a reading to a sale ───────────────────────────────────────────────

const fils = (aed: number | null | undefined) => (aed == null ? null : Math.round(aed * 100));

/** "2026-10-09T20:42" in Dubai → a UTC instant and the Dubai calendar day. */
export function dubaiTimestamp(local: string | null): { placedAt: Date; businessDate: string } | null {
  const m = local?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const placedAt = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4] ?? "00"}+04:00`);
  return Number.isNaN(placedAt.getTime()) ? null : { placedAt, businessDate: m[1] };
}

export type DraftItem = {
  rawName: string;
  category: string | null;
  quantity: number;
  lineTotalFils: number | null;
  match: DishMatch;
};

export type PlatformDraft = {
  channelCode: string | null;
  orderNo: string | null;
  altOrderId: string | null;
  placedAt: string | null;
  businessDate: string | null;
  fulfilment: "delivery" | "pickup" | null;
  payment: string | null;
  customerFirstName: string | null;
  items: DraftItem[];
  subtotalFils: number | null;
  deliveryFeeFils: number | null;
  serviceFeeFils: number | null;
  discountFils: number;
  totalFils: number | null;
  note: string | null;
};

const digits = (s: string | null | undefined) => (s ? s.replace(/\D/g, "") || null : null);

/** A reading plus the menu and learned names → a pre-filled sale to check. */
export function draftFromReading(
  r: PlatformReading,
  menu: MenuEntry[],
  aliasesFor: (channelCode: string | null) => LearnedAlias[],
): PlatformDraft {
  const channelCode = r.platform === "other" ? null : r.platform;
  const orderNo = digits(r.orderNo);
  const altOrderId = r.otherNumbers.map(digits).find((n) => n && n !== orderNo) ?? null;
  const when = dubaiTimestamp(r.placedAt);
  const aliases = aliasesFor(channelCode);
  const totalFils = fils(r.total);
  const onlyItem = r.items.length === 1 ? r.items[0] : null;
  const items = r.items.map((it: PlatformItem): DraftItem => {
    const quantity = Math.max(1, Math.round(it.quantity ?? 1));
    let lineTotalFils = fils(it.lineTotal);
    // One dish and no line price (Deliveroo): the food total is that dish.
    const hint = lineTotalFils ?? (onlyItem && r.subtotal == null && !r.deliveryFee && !r.serviceFee && !r.discount ? totalFils : null);
    const match = matchDish({ name: it.name, category: it.category, unitPriceFils: hint != null ? Math.round(hint / quantity) : null }, menu, aliases);
    if (lineTotalFils == null && hint != null) lineTotalFils = hint;
    return { rawName: it.name, category: it.category, quantity, lineTotalFils, match };
  });
  return {
    channelCode,
    orderNo,
    altOrderId,
    placedAt: when ? when.placedAt.toISOString() : null,
    businessDate: when?.businessDate ?? null,
    fulfilment: r.fulfilment,
    payment: r.payment,
    customerFirstName: r.customerFirstName?.trim().split(/\s+/)[0] || null,
    items,
    subtotalFils: fils(r.subtotal),
    deliveryFeeFils: fils(r.deliveryFee),
    serviceFeeFils: fils(r.serviceFee),
    discountFils: Math.abs(fils(r.discount) ?? 0),
    totalFils,
    note: r.notes,
  };
}

/**
 * What SHĀZDEH sold on this order: the printed food subtotal; else the
 * printed lines; else a total with no fees on it (Deliveroo); else the
 * menu prices of the matched dishes (marked "menu", an estimate).
 */
export function foodSales(
  d: Pick<PlatformDraft, "subtotalFils" | "deliveryFeeFils" | "serviceFeeFils" | "discountFils" | "totalFils"> & {
    items: { lineTotalFils: number | null; quantity: number; menuPriceFils: number | null }[];
  },
): { fils: number; source: "printed" | "menu" } | null {
  if (d.subtotalFils != null) return { fils: d.subtotalFils, source: "printed" };
  if (d.items.length && d.items.every((i) => i.lineTotalFils != null)) {
    return { fils: d.items.reduce((s, i) => s + i.lineTotalFils!, 0), source: "printed" };
  }
  if (d.totalFils != null && !d.deliveryFeeFils && !d.serviceFeeFils && !d.discountFils) return { fils: d.totalFils, source: "printed" };
  if (d.items.length && d.items.every((i) => i.lineTotalFils != null || i.menuPriceFils != null)) {
    return { fils: d.items.reduce((s, i) => s + (i.lineTotalFils ?? i.menuPriceFils! * i.quantity), 0), source: "menu" };
  }
  return null;
}

const money = (f: number) => (f / 100).toFixed(2);

/** Checks on a sale as it is on screen now: what's missing and what doesn't add up. Never corrects anything. */
export function checkPlatformDraft(
  d: Omit<PlatformDraft, "items"> & {
    items: { rawName: string; quantity: number; lineTotalFils: number | null; menuItemId: string | null; menuPriceFils: number | null; confident: boolean }[];
  },
  opts: { now?: Date; itemCount?: number | null; isPlatformReceipt?: boolean } = {},
): Flag[] {
  const flags: Flag[] = [];
  const now = opts.now ?? new Date();
  if (opts.isPlatformReceipt === false) flags.push({ level: "error", field: "document", message: "This doesn't look like a delivery-platform receipt." });
  if (!d.channelCode) flags.push({ level: "error", field: "channel", message: "Choose the platform." });
  if (!d.orderNo) flags.push({ level: "error", field: "orderNo", message: "No order number could be read." });
  if (!d.placedAt) flags.push({ level: "error", field: "placedAt", message: "No order date and time could be read." });
  else {
    const days = (Date.parse(d.placedAt) - now.getTime()) / 86_400_000;
    if (days > 1) flags.push({ level: "warn", field: "placedAt", message: "The order date is in the future — check it." });
    else if (days < -90) flags.push({ level: "warn", field: "placedAt", message: "The order is over 90 days old — check the date." });
  }
  if (d.totalFils == null) flags.push({ level: "error", field: "total", message: "No total could be read." });
  if (!d.items.length) flags.push({ level: "error", field: "items", message: "No dishes could be read." });

  const printed = d.items.filter((i) => i.lineTotalFils != null);
  if (d.subtotalFils != null && printed.length === d.items.length && d.items.length) {
    const sum = printed.reduce((s, i) => s + i.lineTotalFils!, 0);
    if (Math.abs(sum - d.subtotalFils) > 1) {
      flags.push({ level: "warn", field: "subtotal", message: `The dishes add up to ${money(sum)}, but the subtotal says ${money(d.subtotalFils)}.` });
    }
  }
  if (d.subtotalFils != null && d.totalFils != null) {
    const expected = d.subtotalFils + (d.deliveryFeeFils ?? 0) + (d.serviceFeeFils ?? 0) - d.discountFils;
    if (Math.abs(expected - d.totalFils) > 1) {
      flags.push({ level: "warn", field: "total", message: `Subtotal + fees − discount is ${money(expected)}, but the total says ${money(d.totalFils)}.` });
    }
  }
  if (opts.itemCount != null) {
    const qty = d.items.reduce((s, i) => s + i.quantity, 0);
    if (qty !== opts.itemCount) flags.push({ level: "warn", field: "items", message: `The receipt says ${opts.itemCount} item(s), but ${qty} were read.` });
  }
  // No line prices printed: the menu prices should make up the total.
  if (d.subtotalFils == null && d.totalFils != null && d.items.some((i) => i.lineTotalFils == null) && d.items.every((i) => i.lineTotalFils != null || i.menuPriceFils != null)) {
    const sum = d.items.reduce((s, i) => s + (i.lineTotalFils ?? i.menuPriceFils! * i.quantity), 0);
    if (!d.deliveryFeeFils && !d.serviceFeeFils && !d.discountFils && Math.abs(sum - d.totalFils) > 1) {
      flags.push({ level: "warn", field: "total", message: `Menu prices add up to ${money(sum)}, but the receipt total is ${money(d.totalFils)} — check the dishes.` });
    }
  }
  d.items.forEach((it, i) => {
    if (!it.menuItemId) flags.push({ level: "warn", field: `item:${i}`, message: `Choose the menu dish for “${it.rawName}”.` });
    else if (!it.confident) flags.push({ level: "info", field: `item:${i}`, message: `Check the menu dish for “${it.rawName}”.` });
  });
  if (d.discountFils > 0) flags.push({ level: "info", field: "discount", message: "Who pays the discount (restaurant or platform) isn't known yet — set it if you know." });
  return flags;
}

// ─── Fees ───────────────────────────────────────────────────────────────────

export type FeeRule = { commissionPct: number | null; paymentFeePct: number | null; fixedFeeFils: number | null; vatOnFees: boolean };

/** Estimated platform fees on one order from its fee rule; null when there is no rule (fees unknown). */
export function estimateFees(rule: FeeRule | null, foodSalesFils: number) {
  if (!rule) return null;
  const commission = Math.round((foodSalesFils * (rule.commissionPct ?? 0)) / 100);
  const payment = Math.round((foodSalesFils * (rule.paymentFeePct ?? 0)) / 100);
  const fixed = rule.fixedFeeFils ?? 0;
  const vat = rule.vatOnFees ? Math.round((commission + payment + fixed) * 0.05) : 0;
  return { commissionFils: commission, paymentFeeFils: payment, fixedFeeFils: fixed, vatFils: vat, totalFils: commission + payment + fixed + vat };
}
