import "server-only";
import { prisma } from "@/lib/prisma";
import { ResendError, resend } from "@/lib/campaigns/resend";
import { reportError } from "@/lib/report-error";
import {
  ERASED_ORDER_FIELDS,
  eraseBlocker,
  erasedClaimIdentity,
  maskedPhone,
} from "@/lib/ordering/customer-privacy-rules";

/*
 * A customer's requests about their own data, done by staff from the
 * Customers page: stop offers, and delete their personal data.
 * Everything is keyed by mobile, like the Customers list.
 */

/** Every email we hold for this mobile (checkout, orders, gift claims), lower-case. */
async function emailsFor(phone: string): Promise<string[]> {
  const [customer, orders, claims] = await Promise.all([
    prisma.customer.findUnique({ where: { phone }, select: { email: true } }),
    prisma.order.findMany({ where: { customerPhone: phone, customerEmail: { not: null } }, select: { customerEmail: true }, distinct: ["customerEmail"] }),
    prisma.giftClaim.findMany({ where: { phone }, select: { email: true } }),
  ]);
  const all = [customer?.email, ...orders.map((o) => o.customerEmail), ...claims.map((c) => c.email)];
  return [...new Set(all.filter((e): e is string => !!e).map((e) => e.trim().toLowerCase()))];
}

/**
 * Applies a change to Resend's contact for each email. Resend is only
 * where campaign contacts are copied to; our own records already stop
 * campaigns, so a Resend problem is reported, not fatal.
 */
async function updateResend(emails: string[], change: (email: string) => Promise<unknown>): Promise<boolean> {
  if (!process.env.RESEND_CAMPAIGN_API_KEY?.trim() || emails.length === 0) return true;
  let allOk = true;
  for (const email of emails) {
    try {
      await change(email);
    } catch (e) {
      if (e instanceof ResendError && e.status === 404) continue; // never became a campaign contact
      allOk = false;
      // Not the error itself: its message carries the email address.
      const status = e instanceof ResendError ? e.status : 0;
      await reportError(new Error(`Resend contact update failed (${status})`), { where: "customer-privacy.resend" });
    }
  }
  return allOk;
}

export type PrivacyResult = { ok: true; resendOk: boolean } | { ok: false; status: number; error: string };

/** Stops news and offers for this mobile, for good — also if they tick the box again later. */
export async function unsubscribeCustomer(phone: string, actor: string): Promise<PrivacyResult> {
  const [known, emails] = await Promise.all([
    Promise.all([prisma.customer.count({ where: { phone } }), prisma.giftClaim.count({ where: { phone } })]),
    emailsFor(phone),
  ]);
  if (known[0] + known[1] === 0) return { ok: false, status: 404, error: "No customer with this mobile." };
  await prisma.$transaction([
    prisma.customer.updateMany({ where: { phone }, data: { marketingOptIn: false } }),
    prisma.giftClaim.updateMany({ where: { phone }, data: { marketingOptIn: false } }),
    prisma.marketingUnsubscribe.createMany({ data: emails.map((email) => ({ email })), skipDuplicates: true }),
    prisma.auditLog.create({
      data: { actor, action: "customer.unsubscribe", entity: "Customer", entityId: maskedPhone(phone), after: { emails: emails.length } },
    }),
  ]);
  const resendOk = await updateResend(emails, (email) => resend.unsubscribeContact(email));
  return { ok: true, resendOk };
}

/**
 * Deletes a customer's personal data: their customer record and unused
 * gift claims go; their orders and redeemed claims stay for the tax
 * records with name, mobile, email, address and notes removed. Their
 * email stays on the unsubscribe list so they are never sent offers again.
 */
export async function eraseCustomer(phone: string, actor: string, now = new Date()): Promise<PrivacyResult> {
  const [orders, claims, customer] = await Promise.all([
    prisma.order.findMany({ where: { customerPhone: phone }, select: { id: true, status: true, placedAt: true } }),
    prisma.giftClaim.findMany({ where: { phone }, select: { id: true, orderId: true } }),
    prisma.customer.findUnique({ where: { phone }, select: { id: true } }),
  ]);
  if (orders.length === 0 && claims.length === 0 && !customer) return { ok: false, status: 404, error: "No customer with this mobile." };
  const blocker = eraseBlocker(orders, now);
  if (blocker) return { ok: false, status: 409, error: blocker };

  const emails = await emailsFor(phone);
  const orderIds = orders.map((o) => o.id);
  await prisma.$transaction([
    prisma.marketingUnsubscribe.createMany({ data: emails.map((email) => ({ email })), skipDuplicates: true }),
    prisma.order.updateMany({ where: { id: { in: orderIds } }, data: ERASED_ORDER_FIELDS }),
    // Staff notes on an order can name the customer; status messages don't.
    prisma.orderEvent.updateMany({ where: { orderId: { in: orderIds }, type: "note" }, data: { message: null } }),
    prisma.notification.updateMany({ where: { orderId: { in: orderIds } }, data: { recipient: null } }),
    prisma.pushSubscription.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.giftClaim.deleteMany({ where: { phone, orderId: null } }),
    ...claims.filter((c) => c.orderId).map((c) => prisma.giftClaim.update({ where: { id: c.id }, data: erasedClaimIdentity(c.id) })),
    prisma.customer.deleteMany({ where: { phone } }),
    prisma.auditLog.create({
      data: {
        actor,
        action: "customer.erase",
        entity: "Customer",
        entityId: maskedPhone(phone),
        after: { orders: orders.length, giftClaims: claims.length },
      },
    }),
  ]);
  const resendOk = await updateResend(emails, (email) => resend.deleteContact(email));
  return { ok: true, resendOk };
}
