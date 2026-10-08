/*
 * Online payment provider contract.
 *
 * Every provider is a *hosted* checkout (redirect or hosted fields):
 * card numbers are entered on the gateway's page and never reach this
 * server, which keeps SHĀZDEH at the lightest PCI DSS scope (SAQ A).
 *
 * To add Telr, Network International (N-Genius), Checkout.com, etc.,
 * implement this interface in a new file and register it in ./index.ts.
 * Nothing else in the ordering system needs to change.
 */

export type ProviderPaymentState = "PAID" | "PENDING" | "FAILED";

export type CheckoutRequest = {
  orderId: string;
  orderNumber: string;
  trackingToken: string;
  amountFils: number;
  currency: string;
  customerEmail: string | null;
  /** Absolute URL the gateway sends the customer back to. */
  returnUrl: string;
  /** Absolute URL for "cancel / go back". */
  cancelUrl: string;
};

export type CheckoutSession = {
  providerRef: string;
  redirectUrl: string;
};

export type WebhookResult = {
  /** Gateway event id, used to process each webhook exactly once. */
  eventId: string;
  providerRef: string;
  state: ProviderPaymentState;
  failureReason?: string;
};

export interface OnlinePaymentProvider {
  id: string;
  /** Shown at checkout, e.g. "Card, Apple Pay". */
  label: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** Server-to-server status lookup (used on return, before webhooks land). */
  fetchStatus(providerRef: string): Promise<{ state: ProviderPaymentState; failureReason?: string }>;
  /** Optional: invalidate an unpaid checkout the customer walked away from. */
  cancel?(providerRef: string): Promise<void>;
  /** Verifies the signature and parses the event; null = ignore (unrelated event). Throws on a bad signature. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookResult | null>;
}
