"use client";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/*
 * Vercel Web Analytics (cookieless page views). Two things never leave
 * the browser: admin pages, and the secret token in order-tracking and
 * payment links — anyone holding one could open that customer's order.
 */
function scrub(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/") || url.pathname === "/login") return null;
  url.pathname = url.pathname
    .replace(/^\/order\/track\/[^/]+/, "/order/track/[token]")
    .replace(/^\/order\/pay\/mock\/[^/]+/, "/order/pay/mock/[token]");
  // Query strings can carry tokens too (?cancelled=…, ?order=…).
  url.search = "";
  return { ...event, url: url.toString() };
}

export function SiteAnalytics() {
  return <Analytics beforeSend={scrub} />;
}
