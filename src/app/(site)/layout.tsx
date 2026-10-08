import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { AppTabBar } from "@/components/site/app-tab-bar";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { MotionProvider } from "@/components/shared/motion-provider";
import { getSettings } from "@/lib/settings";
import { deliveryPartners, findPlatform, getSocialLinks } from "@/lib/social";
import { whatsappHref } from "@/lib/links";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, socials] = await Promise.all([
    getSettings(),
    getSocialLinks(),
  ]);

  const whatsapp = whatsappHref(
    settings.whatsapp ?? findPlatform(socials, "whatsapp")?.url,
  );

  return (
    <MotionProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-pill focus:bg-black-iron focus:px-5 focus:py-3 focus:text-[12px] focus:font-medium focus:uppercase focus:tracking-[0.2em] focus:text-warm-white"
      >
        Skip to content
      </a>
      {/* Bottom padding reserves room for the installed app's tab bar. */}
      <div className="relative flex min-h-screen flex-col pb-[var(--tabbar-h)]">
        <SiteNav logoUrl={settings.logoUrl} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter
          settings={settings}
          socials={socials}
          partners={deliveryPartners(socials)}
          whatsapp={whatsapp}
        />
      </div>
      <AppTabBar />
      <InstallPrompt />
    </MotionProvider>
  );
}
