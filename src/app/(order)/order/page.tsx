import type { Metadata } from "next";
import { OrderDataProvider } from "@/components/order/order-data";
import { OrderMenu } from "@/components/order/order-menu";
import { getSettings } from "@/lib/settings";
import { deliveryPartners, findPlatform, getSocialLinks } from "@/lib/social";
import { whatsappHref } from "@/lib/links";
import { loadOrderData } from "./load";

// Open/closed and sold-out states must be fresh; admin changes also
// revalidate immediately.
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Order online",
  description:
    "Order SHĀZDEH Persian cuisine directly from our kitchen — delivered across Dubai. Ghormeh sabzi, fesenjan, saffron rice and tahdig, without the marketplace.",
  alternates: { canonical: "/order" },
};

export default async function OrderPage() {
  const [data, settings, socials] = await Promise.all([loadOrderData(), getSettings(), getSocialLinks()]);
  const partners = deliveryPartners(socials).map((p) => ({ label: p.label, url: p.url }));
  const whatsapp = whatsappHref(
    settings.whatsapp ?? findPlatform(socials, "whatsapp")?.url,
    "Hello SHĀZDEH — I'd like to place an order.",
  );
  return (
    <OrderDataProvider data={data}>
      <OrderMenu partners={partners} whatsapp={whatsapp} />
    </OrderDataProvider>
  );
}
