/*
 * Order lifecycle — the single source of truth for which status changes
 * are allowed and how each status reads to a customer or to staff.
 */

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "RECEIVED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "REJECTED",
  "CANCELLED",
] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "PAY_ON_DELIVERY",
  "PAID",
  "FAILED",
  "REFUNDED",
  "VOIDED",
] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH_ON_DELIVERY", "CARD_ON_DELIVERY", "ONLINE"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

/** The happy path, in order. */
export const FLOW: OrderStatusValue[] = [
  "RECEIVED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const TERMINAL: OrderStatusValue[] = ["DELIVERED", "REJECTED", "CANCELLED"];

export function isTerminal(status: OrderStatusValue) {
  return TERMINAL.includes(status);
}

/**
 * Staff may move an order forward along the flow (skipping steps is
 * allowed — a quiet kitchen shouldn't need four taps), reject it while
 * it is still new, or cancel it any time before it is delivered.
 */
export function canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
  if (from === to || isTerminal(from)) return false;
  if (from === "PENDING_PAYMENT") return to === "RECEIVED" || to === "CANCELLED";
  if (to === "REJECTED") return from === "RECEIVED";
  if (to === "CANCELLED") return true;
  if (to === "PENDING_PAYMENT" || to === "RECEIVED") return false;
  const a = FLOW.indexOf(from);
  const b = FLOW.indexOf(to);
  if (from === "RECEIVED" && to !== "CONFIRMED") return false; // accept first
  return a >= 0 && b > a;
}

/** The one obvious next step for the staff board. */
export function nextStatus(status: OrderStatusValue): OrderStatusValue | null {
  if (status === "PENDING_PAYMENT" || isTerminal(status)) return null;
  const i = FLOW.indexOf(status);
  return FLOW[i + 1] ?? null;
}

export const STAFF_ACTION: Partial<Record<OrderStatusValue, string>> = {
  CONFIRMED: "Accept order",
  PREPARING: "Start preparing",
  READY: "Mark ready",
  OUT_FOR_DELIVERY: "Dispatch",
  DELIVERED: "Mark delivered",
};

export const STAFF_LABEL: Record<OrderStatusValue, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  RECEIVED: "New",
  CONFIRMED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const CUSTOMER_STEPS: { status: OrderStatusValue; label: string; detail: string }[] = [
  { status: "RECEIVED", label: "Order received", detail: "The kitchen has your order." },
  { status: "CONFIRMED", label: "Confirmed", detail: "Accepted — your dishes are queued." },
  { status: "PREPARING", label: "In the kitchen", detail: "Your food is being cooked." },
  { status: "READY", label: "Ready", detail: "Packed and waiting for the rider." },
  { status: "OUT_FOR_DELIVERY", label: "On its way", detail: "Your rider is heading to you." },
  { status: "DELIVERED", label: "Delivered", detail: "Nooshe jan — enjoy your meal." },
];

export const PAYMENT_LABEL: Record<PaymentStatusValue, string> = {
  PENDING: "Awaiting payment",
  PAY_ON_DELIVERY: "Pay on delivery",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
  VOIDED: "Voided",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodValue, string> = {
  CASH_ON_DELIVERY: "Cash on delivery",
  CARD_ON_DELIVERY: "Card on delivery",
  ONLINE: "Paid online",
};

/** Timestamp column written when an order enters each status. */
export const STATUS_TIMESTAMP: Partial<Record<OrderStatusValue, string>> = {
  CONFIRMED: "confirmedAt",
  PREPARING: "preparingAt",
  READY: "readyAt",
  OUT_FOR_DELIVERY: "dispatchedAt",
  DELIVERED: "deliveredAt",
  REJECTED: "cancelledAt",
  CANCELLED: "cancelledAt",
};
