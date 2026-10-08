import { OrderFooter, OrderHeader } from "@/components/order/order-shell";
import { getSettings } from "@/lib/settings";
import { findPlatform, getSocialLinks } from "@/lib/social";
import { whatsappHref } from "@/lib/links";
import { getOrderingSettings } from "@/lib/ordering/config";

export default async function OrderLayout({ children }: { children: React.ReactNode }) {
  const [settings, socials, ordering] = await Promise.all([getSettings(), getSocialLinks(), getOrderingSettings()]);
  const whatsapp = whatsappHref(
    settings.whatsapp ?? findPlatform(socials, "whatsapp")?.url,
    "Hello SHĀZDEH — I have a question about my order.",
  );
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-pill focus:bg-black-iron focus:px-5 focus:py-3 focus:text-[12px] focus:font-medium focus:uppercase focus:tracking-[0.2em] focus:text-warm-white"
      >
        Skip to content
      </a>
      <OrderHeader logoUrl={settings.logoUrl} whatsapp={whatsapp} phone={settings.phone} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <OrderFooter
        brandName={settings.brandName}
        legal={ordering}
        address={settings.address}
        email={settings.email}
        phone={settings.phone}
      />
    </div>
  );
}
