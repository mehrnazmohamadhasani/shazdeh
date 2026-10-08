import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderTracker } from "@/components/order/order-tracker";
import { getTrackingView } from "@/lib/ordering/orders";
import { getSettings } from "@/lib/settings";
import { findPlatform, getSocialLinks } from "@/lib/social";
import { telHref, whatsappHref } from "@/lib/links";
import { vapidPublicKey } from "@/lib/notifications/push";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const [{ token }, { placed }] = await Promise.all([params, searchParams]);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const [view, settings, socials] = await Promise.all([getTrackingView(token), getSettings(), getSocialLinks()]);
  if (!view) notFound();
  const whatsapp = whatsappHref(
    settings.whatsapp ?? findPlatform(socials, "whatsapp")?.url,
    `Hello SHĀZDEH — about my order ${view.number}.`,
  );
  return (
    <OrderTracker
      token={token}
      initial={view}
      placed={placed === "1"}
      whatsapp={whatsapp}
      phoneHref={settings.phone ? telHref(settings.phone) : undefined}
      vapidPublicKey={vapidPublicKey()}
    />
  );
}
