import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";
import { formatFils } from "@/lib/ordering/money";
import { getOrderingSettings } from "@/lib/ordering/config";

/*
 * Order notifications.
 *
 * Every attempt is written to the Notification table, so staff can see
 * what was sent. Channels are switched on by environment variables:
 *
 *   email    RESEND_API_KEY + EMAIL_FROM   (customer receipts/updates,
 *            and the kitchen inbox set in Ordering settings)
 *   webhook  ORDER_WEBHOOK_URL (+ ORDER_WEBHOOK_SECRET for an HMAC
 *            signature) — a JSON POST per event; point it at Make,
 *            Zapier, Slack, or a WhatsApp/SMS provider to fan out.
 *
 * SMS / WhatsApp Business / push adapters slot in beside sendEmail().
 * The staff dashboard also polls for new orders and chimes, so the
 * kitchen is never dependent on any of these channels.
 */

export type OrderEventName =
  | "order.received"
  | "order.confirmed"
  | "order.preparing"
  | "order.ready"
  | "order.dispatched"
  | "order.delivered"
  | "order.rejected"
  | "order.cancelled"
  | "payment.received"
  | "payment.failed";

const CUSTOMER_COPY: Partial<Record<OrderEventName, { subject: string; line: string }>> = {
  "order.received": { subject: "We have your order", line: "Your order is with the kitchen." },
  "order.confirmed": { subject: "Order confirmed", line: "The kitchen has accepted your order." },
  "order.preparing": { subject: "In the kitchen", line: "Your food is being prepared." },
  "order.dispatched": { subject: "On its way", line: "Your order is out for delivery." },
  "order.delivered": { subject: "Delivered — nooshe jan", line: "Your order has been delivered. Enjoy." },
  "order.rejected": { subject: "We couldn't take your order", line: "Unfortunately the kitchen couldn't accept your order." },
  "order.cancelled": { subject: "Order cancelled", line: "Your order has been cancelled." },
  "payment.failed": { subject: "Payment didn't go through", line: "Your payment failed, so the order was not placed." },
};

const RESTAURANT_EVENTS: OrderEventName[] = ["order.received", "payment.received", "order.cancelled"];

async function log(
  orderId: string,
  event: string,
  channel: string,
  recipient: string | null,
  status: "sent" | "failed" | "skipped",
  error?: string,
) {
  await prisma.notification
    .create({ data: { orderId, event, channel, recipient, status, error: error?.slice(0, 500) } })
    .catch((e) => console.error("[notify] log failed", e));
}

async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) return "skipped" as const;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return "sent" as const;
}

export async function notifyOrder(orderId: string, event: OrderEventName) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { select: { name: true, portion: true, quantity: true } } },
    });
    if (!order) return;
    const trackUrl = absoluteUrl(`/order/track/${order.trackingToken}`);
    const summary = order.items
      .map((i) => `${i.quantity}× ${i.name}${i.portion ? ` (${i.portion})` : ""}`)
      .join(", ");

    // Customer email
    const copy = CUSTOMER_COPY[event];
    if (copy) {
      if (order.customerEmail) {
        try {
          const status = await sendEmail(
            order.customerEmail,
            `SHĀZDEH · ${copy.subject} · ${order.number}`,
            `${copy.line}\n\nOrder ${order.number}\n${summary}\nTotal: ${formatFils(order.totalFils)}\n\nTrack your order: ${trackUrl}\n\nSHĀZDEH — Persian Cuisine`,
          );
          await log(order.id, event, "email", order.customerEmail, status);
        } catch (e) {
          await log(order.id, event, "email", order.customerEmail, "failed", String(e));
        }
      } else {
        await log(order.id, event, "email", null, "skipped", "no customer email");
      }
    }

    // Kitchen inbox
    if (RESTAURANT_EVENTS.includes(event)) {
      const settings = await getOrderingSettings();
      if (settings.notifyEmail) {
        try {
          const status = await sendEmail(
            settings.notifyEmail,
            `New SHĀZDEH order ${order.number} · ${formatFils(order.totalFils)} · ${order.areaName}`,
            `${event}\n\n${summary}\n${order.customerName} · ${order.customerPhone}\n${order.areaName}, ${order.building}\n\nOpen: ${absoluteUrl(`/admin/orders/${order.id}`)}`,
          );
          await log(order.id, event, "email", settings.notifyEmail, status);
        } catch (e) {
          await log(order.id, event, "email", settings.notifyEmail, "failed", String(e));
        }
      }
    }

    // Generic webhook
    const url = process.env.ORDER_WEBHOOK_URL?.trim();
    if (url) {
      const body = JSON.stringify({
        event,
        order: {
          id: order.id,
          number: order.number,
          status: order.status,
          paymentStatus: order.paymentStatus,
          total: order.totalFils / 100,
          currency: order.currency,
          area: order.areaName,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          items: summary,
          trackUrl,
          adminUrl: absoluteUrl(`/admin/orders/${order.id}`),
        },
        sentAt: new Date().toISOString(),
      });
      const secret = process.env.ORDER_WEBHOOK_SECRET?.trim();
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(secret
              ? { "X-Shazdeh-Signature": createHmac("sha256", secret).update(body).digest("hex") }
              : {}),
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        await log(order.id, event, "webhook", new URL(url).host, res.ok ? "sent" : "failed", res.ok ? undefined : `HTTP ${res.status}`);
      } catch (e) {
        await log(order.id, event, "webhook", null, "failed", String(e));
      }
    }
  } catch (e) {
    console.error("[notify]", event, e);
  }
}

export const STATUS_EVENT: Record<string, OrderEventName | undefined> = {
  CONFIRMED: "order.confirmed",
  PREPARING: "order.preparing",
  READY: "order.ready",
  OUT_FOR_DELIVERY: "order.dispatched",
  DELIVERED: "order.delivered",
  REJECTED: "order.rejected",
  CANCELLED: "order.cancelled",
};
