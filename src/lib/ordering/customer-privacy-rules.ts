/*
 * Rules for erasing a customer's personal data (UAE PDPL right to
 * erasure). Pure, so they are tested without a database; the database
 * work is in customer-privacy.ts.
 *
 * Orders are kept — totals, VAT, items and dates are tax records — but
 * everything that identifies the person is replaced or cleared.
 */
import type { OrderStatusValue } from "@/lib/ordering/status";

/** What an erased order keeps in place of the customer's details. */
export const ERASED_NAME = "Deleted customer";
export const ERASED_PHONE = "deleted";

/** Order fields replaced on erasure. Area and zone stay: they are coarse and needed for delivery reports. */
export const ERASED_ORDER_FIELDS = {
  customerId: null,
  customerName: ERASED_NAME,
  customerPhone: ERASED_PHONE,
  customerEmail: null,
  building: "—",
  street: null,
  unit: null,
  floor: null,
  instructions: null,
  lat: null,
  lng: null,
  notes: null,
} as const;

const IN_PROGRESS: OrderStatusValue[] = ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];
/** An online payment can still complete within this window; after it the order is abandoned. */
const PAYMENT_WINDOW_MS = 24 * 3_600_000;

/**
 * Why the customer can't be erased right now, or null. An order still
 * being cooked or delivered needs the address and phone.
 */
export function eraseBlocker(
  orders: { status: OrderStatusValue; placedAt: Date }[],
  now = new Date(),
): string | null {
  if (orders.some((o) => IN_PROGRESS.includes(o.status))) {
    return "This customer has an order in progress. Delete their data after it is delivered.";
  }
  if (orders.some((o) => o.status === "PENDING_PAYMENT" && now.getTime() - o.placedAt.getTime() < PAYMENT_WINDOW_MS)) {
    return "This customer has an online payment that may still complete. Try again tomorrow.";
  }
  return null;
}

/** Placeholder identity for a redeemed gift claim, unique per claim (the table is unique per coupon + phone/email). */
export function erasedClaimIdentity(claimId: string) {
  return { name: null, phone: `deleted:${claimId}`, email: `deleted-${claimId}@deleted.invalid`, marketingOptIn: false };
}

/** Last four digits only — enough to find the entry in the log without keeping the number. */
export function maskedPhone(phone: string) {
  return `…${phone.slice(-4)}`;
}
