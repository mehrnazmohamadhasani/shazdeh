/*
 * The admin customer list: one row per mobile, joining the guests who
 * ordered (Customer + their orders) and the people who claimed a QR gift.
 * Pure, so the merge rules are tested without a database.
 */

export type CustomerSource = {
  phone: string;
  name: string;
  email: string | null;
  marketingOptIn: boolean;
  createdAt: Date;
};

/** Orders that count: placed and not cancelled, rejected or still waiting for payment. */
export type OrderStats = { phone: string; orders: number; spentFils: number; lastOrderAt: Date | null; lastOrderId: string | null };

export type ClaimSource = {
  phone: string;
  name: string | null;
  email: string;
  marketingOptIn: boolean;
  code: string;
  used: boolean;
  createdAt: Date;
};

export type GiftState = "none" | "claimed" | "used";

export type CustomerListRow = {
  phone: string;
  name: string | null;
  email: string | null;
  orders: number;
  spentFils: number;
  lastOrderAt: string | null;
  lastOrderId: string | null;
  gift: GiftState;
  giftCodes: string[];
  /** Agreed to news and offers, and hasn't unsubscribed since. */
  marketingOk: boolean;
  /** Clicked "unsubscribe" in a campaign email. */
  unsubscribed: boolean;
  /** First time we heard of this mobile (first order or first gift claim). */
  firstSeenAt: string;
};

export function mergeCustomers(
  customers: CustomerSource[],
  stats: OrderStats[],
  claims: ClaimSource[],
  /** Lower-case emails that unsubscribed from campaigns. */
  unsubscribed: ReadonlySet<string> = new Set(),
): CustomerListRow[] {
  const byPhone = new Map<string, CustomerListRow>();
  const row = (phone: string, seen: Date) => {
    let r = byPhone.get(phone);
    if (!r) {
      r = { phone, name: null, email: null, orders: 0, spentFils: 0, lastOrderAt: null, lastOrderId: null, gift: "none", giftCodes: [], marketingOk: false, unsubscribed: false, firstSeenAt: seen.toISOString() };
      byPhone.set(phone, r);
    }
    if (seen.toISOString() < r.firstSeenAt) r.firstSeenAt = seen.toISOString();
    return r;
  };

  // Ordering customers first: their name and email are the ones checkout keeps current.
  for (const c of customers) {
    const r = row(c.phone, c.createdAt);
    r.name = c.name;
    r.email = c.email;
    r.marketingOk ||= c.marketingOptIn;
  }
  for (const s of stats) {
    const r = byPhone.get(s.phone);
    if (!r) continue;
    r.orders = s.orders;
    r.spentFils = s.spentFils;
    r.lastOrderAt = s.lastOrderAt?.toISOString() ?? null;
    r.lastOrderId = s.lastOrderId;
  }
  // Newest claim first, so the latest name/email given on a gift page fills any gap.
  for (const c of [...claims].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    const r = row(c.phone, c.createdAt);
    r.name ||= c.name;
    r.email ||= c.email;
    r.marketingOk ||= c.marketingOptIn;
    if (!r.giftCodes.includes(c.code)) r.giftCodes.push(c.code);
    r.gift = r.gift === "used" || c.used ? "used" : "claimed";
  }
  for (const r of byPhone.values()) {
    if (r.email && unsubscribed.has(r.email.toLowerCase())) {
      r.unsubscribed = true;
      r.marketingOk = false;
    }
  }
  return [...byPhone.values()].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
}

function lastActivity(r: CustomerListRow) {
  return r.lastOrderAt && r.lastOrderAt > r.firstSeenAt ? r.lastOrderAt : r.firstSeenAt;
}

export type CustomerFilter = "all" | "marketing" | "lapsed" | "gift_no_order";

/** "lapsed": ordered before, nothing in the last 30 days. "gift_no_order": claimed a gift, never ordered. */
export function matchesFilter(r: CustomerListRow, filter: CustomerFilter, now = new Date()): boolean {
  if (filter === "marketing") return r.marketingOk;
  if (filter === "lapsed") return r.orders > 0 && r.lastOrderAt !== null && now.getTime() - new Date(r.lastOrderAt).getTime() > 30 * 86_400_000;
  if (filter === "gift_no_order") return r.gift !== "none" && r.orders === 0;
  return true;
}

export type CampaignAudience = Exclude<CustomerFilter, "all">;
export const CAMPAIGN_AUDIENCES: CampaignAudience[] = ["marketing", "lapsed", "gift_no_order"];

/**
 * Who a campaign goes to: always only customers who agreed to offers (and
 * didn't unsubscribe) and have an email, narrowed by the audience filter.
 * One entry per email — two mobiles can share one.
 */
export function campaignRecipients(rows: CustomerListRow[], audience: CampaignAudience, now = new Date()) {
  const seen = new Set<string>();
  const out: { email: string; firstName: string | null }[] = [];
  for (const r of rows) {
    if (!r.marketingOk || !r.email || !matchesFilter(r, audience, now)) continue;
    const email = r.email.trim().toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ email, firstName: r.name?.trim().split(/\s+/)[0] || null });
  }
  return out;
}
