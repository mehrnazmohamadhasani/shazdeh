import "server-only";
import type { OnlinePaymentProvider } from "@/lib/payments/types";
import { stripeProvider } from "@/lib/payments/stripe";
import { mockProvider } from "@/lib/payments/mock";

/*
 * Payment provider registry. PAYMENT_PROVIDER selects the gateway used
 * for "Pay online"; leave it unset to offer pay-on-delivery only.
 *
 *   PAYMENT_PROVIDER=stripe   → ./stripe.ts (needs STRIPE_* keys)
 *   PAYMENT_PROVIDER=mock     → ./mock.ts   (development only)
 *
 * Swapping gateways later (Telr, N-Genius, Checkout.com…) means adding
 * one adapter file and one line here.
 */
const PROVIDERS: Record<string, OnlinePaymentProvider> = {
  stripe: stripeProvider,
  mock: mockProvider,
};

export function getOnlineProvider(): OnlinePaymentProvider | null {
  const id = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();
  if (!id) return null;
  if (id === "mock" && process.env.NODE_ENV === "production") {
    console.error("[payments] PAYMENT_PROVIDER=mock is refused in production");
    return null;
  }
  if (id === "stripe" && !process.env.STRIPE_SECRET_KEY?.trim()) {
    console.error("[payments] PAYMENT_PROVIDER=stripe but STRIPE_SECRET_KEY is missing");
    return null;
  }
  return PROVIDERS[id] ?? null;
}

export function getProviderById(id: string): OnlinePaymentProvider | null {
  const active = getOnlineProvider();
  return active && active.id === id ? active : null;
}

export type { OnlinePaymentProvider } from "@/lib/payments/types";
