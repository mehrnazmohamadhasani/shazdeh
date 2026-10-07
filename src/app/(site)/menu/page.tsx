import type { Metadata } from "next";
import { PageHero } from "@/components/shared/page-hero";
import { MenuExplorer } from "@/components/menu/menu-explorer";
import { JsonLd } from "@/components/shared/json-ld";
import { getMenuTree } from "@/lib/menu";
import { getSettings } from "@/lib/settings";
import { findPlatform, getSocialLinks } from "@/lib/social";
import { menuJsonLd } from "@/lib/seo";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Menu",
  description:
    "The full SHĀZDEH menu — slow-cooked Persian khoresh, saffron polo, golden tahdig, mezze and drinks. Delivered across Dubai.",
  alternates: { canonical: "/menu" },
};

export default async function MenuPage() {
  const [categories, settings, socials] = await Promise.all([
    getMenuTree(),
    getSettings(),
    getSocialLinks(),
  ]);

  const whatsapp =
    settings.whatsapp ?? findPlatform(socials, "whatsapp")?.url ?? undefined;
  const dishCount = categories.reduce((n, c) => n + c.items.length, 0);

  return (
    <>
      <JsonLd data={menuJsonLd(categories)} />
      <PageHero
        size="compact"
        eyebrow={<>The Menu · <span lang="fa">منو</span></>}
        title={
          <>
            The art of <span className="text-terracotta">Persian</span> rice.
          </>
        }
        description="Slow-cooked khoresh, saffron-jewelled polo and the golden crunch of tahdig — every plate made from scratch, every day, and delivered across Dubai."
        aside={
          <dl className="grid grid-cols-3 gap-4 border-t border-black-iron/10 pt-6 lg:ml-auto lg:max-w-sm">
            <HeroStat label="Dishes" value={String(dishCount)} />
            <HeroStat label="Courses" value={String(categories.length)} />
            <HeroStat label="Delivery" value="Dubai" />
          </dl>
        }
      />
      {categories.length > 0 ? (
        <MenuExplorer categories={categories} whatsapp={whatsapp} />
      ) : (
        <section className="container-shazdeh pb-32">
          <p className="t-h3">The menu is being refreshed.</p>
          <p className="t-body mt-3 text-dark-grey">
            Please check back shortly — or order through our delivery partners.
          </p>
        </section>
      )}
    </>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="caption">{label}</dt>
      <dd className="mt-2 text-2xl font-bold tabular-nums tracking-[-0.03em]">
        {value}
      </dd>
    </div>
  );
}
