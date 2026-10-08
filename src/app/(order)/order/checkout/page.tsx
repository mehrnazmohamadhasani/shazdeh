import type { Metadata } from "next";
import { OrderDataProvider } from "@/components/order/order-data";
import { CheckoutForm } from "@/components/order/checkout-form";
import { deliveryPartners, getSocialLinks } from "@/lib/social";
import { loadOrderData } from "../load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [data, socials] = await Promise.all([loadOrderData(), getSocialLinks()]);
  const partners = deliveryPartners(socials).map((p) => ({ label: p.label, url: p.url }));
  return (
    <OrderDataProvider data={data}>
      <CheckoutForm partners={partners} />
    </OrderDataProvider>
  );
}
