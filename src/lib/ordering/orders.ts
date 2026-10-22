import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { after as afterResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrderingConfig, getOrderingSettings } from "@/lib/ordering/config";
import { loadPricingItems } from "@/lib/ordering/catalog";
import { resolveDelivery } from "@/lib/ordering/zones";
import { lookupCoupon } from "@/lib/ordering/coupons";
import { giftForPhone } from "@/lib/ordering/gifts";
import { normalizeMobile } from "@/lib/ordering/phone";
import {
  computeTotals,
  priceLines,
  repriceAfterRemoval,
  type LineIssue,
  type PricedLine,
  type Totals,
  type ZoneTerms,
} from "@/lib/ordering/pricing";
import {
  canTransition,
  STATUS_TIMESTAMP,
  type OrderStatusValue,
} from "@/lib/ordering/status";
import type { PlaceOrderInput, QuoteInput, StaffOrderInput } from "@/lib/ordering/schemas";
import { getOnlineProvider, getProviderById } from "@/lib/payments";
import type { ProviderPaymentState } from "@/lib/payments/types";
import type { DispatchResult } from "@/lib/delivery";
import { notifyOrder, STATUS_EVENT, type NotifyOptions, type OrderEventName } from "@/lib/notifications";
import { formatFils, toFils } from "@/lib/ordering/money";
import { takeStockForWebsiteOrder } from "@/lib/ops/stock-use";

/*
 * The order service. Everything that decides money or status lives
 * here and runs on the server against fresh database rows.
 */

export type Quote = {
  lines: PricedLine[];
  issues: LineIssue[];
  zone: ZoneTerms | null;
  area: { id: string; name: string } | null;
  deliveryError: string | null;
  coupon: { code: string; description: string | null } | null;
  couponError: string | null;
  /** The coupon above is the customer's QR gift, found by mobile (website checkout only). */
  gift: { state: "applied" } | null;
  totals: Totals;
  /** Human-readable reasons checkout can't proceed yet. Empty = ready. */
  blockers: string[];
};

type InternalQuote = Quote & { couponId: string | null; couponUsageLimit: number | null; giftClaimId: string | null };

/** `autoGift`: with no code typed, apply the QR gift claimed by this mobile (website checkout). */
export async function quoteOrder(input: QuoteInput, { autoGift = false }: { autoGift?: boolean } = {}): Promise<InternalQuote> {
  const [config, items] = await Promise.all([
    getOrderingConfig(),
    loadPricingItems(input.lines.map((l) => l.itemId)),
  ]);
  const { priced, issues } = priceLines(input.lines, (id) => items.get(id));
  const subtotalFils = priced.reduce((s, l) => s + l.lineTotalFils, 0);

  const delivery = await resolveDelivery(input.areaId, input.lat, input.lng);
  const zone = delivery.ok ? delivery.zone : null;

  let couponLookup: Awaited<ReturnType<typeof lookupCoupon>> | null = null;
  const phone = input.phone ? normalizeMobile(input.phone) : null;
  if (input.couponCode?.trim()) {
    couponLookup = await lookupCoupon(input.couponCode, phone);
  } else if (autoGift && phone) {
    const found = await giftForPhone(phone);
    if (found) {
      const lookup = await lookupCoupon(found.code, phone);
      // A gift that doesn't fit this order (e.g. first-order-only) just isn't applied.
      if (lookup.ok) couponLookup = lookup;
    }
  }

  const totals = computeTotals({
    subtotalFils,
    zone,
    coupon: couponLookup?.ok ? couponLookup.terms : null,
    serviceFeeFils: config.serviceFeeFils,
    vatRate: config.vatRate,
    pricesIncludeVat: config.pricesIncludeVat,
  });

  const blockers: string[] = [];
  if (!config.acceptingOrders) blockers.push(config.pausedMessage || "We're not taking online orders right now.");
  else if (!config.kitchenOpen) blockers.push(`The kitchen is closed — ${config.kitchenLabel.toLowerCase()}.`);
  if (issues.length) blockers.push("Some items in your basket need attention.");
  if (priced.length === 0) blockers.push("Your basket is empty.");
  if (!delivery.ok) blockers.push(delivery.reason);
  if (zone && totals.shortOfMinimumFils > 0) {
    blockers.push(`The minimum order for ${zone.name} is ${zone.minOrderFils / 100} AED.`);
  }

  return {
    lines: priced,
    issues,
    zone,
    area: delivery.ok ? delivery.area : null,
    deliveryError: delivery.ok ? null : delivery.reason,
    coupon: couponLookup?.ok && totals.couponApplied
      ? { code: couponLookup.terms.code, description: couponLookup.terms.description ?? null }
      : null,
    couponError: couponLookup && !couponLookup.ok ? couponLookup.message : totals.couponApplied ? null : totals.couponMessage,
    gift: couponLookup?.ok && couponLookup.giftClaimId && totals.couponApplied ? { state: "applied" } : null,
    couponId: couponLookup?.ok && totals.couponApplied ? couponLookup.id : null,
    couponUsageLimit: couponLookup?.ok ? couponLookup.usageLimit : null,
    giftClaimId: couponLookup?.ok && totals.couponApplied ? couponLookup.giftClaimId : null,
    totals,
    blockers,
  };
}

/** Public shape of a quote (drops internal ids). */
export function publicQuote(q: InternalQuote): Quote {
  const { couponId: _id, couponUsageLimit: _limit, giftClaimId: _gift, ...rest } = q;
  void _id;
  void _limit;
  void _gift;
  return rest;
}

export type PlaceResult =
  | { ok: true; number: string; trackingToken: string; redirectUrl: string | null }
  | { ok: false; status: number; error: string; code?: string; quote?: Quote };

function orderNumber() {
  return `SZ-${randomInt(100000, 1000000)}`;
}

class CouponExhausted extends Error {}

type OrderDraft = {
  idempotencyKey: string;
  status: OrderStatusValue;
  paymentMethod: PlaceOrderInput["paymentMethod"];
  /** "cash" for pay-on-delivery, else the online provider's id. */
  paymentProvider: string;
  online: boolean;
  customer: { name: string; phone: string; email?: string | null; marketingOptIn?: boolean };
  address: PlaceOrderInput["address"];
  notes: string | null;
  cutlery: boolean;
  quote: InternalQuote;
  source: "WEBSITE" | "WHATSAPP" | "PHONE";
  enteredById: string | null;
  event: { message: string; actor: string };
  now: Date;
};

/**
 * Writes a priced order (website checkout or staff entry): customer,
 * order, lines, first event and payment, with the coupon use counted.
 * Returns the order (created: false when this idempotency key already
 * made one), "coupon" when the code was used up meanwhile, or null when
 * no free order number was found.
 */
async function insertOrder(d: OrderDraft): Promise<{ created: boolean; id: string; number: string; trackingToken: string } | "coupon" | null> {
  const { quote } = d;
  const zone = quote.zone!;
  const area = quote.area!;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const order = await prisma.$transaction(async (tx) => {
        if (quote.couponId) {
          const res = await tx.coupon.updateMany({
            where: {
              id: quote.couponId,
              isActive: true,
              ...(quote.couponUsageLimit !== null ? { usedCount: { lt: quote.couponUsageLimit } } : {}),
            },
            data: { usedCount: { increment: 1 } },
          });
          if (res.count === 0) throw new CouponExhausted();
        }

        const customer = await tx.customer.upsert({
          where: { phone: d.customer.phone },
          create: {
            phone: d.customer.phone,
            name: d.customer.name,
            email: d.customer.email ?? null,
            marketingOptIn: d.customer.marketingOptIn ?? false,
          },
          update: {
            name: d.customer.name,
            ...(d.customer.email ? { email: d.customer.email } : {}),
            ...(d.customer.marketingOptIn ? { marketingOptIn: true } : {}),
          },
        });

        const created = await tx.order.create({
          data: {
            number: orderNumber(),
            trackingToken: randomBytes(18).toString("base64url"),
            idempotencyKey: d.idempotencyKey,
            status: d.status,
            paymentMethod: d.paymentMethod,
            paymentStatus: d.online ? "PENDING" : "PAY_ON_DELIVERY",
            source: d.source,
            enteredById: d.enteredById,
            customerId: customer.id,
            customerName: d.customer.name,
            customerPhone: d.customer.phone,
            customerEmail: d.customer.email ?? null,
            zoneId: zone.id,
            zoneName: zone.name,
            areaName: area.name,
            addressType: d.address.addressType,
            building: d.address.building,
            street: d.address.street || null,
            unit: d.address.unit || null,
            floor: d.address.floor || null,
            instructions: d.address.instructions || null,
            lat: d.address.lat ?? null,
            lng: d.address.lng ?? null,
            notes: d.notes || null,
            cutlery: d.cutlery,
            subtotalFils: quote.totals.subtotalFils,
            deliveryFeeFils: quote.totals.deliveryFeeFils,
            serviceFeeFils: quote.totals.serviceFeeFils,
            discountFils: quote.totals.discountFils,
            vatFils: quote.totals.vatFils,
            totalFils: quote.totals.totalFils,
            couponId: quote.couponId,
            couponCode: quote.coupon?.code ?? null,
            etaMin: zone.etaMin,
            etaMax: zone.etaMax,
            confirmedAt: d.status === "CONFIRMED" ? d.now : null,
            items: {
              create: quote.lines.map((l) => ({
                menuItemId: l.itemId,
                name: l.name,
                portion: l.portion,
                unitPriceFils: l.unitPriceFils,
                quantity: l.quantity,
                lineTotalFils: l.lineTotalFils,
                notes: l.notes,
                modifiers: l.modifiers,
              })),
            },
            events: { create: { type: "status", status: d.status, message: d.event.message, actor: d.event.actor } },
            payments: {
              create: {
                provider: d.paymentProvider,
                method: d.paymentMethod,
                amountFils: quote.totals.totalFils,
                status: d.online ? "PENDING" : "PAY_ON_DELIVERY",
              },
            },
          },
          select: { id: true, number: true, trackingToken: true },
        });
        if (quote.giftClaimId) {
          // Same guard as the coupon count: a gift is used by one order only.
          const res = await tx.giftClaim.updateMany({
            where: { id: quote.giftClaimId, orderId: null },
            data: { orderId: created.id, usedAt: d.now },
          });
          if (res.count === 0) throw new CouponExhausted();
        }
        return created;
      });
      return { created: true, ...order };
    } catch (e) {
      if (e instanceof CouponExhausted) return "coupon";
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        // A double-tap racing this request may have just created the order
        // (same idempotency key): return that one. Prisma 7 adapters don't
        // say which column clashed, so always look before retrying.
        const again = await prisma.order.findUnique({ where: { idempotencyKey: d.idempotencyKey } });
        if (again) return { created: false, id: again.id, number: again.number, trackingToken: again.trackingToken };
        continue; // order number (or tracking token) collision — try another
      }
      throw e;
    }
  }
  return null;
}

export async function placeOrder(input: PlaceOrderInput, origin: string): Promise<PlaceResult> {
  // Idempotency: a double-tap or a retried request returns the same order.
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { number: true, trackingToken: true, status: true, paymentMethod: true },
  });
  if (existing) return { ok: true, number: existing.number, trackingToken: existing.trackingToken, redirectUrl: null };

  const config = await getOrderingConfig();
  if (!config.paymentMethods.includes(input.paymentMethod)) {
    return { ok: false, status: 422, error: "That payment method isn't available right now." };
  }

  const quote = await quoteOrder(
    {
      lines: input.lines,
      areaId: input.address.areaId,
      couponCode: input.couponCode,
      phone: input.customer.phone,
      lat: input.address.lat,
      lng: input.address.lng,
    },
    { autoGift: true },
  );
  if (quote.blockers.length) {
    return { ok: false, status: 409, code: "blocked", error: quote.blockers[0], quote: publicQuote(quote) };
  }
  if (input.couponCode?.trim() && !quote.coupon) {
    return { ok: false, status: 409, code: "coupon", error: quote.couponError ?? "That promo code can't be used.", quote: publicQuote(quote) };
  }
  if (quote.totals.totalFils !== input.expectedTotalFils) {
    return {
      ok: false,
      status: 409,
      code: "price_changed",
      error: "Prices or fees changed since you opened checkout — please review your new total.",
      quote: publicQuote(quote),
    };
  }

  const settings = await getOrderingSettings();
  const online = input.paymentMethod === "ONLINE";
  const provider = online ? getOnlineProvider() : null;
  if (online && !provider) return { ok: false, status: 422, error: "Online payment isn't available right now." };

  const initialStatus: OrderStatusValue = online ? "PENDING_PAYMENT" : settings.autoAccept ? "CONFIRMED" : "RECEIVED";
  const now = new Date();

  const inserted = await insertOrder({
    idempotencyKey: input.idempotencyKey,
    status: initialStatus,
    paymentMethod: input.paymentMethod,
    paymentProvider: online ? provider!.id : "cash",
    online,
    customer: input.customer,
    address: input.address,
    notes: input.notes ?? null,
    cutlery: input.cutlery,
    quote,
    source: input.source === "whatsapp" ? "WHATSAPP" : "WEBSITE",
    enteredById: null,
    event: { message: online ? "Order created — waiting for online payment" : "Order placed", actor: "customer" },
    now,
  });
  if (inserted === "coupon") return { ok: false, status: 409, code: "coupon", error: "That promo code has just been fully redeemed." };
  if (inserted && !inserted.created) return { ok: true, number: inserted.number, trackingToken: inserted.trackingToken, redirectUrl: null };
  const created = inserted;
  if (!created) return { ok: false, status: 503, error: "We couldn't place your order. Please try again." };

  if (!online) {
    queueNotification(created.id, "order.received", { autoAccepted: initialStatus === "CONFIRMED" });
    return { ok: true, number: created.number, trackingToken: created.trackingToken, redirectUrl: null };
  }

  try {
    const session = await provider!.createCheckout({
      orderId: created.id,
      orderNumber: created.number,
      trackingToken: created.trackingToken,
      amountFils: quote.totals.totalFils,
      currency: "AED",
      customerEmail: input.customer.email ?? null,
      returnUrl: `${origin}/api/payments/${provider!.id}/return?order=${created.trackingToken}`,
      cancelUrl: `${origin}/order/checkout?cancelled=${created.trackingToken}`,
    });
    await prisma.payment.updateMany({
      where: { orderId: created.id, provider: provider!.id },
      data: { providerRef: session.providerRef },
    });
    return { ok: true, number: created.number, trackingToken: created.trackingToken, redirectUrl: session.redirectUrl };
  } catch (e) {
    console.error("[payments] checkout creation failed", e);
    await failPendingOrder(created.id, "Could not start online payment", provider!.id);
    return {
      ok: false,
      status: 502,
      error: "We couldn't start the online payment. Please try again, or choose to pay on delivery.",
    };
  }
}

/**
 * An order staff enter for a WhatsApp message or a phone call. Priced
 * exactly like a website order; it skips the online-ordering gates
 * (paused, kitchen hours, minimum order) because the kitchen chose to
 * take it, and starts as Accepted. It still rings the order alarm and
 * prints like any order, and takes stock when it is ready.
 */
export async function placeStaffOrder(input: StaffOrderInput, staff: { id: string; email: string }): Promise<PlaceResult> {
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { number: true, trackingToken: true },
  });
  if (existing) return { ok: true, number: existing.number, trackingToken: existing.trackingToken, redirectUrl: null };

  const quote = await quoteOrder({
    lines: input.lines,
    areaId: input.address.areaId,
    couponCode: input.couponCode,
    phone: input.customer.phone,
    lat: input.address.lat,
    lng: input.address.lng,
  });
  const blocker =
    quote.lines.length === 0
      ? "Add at least one dish."
      : quote.issues.length
        ? "Some dishes need attention (sold out or a choice is missing)."
        : quote.deliveryError;
  if (blocker) return { ok: false, status: 409, code: "blocked", error: blocker, quote: publicQuote(quote) };
  if (input.couponCode?.trim() && !quote.coupon) {
    return { ok: false, status: 409, code: "coupon", error: quote.couponError ?? "That promo code can't be used.", quote: publicQuote(quote) };
  }
  if (quote.totals.totalFils !== input.expectedTotalFils) {
    return { ok: false, status: 409, code: "price_changed", error: "The total changed — check the new total and save again.", quote: publicQuote(quote) };
  }

  const via = input.source === "WHATSAPP" ? "WhatsApp" : "phone";
  const inserted = await insertOrder({
    idempotencyKey: input.idempotencyKey,
    status: "CONFIRMED",
    paymentMethod: input.paymentMethod,
    paymentProvider: "cash",
    online: false,
    customer: input.customer,
    address: input.address,
    notes: input.notes ?? null,
    cutlery: input.cutlery,
    quote,
    source: input.source,
    enteredById: staff.id,
    event: { message: `Order taken by ${via} and entered by staff`, actor: staff.email },
    now: new Date(),
  });
  if (inserted === "coupon") return { ok: false, status: 409, code: "coupon", error: "That promo code has just been fully redeemed." };
  if (!inserted) return { ok: false, status: 503, error: "The order couldn't be saved. Please try again." };
  if (inserted.created) {
    await prisma.auditLog.create({
      data: {
        actor: staff.email,
        action: "order.create",
        entity: "Order",
        entityId: inserted.id,
        after: { number: inserted.number, source: input.source, totalFils: quote.totals.totalFils, lines: quote.lines.length },
      },
    });
    // Same as a website order: the kitchen is alerted and the customer gets the email, if one was given.
    queueNotification(inserted.id, "order.received", { autoAccepted: true });
  }
  return { ok: true, number: inserted.number, trackingToken: inserted.trackingToken, redirectUrl: null };
}

/** Cancels an order that never got paid and gives its coupon use back. */
export async function failPendingOrder(orderId: string, reason: string, actor: string) {
  await prisma.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED", paymentStatus: "FAILED", cancelledAt: new Date(), rejectionReason: reason },
    });
    if (res.count === 0) return;
    await tx.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "FAILED", failureReason: reason } });
    await tx.orderEvent.create({ data: { orderId, type: "payment", status: "CANCELLED", message: reason, actor } });
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { couponId: true } });
    if (order?.couponId) {
      await tx.coupon.updateMany({ where: { id: order.couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
      await tx.giftClaim.updateMany({ where: { orderId }, data: { orderId: null, usedAt: null } });
    }
  });
}

/**
 * Applies a gateway result (from a verified webhook or a server-side
 * status lookup). Safe to call repeatedly — only the first transition
 * out of PENDING has any effect.
 */
export async function applyPaymentResult(
  providerId: string,
  providerRef: string,
  state: ProviderPaymentState,
  failureReason?: string,
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { provider_providerRef: { provider: providerId, providerRef } },
    select: { id: true, orderId: true, status: true },
  });
  if (!payment || payment.status !== "PENDING" || state === "PENDING") return;

  if (state === "FAILED") {
    await failPendingOrder(payment.orderId, failureReason ?? "Payment failed", providerId);
    queueNotification(payment.orderId, "payment.failed");
    return;
  }

  const settings = await getOrderingSettings();
  const next: OrderStatusValue = settings.autoAccept ? "CONFIRMED" : "RECEIVED";
  const moved = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "PAID" } });
    if (p.count === 0) return false;
    await tx.order.updateMany({
      where: { id: payment.orderId, status: "PENDING_PAYMENT" },
      data: { status: next, paymentStatus: "PAID", ...(next === "CONFIRMED" ? { confirmedAt: new Date() } : {}) },
    });
    // A payment that lands after the order was auto-cancelled still gets
    // recorded as paid so staff can see it needs a refund.
    await tx.order.updateMany({ where: { id: payment.orderId, paymentStatus: { not: "PAID" } }, data: { paymentStatus: "PAID" } });
    await tx.orderEvent.create({
      data: { orderId: payment.orderId, type: "payment", status: next, message: "Online payment received", actor: providerId },
    });
    return true;
  });
  if (moved) {
    queueNotification(payment.orderId, "payment.received");
    queueNotification(payment.orderId, "order.received", { autoAccepted: next === "CONFIRMED" });
  }
}

/** Checks a pending online payment with its gateway (used on return). */
export async function refreshPayment(trackingToken: string) {
  const order = await prisma.order.findUnique({
    where: { trackingToken },
    select: { payments: { where: { status: "PENDING" }, select: { provider: true, providerRef: true } } },
  });
  for (const p of order?.payments ?? []) {
    const provider = getProviderById(p.provider);
    if (!provider || !p.providerRef) continue;
    try {
      const status = await provider.fetchStatus(p.providerRef);
      await applyPaymentResult(p.provider, p.providerRef, status.state, status.failureReason);
    } catch (e) {
      console.error("[payments] status refresh failed", e);
    }
  }
}

/**
 * The customer backed out of the gateway page. If the gateway confirms
 * nothing was paid, close the checkout there and cancel the order here
 * (releasing any promo use) instead of waiting for it to expire.
 */
export async function abandonPendingOrder(trackingToken: string) {
  await refreshPayment(trackingToken);
  const order = await prisma.order.findUnique({
    where: { trackingToken },
    select: {
      id: true,
      status: true,
      payments: { where: { status: "PENDING" }, select: { provider: true, providerRef: true } },
    },
  });
  if (!order || order.status !== "PENDING_PAYMENT") return;
  for (const p of order.payments) {
    const provider = getProviderById(p.provider);
    if (provider?.cancel && p.providerRef) {
      try {
        await provider.cancel(p.providerRef);
      } catch (e) {
        // Couldn't close it at the gateway: leave the order pending so a
        // late payment is still matched; it expires on its own.
        console.error("[payments] cancel failed", e);
        return;
      }
    }
  }
  await failPendingOrder(order.id, "Customer cancelled payment", "customer");
}

/**
 * Sends a notification after the response is flushed (next/server
 * `after`), so the customer never waits on email/webhook latency and
 * serverless hosts keep the function alive until it finishes.
 */
function queueNotification(orderId: string, event: OrderEventName, opts?: NotifyOptions) {
  try {
    afterResponse(() => notifyOrder(orderId, event, opts));
  } catch {
    void notifyOrder(orderId, event, opts); // outside a request scope (scripts)
  }
}

export type TransitionResult = { ok: true } | { ok: false; status: number; error: string };

export async function transitionOrder(
  orderId: string,
  to: OrderStatusValue,
  actor: string,
  opts: { reason?: string | null; dispatch?: DispatchResult } = {},
): Promise<TransitionResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, couponId: true, paymentStatus: true, paymentMethod: true },
  });
  if (!order) return { ok: false, status: 404, error: "Order not found" };
  if (!canTransition(order.status, to)) {
    return { ok: false, status: 409, error: `Can't move an order from ${order.status} to ${to}.` };
  }
  if ((to === "REJECTED" || to === "CANCELLED") && !opts.reason?.trim()) {
    return { ok: false, status: 422, error: "Please give the customer a reason." };
  }

  const stamp = STATUS_TIMESTAMP[to];
  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      // Optimistic lock: if two tablets tap at once, only one wins.
      where: { id: orderId, status: order.status },
      data: {
        status: to,
        ...(stamp ? { [stamp]: new Date() } : {}),
        ...(to === "REJECTED" || to === "CANCELLED" ? { rejectionReason: opts.reason!.trim() } : {}),
        ...(to === "DELIVERED" && order.paymentStatus === "PAY_ON_DELIVERY" ? { paymentStatus: "PAID" as const } : {}),
        ...(opts.dispatch ?? {}),
      },
    });
    if (res.count === 0) return false;
    // Any staff action on the order silences its alarm.
    await tx.order.updateMany({ where: { id: orderId, seenAt: null }, data: { seenAt: new Date() } });
    await tx.orderEvent.create({
      data: { orderId, type: "status", status: to, message: opts.reason?.trim() || null, actor },
    });
    if (to === "DELIVERED" && order.paymentStatus === "PAY_ON_DELIVERY") {
      await tx.payment.updateMany({ where: { orderId, status: "PAY_ON_DELIVERY" }, data: { status: "PAID" } });
    }
    if ((to === "REJECTED" || to === "CANCELLED") && order.couponId) {
      await tx.coupon.updateMany({ where: { id: order.couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
      await tx.giftClaim.updateMany({ where: { orderId }, data: { orderId: null, usedAt: null } });
    }
    if ((to === "REJECTED" || to === "CANCELLED") && order.paymentStatus === "PAID" && order.paymentMethod === "ONLINE") {
      await tx.orderEvent.create({
        data: { orderId, type: "note", message: "Online payment captured — refund it from the payment gateway dashboard.", actor: "system" },
      });
    }
    return true;
  });
  if (!updated) return { ok: false, status: 409, error: "This order was just updated by someone else — refresh and try again." };

  const event = STATUS_EVENT[to];
  if (event) queueNotification(orderId, event);
  // Cooked: its ingredients leave stock (never blocks the order board).
  await takeStockForWebsiteOrder(orderId, to);
  return { ok: true };
}

/** "Got it" on an auto-accepted order: stops the admin alarm. */
export async function acknowledgeOrder(orderId: string) {
  await prisma.order.updateMany({ where: { id: orderId, seenAt: null }, data: { seenAt: new Date() } });
}

/**
 * Claims an order's tickets for printing. Only the first device to ask
 * gets true, so two auto-printing tablets never print the same order.
 */
export async function claimPrint(orderId: string): Promise<boolean> {
  const res = await prisma.order.updateMany({ where: { id: orderId, printedAt: null }, data: { printedAt: new Date() } });
  return res.count === 1;
}

/** Statuses in which a dish can still be taken off an order. */
const ADJUSTABLE: OrderStatusValue[] = ["RECEIVED", "CONFIRMED", "PREPARING"];

/**
 * A dish ran out after the order was placed: lower its quantity (0 =
 * remove it), reprice the order and tell the customer. Returns the
 * dish's menu id so the caller can also mark it sold out.
 */
export async function reduceOrderItem(
  orderId: string,
  orderItemId: string,
  quantity: number,
  actor: string,
): Promise<{ ok: true; menuItemId: string | null } | { ok: false; status: number; error: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return { ok: false, status: 404, error: "Order not found" };
  if (!ADJUSTABLE.includes(order.status)) {
    return { ok: false, status: 409, error: "Dishes can only be removed before the order is ready." };
  }
  const item = order.items.find((i) => i.id === orderItemId);
  if (!item) return { ok: false, status: 404, error: "That dish isn't on this order." };
  if (quantity >= item.quantity) return { ok: false, status: 422, error: "Choose fewer than the customer ordered." };
  const left = order.items.reduce((n, i) => n + (i.id === item.id ? quantity : i.quantity), 0);
  if (left === 0) {
    return { ok: false, status: 409, error: "Nothing would be left — reject or cancel the order instead." };
  }

  const [settings, coupon] = await Promise.all([
    getOrderingSettings(),
    order.couponId ? prisma.coupon.findUnique({ where: { id: order.couponId } }) : null,
  ]);
  const removedFils = item.unitPriceFils * (item.quantity - quantity);
  const totals = repriceAfterRemoval({
    subtotalFils: order.subtotalFils - removedFils,
    deliveryFeeFils: order.deliveryFeeFils,
    serviceFeeFils: order.serviceFeeFils,
    discountFils: order.discountFils,
    coupon: coupon
      ? { type: coupon.type, value: coupon.value, maxDiscountFils: coupon.maxDiscount !== null ? toFils(coupon.maxDiscount) : null }
      : null,
    vatRate: settings.vatRate,
    pricesIncludeVat: settings.pricesIncludeVat,
  });
  const refundFils = order.totalFils - totals.totalFils;
  const removed = `${item.quantity - quantity}× ${item.name}${item.portion ? ` (${item.portion})` : ""}`;
  const paidOnline = order.paymentMethod === "ONLINE" && order.paymentStatus === "PAID";

  const updated = await prisma.$transaction(async (tx) => {
    // Optimistic lock: the totals we computed from must still be current.
    const res = await tx.order.updateMany({
      where: { id: orderId, status: order.status, subtotalFils: order.subtotalFils },
      data: totals,
    });
    if (res.count === 0) return false;
    if (quantity === 0) await tx.orderItem.delete({ where: { id: item.id } });
    else await tx.orderItem.update({ where: { id: item.id }, data: { quantity, lineTotalFils: item.unitPriceFils * quantity } });
    if (order.paymentStatus === "PAY_ON_DELIVERY") {
      await tx.payment.updateMany({ where: { orderId, status: "PAY_ON_DELIVERY" }, data: { amountFils: totals.totalFils } });
    }
    await tx.orderEvent.create({
      data: {
        orderId,
        type: "note",
        message: `Removed ${removed} — sold out. Total ${formatFils(order.totalFils)} → ${formatFils(totals.totalFils)}`,
        actor,
      },
    });
    if (paidOnline && refundFils > 0) {
      await tx.orderEvent.create({
        data: { orderId, type: "note", message: `Refund ${formatFils(refundFils)} from the payment gateway dashboard.`, actor: "system" },
      });
    }
    return true;
  });
  if (!updated) return { ok: false, status: 409, error: "This order was just updated by someone else — refresh and try again." };

  queueNotification(orderId, "order.updated", {
    detail:
      `Sorry — ${removed} is sold out, so we've taken it off your order. Your new total is ${formatFils(totals.totalFils)}.` +
      (paidOnline && refundFils > 0 ? ` We'll refund ${formatFils(refundFils)} to your card.` : ""),
  });
  return { ok: true, menuItemId: item.menuItemId };
}

/** Customer-safe view for the tracking page. */
export async function getTrackingView(token: string) {
  const order = await prisma.order.findUnique({
    where: { trackingToken: token },
    include: {
      items: { select: { id: true, name: true, portion: true, quantity: true, lineTotalFils: true, modifiers: true, notes: true } },
      events: { where: { type: "status" }, orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true } },
    },
  });
  if (!order) return null;
  const settings = await getOrderingSettings();
  return {
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    firstName: order.customerName.split(/\s+/)[0],
    areaName: order.areaName,
    addressLine: [order.unit && `Unit ${order.unit}`, order.floor && `Floor ${order.floor}`, order.building, order.street]
      .filter(Boolean)
      .join(", "),
    placedAt: order.placedAt.toISOString(),
    etaMin: order.etaMin,
    etaMax: order.etaMax,
    dispatchedAt: order.dispatchedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    reason: order.rejectionReason,
    trackingUrl: order.trackingUrl,
    driverName: order.status === "OUT_FOR_DELIVERY" ? order.driverName : null,
    items: order.items.map((i) => ({
      ...i,
      modifiers: (i.modifiers as { name: string }[] | null)?.map((m) => m.name) ?? [],
    })),
    subtotalFils: order.subtotalFils,
    deliveryFeeFils: order.deliveryFeeFils,
    serviceFeeFils: order.serviceFeeFils,
    discountFils: order.discountFils,
    vatFils: order.vatFils,
    totalFils: order.totalFils,
    couponCode: order.couponCode,
    pricesIncludeVat: settings.pricesIncludeVat,
    history: order.events
      .filter((e) => e.status)
      .map((e) => ({ status: e.status!, at: e.createdAt.toISOString() })),
  };
}

export type TrackingView = NonNullable<Awaited<ReturnType<typeof getTrackingView>>>;

/**
 * Number, status and time of several orders at once, by tracking token —
 * enough for the "your orders" list. Unknown tokens are simply left out.
 */
export async function getTrackingSummaries(tokens: string[]) {
  const orders = await prisma.order.findMany({
    where: { trackingToken: { in: tokens } },
    select: { trackingToken: true, number: true, status: true, placedAt: true },
  });
  return orders.map((o) => ({ token: o.trackingToken, number: o.number, status: o.status, placedAt: o.placedAt.toISOString() }));
}

export type TrackingSummary = Awaited<ReturnType<typeof getTrackingSummaries>>[number];
