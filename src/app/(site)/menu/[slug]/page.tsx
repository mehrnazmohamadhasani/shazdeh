import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsappIcon } from "@/components/icons/social";
import { ArchLines } from "@/components/brand/arch";
import { DishBadges, DishCard, DishSubtitle } from "@/components/menu/dish-card";
import { JsonLd } from "@/components/shared/json-ld";
import { Reveal } from "@/components/shared/reveal";
import { getMenuItemBySlug, getRelatedDishes } from "@/lib/menu";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { findPlatform, getSocialLinks } from "@/lib/social";
import { whatsappHref } from "@/lib/links";
import { breadcrumbJsonLd, dishJsonLd } from "@/lib/seo";
import { formatPrice } from "@/lib/utils";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

/** Prerender every dish; new dishes render on first visit, then cache. */
export async function generateStaticParams() {
  try {
    const items = await prisma.menuItem.findMany({
      where: { category: { isActive: true } },
      select: { slug: true },
    });
    return items.map((i) => ({ slug: i.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await getMenuItemBySlug(slug).catch(() => null);
  if (!found) return { title: "Dish not found" };
  const { dish } = found;
  const title = dish.portion ? `${dish.title} (${dish.portion})` : dish.title;
  const description =
    dish.description ??
    `${dish.title} — Persian cuisine by SHĀZDEH, delivered across Dubai.`;
  return {
    title,
    description,
    alternates: { canonical: `/menu/${dish.slug}` },
    openGraph: {
      type: "website",
      siteName: "SHĀZDEH",
      locale: "en_AE",
      url: `/menu/${dish.slug}`,
      title: `${title} · SHĀZDEH`,
      description,
      images: dish.imageUrl
        ? [{ url: dish.imageUrl, alt: dish.title }]
        : [{ url: "/opengraph-image.jpg", width: 1200, height: 630 }],
    },
  };
}

export default async function DishPage({ params }: Props) {
  const { slug } = await params;
  const found = await getMenuItemBySlug(slug);
  if (!found) notFound();
  const { dish, variants } = found;

  const [settings, socials, related] = await Promise.all([
    getSettings(),
    getSocialLinks(),
    getRelatedDishes(dish.category.slug, dish.slug),
  ]);

  const orderUrl = whatsappHref(
    settings.whatsapp ?? findPlatform(socials, "whatsapp")?.url,
    `Hello SHĀZDEH — I'd like to order ${dish.name}.`,
  );

  return (
    <>
      <JsonLd data={dishJsonLd(dish)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Menu", path: "/menu" },
          { name: dish.category.name, path: `/menu#${dish.category.slug}` },
          { name: dish.title, path: `/menu/${dish.slug}` },
        ])}
      />

      <article className="container-shazdeh pb-24 pt-28 md:pb-36 md:pt-36">
        <nav aria-label="Breadcrumb" className="mb-10 md:mb-14">
          <ol className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-dark-grey">
            <li>
              <Link
                href="/menu"
                className="inline-flex min-h-11 items-center gap-2 hover:text-black-iron"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                Menu
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href={`/menu#${dish.category.slug}`}
                className="inline-flex min-h-11 items-center hover:text-black-iron"
              >
                {dish.category.name}
              </Link>
            </li>
          </ol>
        </nav>

        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="relative lg:col-span-6">
            <ArchLines className="absolute -inset-3 hidden text-terracotta/30 md:block" />
            <div className="arch relative aspect-[4/5] overflow-hidden bg-cream">
              {dish.imageUrl && (
                <Image
                  src={dish.imageUrl}
                  alt={`${dish.title} — plated by SHĀZDEH`}
                  fill
                  preload
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover"
                />
              )}
            </div>
          </div>

          <div className="lg:col-span-6 lg:pt-10">
            <p className="eyebrow eyebrow-accent animate-rise">
              {dish.category.name}
            </p>
            <h1 className="t-h1 mt-5 animate-rise [animation-delay:60ms]">
              {dish.title}
            </h1>
            <DishSubtitle dish={dish} className="mt-4 text-[16px]" />

            {dish.description && (
              <p className="t-lead mt-8 max-w-xl text-dark-grey">
                {dish.description}
              </p>
            )}
            {dish.story && (
              <p className="mt-6 max-w-xl border-l-2 border-terracotta/40 pl-5 text-[15px] italic leading-[1.7] text-dark-grey">
                {dish.story}
              </p>
            )}

            <DishBadges dish={dish} className="mt-8" />

            {(dish.ingredients || dish.allergens) && (
              <dl className="mt-10 grid gap-6 border-t border-black-iron/10 pt-8 sm:grid-cols-2">
                {dish.ingredients && (
                  <div>
                    <dt className="caption">Ingredients</dt>
                    <dd className="mt-2 text-[15px] leading-[1.65]">
                      {dish.ingredients}
                    </dd>
                  </div>
                )}
                {dish.allergens && (
                  <div>
                    <dt className="caption">Allergens</dt>
                    <dd className="mt-2 text-[15px] leading-[1.65]">
                      {dish.allergens}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <div className="mt-10 border-t border-black-iron/10 pt-8">
              {variants.length > 0 ? (
                <ul className="space-y-3">
                  {variants.map((v) => (
                    <li key={v.id} className="flex items-baseline justify-between gap-6">
                      <span className="text-[15px]">{v.label}</span>
                      <span className="text-xl font-bold tabular-nums text-terracotta-ink">
                        {formatPrice(v.price, dish.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <p className="caption">Price</p>
                  <p className="mt-2 text-4xl font-bold tabular-nums tracking-[-0.03em] text-terracotta-ink">
                    {formatPrice(dish.price, dish.currency)}
                  </p>
                </>
              )}

              {dish.isAvailable ? (
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <Link href={`/order?dish=${dish.slug}`}>Order this dish</Link>
                  </Button>
                  {orderUrl && (
                    <Button asChild size="lg" variant="outline">
                      <a href={orderUrl} target="_blank" rel="noopener noreferrer">
                        <WhatsappIcon className="h-4 w-4" />
                        Ask on WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <p className="mt-8 rounded-sm bg-cream px-5 py-4 text-[15px] text-dark-grey">
                  Sold out today — please check back tomorrow.
                </p>
              )}
            </div>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section
          aria-labelledby="related-heading"
          data-theme="cream"
          className="section-sm bg-cream"
        >
          <div className="container-shazdeh">
            <Reveal>
              <h2 id="related-heading" className="t-h2">
                From the same table
              </h2>
            </Reveal>
            <div className="mt-12 grid grid-cols-2 gap-x-3 gap-y-12 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-8">
              {related.map((r) => (
                <DishCard key={r.id} dish={r} href={`/menu/${r.slug}`} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
