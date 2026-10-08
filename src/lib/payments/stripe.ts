import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { OnlinePaymentProvider, ProviderPaymentState } from "@/lib/payments/types";

/*
 * Stripe Checkout (hosted) — reference adapter. Uses the REST API
 * directly so no SDK is needed. Requires:
 *   STRIPE_SECRET_KEY       sk_live_… / sk_test_…
 *   STRIPE_WEBHOOK_SECRET   whsec_… (endpoint: /api/payments/stripe/webhook,
 *                           events: checkout.session.completed,
 *                           checkout.session.async_payment_succeeded,
 *                           checkout.session.async_payment_failed,
 *                           checkout.session.expired)
 */

const API = "https://api.stripe.com/v1";
const SESSION_TTL_SECONDS = 30 * 60; // Stripe's minimum; unpaid orders auto-cancel
const SIGNATURE_TOLERANCE_SECONDS = 300;

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return key;
}

async function stripe(path: string, init?: { method?: string; form?: Record<string, string> }) {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(init?.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init?.form ? new URLSearchParams(init.form).toString() : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const message = (json.error as { message?: string } | undefined)?.message;
    throw new Error(`Stripe ${res.status}: ${message ?? "request failed"}`);
  }
  return json;
}

type Session = {
  id: string;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
};

function stateOf(session: Session): ProviderPaymentState {
  if (session.payment_status === "paid") return "PAID";
  if (session.status === "expired") return "FAILED";
  return "PENDING";
}

export const stripeProvider: OnlinePaymentProvider = {
  id: "stripe",
  label: "Card, Apple Pay or Google Pay",

  async createCheckout(req) {
    const form: Record<string, string> = {
      mode: "payment",
      success_url: `${req.returnUrl}${req.returnUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: req.cancelUrl,
      client_reference_id: req.orderId,
      "metadata[order_id]": req.orderId,
      "metadata[order_number]": req.orderNumber,
      "payment_intent_data[metadata][order_id]": req.orderId,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": req.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(req.amountFils),
      "line_items[0][price_data][product_data][name]": `SHĀZDEH order ${req.orderNumber}`,
      expires_at: String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS),
    };
    if (req.customerEmail) form.customer_email = req.customerEmail;
    const session = (await stripe("/checkout/sessions", { method: "POST", form })) as {
      id: string;
      url: string;
    };
    return { providerRef: session.id, redirectUrl: session.url };
  },

  async fetchStatus(providerRef) {
    const session = (await stripe(`/checkout/sessions/${encodeURIComponent(providerRef)}`)) as Session;
    const state = stateOf(session);
    return state === "FAILED" ? { state, failureReason: "Checkout expired" } : { state };
  },

  async cancel(providerRef) {
    await stripe(`/checkout/sessions/${encodeURIComponent(providerRef)}/expire`, { method: "POST", form: {} });
  },

  async parseWebhook(rawBody, headers) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    const header = headers.get("stripe-signature") ?? "";
    const parts = Object.fromEntries(
      header.split(",").map((kv) => {
        const i = kv.indexOf("=");
        return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
      }),
    ) as Record<string, string>;
    const t = Number(parts.t);
    const signatures = header
      .split(",")
      .filter((kv) => kv.trim().startsWith("v1="))
      .map((kv) => kv.trim().slice(3));
    if (!t || signatures.length === 0) throw new Error("Missing Stripe signature");
    if (Math.abs(Date.now() / 1000 - t) > SIGNATURE_TOLERANCE_SECONDS) {
      throw new Error("Stale Stripe signature");
    }
    const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
    const valid = signatures.some((sig) => {
      const given = Buffer.from(sig, "hex");
      return given.length === expected.length && timingSafeEqual(given, expected);
    });
    if (!valid) throw new Error("Invalid Stripe signature");

    const event = JSON.parse(rawBody) as {
      id: string;
      type: string;
      data: { object: Session };
    };
    const session = event.data.object;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        return { eventId: event.id, providerRef: session.id, state: stateOf(session) };
      case "checkout.session.async_payment_failed":
        return { eventId: event.id, providerRef: session.id, state: "FAILED", failureReason: "Payment failed" };
      case "checkout.session.expired":
        return { eventId: event.id, providerRef: session.id, state: "FAILED", failureReason: "Checkout expired" };
      default:
        return null;
    }
  },
};
