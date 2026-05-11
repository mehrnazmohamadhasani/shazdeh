import type { Metadata } from "next";
import { PageHero } from "@/components/shared/page-hero";
import { MenuExplorer } from "@/components/menu/menu-explorer";
import { getMenuTree } from "@/lib/menu";
import { getSettings } from "@/lib/settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Slow-cooked Persian khoresh, jewelled saffron rice and herbal sides — the full SHĀZDEH menu, served in Dubai.",
};

export default async function MenuPage() {
  const [categories, settings] = await Promise.all([
    getMenuTree(),
    getSettings(),
  ]);

  return (
    <>
      <PageHero
        eyebrow="The Menu"
        title={
          <>
            The
            <br />
            Art of
            <br />
            <span className="text-terracotta">Persian Rice</span>
          </>
        }
        description="From the slow-cooked classics of Iranian home kitchens to the dishes that put a Tehran weeknight on the table — every plate is built from scratch, every day."
      />
      <MenuExplorer
        categories={categories}
        whatsapp={settings.whatsapp ?? undefined}
      />
    </>
  );
}
