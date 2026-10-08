import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { OnlinePaymentProvider } from "@/lib/payments/types";

/*
 * Development-only stand-in for a hosted gateway. It "redirects" to a
 * local page (/order/pay/mock/[token]) with Approve / Decline buttons so
 * the full online-payment flow can be exercised without merchant
 * credentials. Refused in production (see ./index.ts).
 */
export const mockProvider: OnlinePaymentProvider = {
  id: "mock",
  label: "Test card (development only)",

  async createCheckout(req) {
    return {
      providerRef: `mock_${randomBytes(9).toString("base64url")}`,
      redirectUrl: `/order/pay/mock/${req.trackingToken}`,
    };
  },

  async fetchStatus(providerRef) {
    const payment = await prisma.payment.findUnique({
      where: { provider_providerRef: { provider: "mock", providerRef } },
      select: { status: true },
    });
    if (payment?.status === "PAID") return { state: "PAID" };
    if (payment?.status === "FAILED") return { state: "FAILED", failureReason: "Declined" };
    return { state: "PENDING" };
  },

  async parseWebhook() {
    return null;
  },
};
