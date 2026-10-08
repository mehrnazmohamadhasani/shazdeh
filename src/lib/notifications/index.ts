import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";
import { formatFils } from "@/lib/ordering/money";
import { getOrderingSettings } from "@/lib/ordering/config";
import { sendPush } from "@/lib/notifications/push";

/*
 * Order notifications.
 *
 * Every attempt is written to the Notification table, so staff can see
 * what was sent. Channels are switched on by environment variables:
 *
 *   email    RESEND_API_KEY + EMAIL_FROM   (customer receipts/updates,
 *            and the kitchen inbox set in Ordering settings)
 *   push     VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (see ./push.ts) —
 *            customers who tapped "Notify me" on the tracking page get
 *            every status change; staff get new orders.
 *   webhook  ORDER_WEBHOOK_URL (+ ORDER_WEBHOOK_SECRET for an HMAC
 *            signature) — a JSON POST per event; point it at Make,
 *            Zapier, Slack, or a WhatsApp/SMS provider to fan out.
 *
 * SMS / WhatsApp Business adapters slot in beside sendEmail().
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
  | "order.updated"
  | "payment.received"
  | "payment.failed";

// email: false → push only (not worth an email).
const CUSTOMER_COPY: Partial<Record<OrderEventName, { subject: string; line: string; email?: false }>> = {
  "order.received": { subject: "We have your order", line: "Your order is with the kitchen." },
  "order.confirmed": { subject: "Order confirmed", line: "The kitchen has accepted your order." },
  "order.preparing": { subject: "In the kitchen", line: "Your food is being prepared." },
  "order.ready": { subject: "Ready", line: "Your order is packed and waiting for the rider.", email: false },
  "order.dispatched": { subject: "On its way", line: "Your order is out for delivery." },
  "order.delivered": { subject: "Delivered — nooshe jan", line: "Your order has been delivered. Enjoy." },
  "order.rejected": { subject: "We couldn't take your order", line: "Unfortunately the kitchen couldn't accept your order." },
  "order.cancelled": { subject: "Order cancelled", line: "Your order has been cancelled." },
  "order.updated": { subject: "Your order has changed", line: "We've had to make a change to your order." },
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

async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) return "skipped" as const;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}) }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return "sent" as const;
}

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function dubaiClock(d: Date, addMinutes = 0) {
  return new Intl.DateTimeFormat("en-AE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" }).format(
    new Date(d.getTime() + addMinutes * 60_000),
  );
}

export type NotifyOptions = {
  /** Extra line for the customer (e.g. which dish was removed, new total). */
  detail?: string;
  /** The order skipped "New" (auto-accept): tell the customer it's confirmed. */
  autoAccepted?: boolean;
};

/** Sends everything due for an order event. */
export async function notifyOrder(orderId: string, event: OrderEventName, { detail, autoAccepted }: NotifyOptions = {}) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { name: true, portion: true, quantity: true, lineTotalFils: true } },
        pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
      },
    });
    if (!order) return;
    const trackUrl = absoluteUrl(`/order/track/${order.trackingToken}`);
    const summary = order.items
      .map((i) => `${i.quantity}× ${i.name}${i.portion ? ` (${i.portion})` : ""}`)
      .join(", ");
    const eta =
      event === "order.received" || event === "order.confirmed" || event === "order.preparing"
        ? `Estimated arrival ${dubaiClock(order.placedAt, order.etaMin)}–${dubaiClock(order.placedAt, order.etaMax)}`
        : null;

    // Customer email
    const copy = CUSTOMER_COPY[autoAccepted && event === "order.received" ? "order.confirmed" : event];
    if (copy && copy.email !== false) {
      if (order.customerEmail) {
        const lines = [copy.line, detail, eta].filter(Boolean) as string[];
        const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#1d1d1b">
<p style="color:#ce4927;font-weight:700;letter-spacing:.08em">SHĀZDEH</p>
<h1 style="font-size:22px;margin:0 0 8px">${esc(copy.subject)}</h1>
${lines.map((l) => `<p style="margin:4px 0">${esc(l)}</p>`).join("")}
<p style="margin:16px 0 4px;font-weight:600">Order ${esc(order.number)}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">${order.items
          .map(
            (i) =>
              `<tr><td style="padding:4px 0">${i.quantity}× ${esc(i.name)}${i.portion ? ` (${esc(i.portion)})` : ""}</td><td style="text-align:right">${formatFils(i.lineTotalFils)}</td></tr>`,
          )
          .join("")}<tr><td style="padding-top:8px;border-top:1px solid #ddd;font-weight:700">Total</td><td style="padding-top:8px;border-top:1px solid #ddd;text-align:right;font-weight:700">${formatFils(order.totalFils)}</td></tr></table>
<p style="margin-top:20px"><a href="${esc(trackUrl)}" style="background:#ce4927;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Track your order</a></p>
<p style="color:#777;font-size:12px;margin-top:24px">SHĀZDEH — Persian Cuisine</p></div>`;
        try {
          const status = await sendEmail(
            order.customerEmail,
            `SHĀZDEH · ${copy.subject} · ${order.number}`,
            `${lines.join("\n")}\n\nOrder ${order.number}\n${summary}\nTotal: ${formatFils(order.totalFils)}\n\nTrack your order: ${trackUrl}\n\nSHĀZDEH — Persian Cuisine`,
            html,
          );
          await log(order.id, event, "email", order.customerEmail, status);
        } catch (e) {
          await log(order.id, event, "email", order.customerEmail, "failed", String(e));
        }
      } else {
        await log(order.id, event, "email", null, "skipped", "no customer email");
      }
    }

    // Customer push — every stage
    if (copy && order.pushSubscriptions.length) {
      const result = await sendPush(order.pushSubscriptions, {
        title: `${copy.subject} · ${order.number}`,
        body: [detail ?? copy.line, eta].filter(Boolean).join(" "),
        url: `/order/track/${order.trackingToken}`,
        tag: `order-${order.id}`,
      });
      await log(order.id, event, "push", `${order.pushSubscriptions.length} device(s)`, result === "skipped" ? "skipped" : result > 0 ? "sent" : "failed");
    }

    // Staff push — a new order reached the kitchen
    if (event === "order.received") {
      const staff = await prisma.pushSubscription.findMany({
        where: { userId: { not: null } },
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      });
      if (staff.length) {
        const result = await sendPush(staff, {
          title: `New order ${order.number}`,
          body: `${order.customerName} · ${order.areaName} · ${formatFils(order.totalFils)}`,
          url: "/admin/orders",
          tag: `staff-order-${order.id}`,
          requireInteraction: true,
        });
        await log(order.id, event, "push", "staff", result === "skipped" ? "skipped" : result > 0 ? "sent" : "failed");
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
