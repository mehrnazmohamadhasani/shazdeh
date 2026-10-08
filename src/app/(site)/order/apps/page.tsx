import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { PageHero } from "@/components/shared/page-hero";
import { Reveal, RevealItem, RevealStagger } from "@/components/shared/reveal";
import { ArchLines } from "@/components/brand/arch";
import { InstagramIcon, WhatsappIcon } from "@/components/icons/social";
import { getSettings, parseOpeningHours, summariseHours } from "@/lib/settings";
import { deliveryPartners, findPlatform, getSocialLinks } from "@/lib/social";
import { telHref, whatsappHref } from "@/lib/links";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Delivery apps & WhatsApp",
  description:
    "Prefer an app? Find SHĀZDEH Persian cuisine on Talabat, Careem and our other delivery partners, or message our kitchen on WhatsApp.",
  alternates: { canonical: "/order/apps" },
};

const FAQ = [
  {
    q: "Can I dine in?",
    a: "SHĀZDEH is a delivery-only kitchen — every dish is cooked to travel well and arrive the way it left our pass.",
  },
  {
    q: "Where do you deliver?",
    a: "Across Dubai through our delivery partners. Coverage and timing depend on your area — the apps show both before you order.",
  },
  {
    q: "Can I order for a gathering?",
    a: "Yes. For larger orders or an event, message our kitchen on WhatsApp a day ahead and we'll plan the sofreh with you.",
  },
];

export default async function OrderPage() {
  const [settings, socials] = await Promise.all([
    getSettings(),
    getSocialLinks(),
  ]);

  const partners = deliveryPartners(socials);
  const whatsapp = whatsappHref(
    settings.whatsapp ?? findPlatform(socials, "whatsapp")?.url,
    "Hello SHĀZDEH — I'd like to place an order.",
  );
  const instagram = findPlatform(socials, "instagram");
  const hours = parseOpeningHours(settings.openingHours);
  const daily = hours ? summariseHours(hours) : null;

  return (
    <>
      <PageHero
        size="compact"
        eyebrow="Order · Delivery across Dubai"
        title={
          <>
            From our heart
            <br />
            to your home.
          </>
        }
        description="The best way to order is directly from us — but if you prefer your favourite app, or a quick WhatsApp message, we're there too."
      />

      <div className="container-shazdeh pb-8">
        <Link
          href="/order"
          className="group flex min-h-16 items-center justify-between gap-4 rounded-[18px] bg-black-iron px-6 py-5 text-warm-white md:px-8"
        >
          <span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.22em] text-warm-white/70">
              Recommended
            </span>
            <span className="mt-1 block text-[1.25rem] font-bold tracking-[-0.03em]">
              Order direct from our kitchen
            </span>
          </span>
          <ArrowUpRight className="h-5 w-5 shrink-0 transition-transform duration-500 group-hover:translate-x-0.5" strokeWidth={1.5} />
        </Link>
      </div>

      <section aria-labelledby="order-heading" className="container-shazdeh pb-20 md:pb-28">
        <h2 id="order-heading" className="sr-only">
          Ways to order
        </h2>
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
          {whatsapp && (
            <Reveal className="lg:col-span-5">
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex h-full min-h-[260px] flex-col justify-between overflow-hidden rounded-[18px] bg-terracotta p-8 text-white transition-colors duration-500 hover:bg-terracotta-ink md:min-h-[340px] md:p-10"
              >
                <ArchLines
                  count={3}
                  className="absolute -bottom-6 right-6 h-[78%] w-[46%] text-white/20"
                />
                <div className="relative flex items-center gap-3">
                  <WhatsappIcon className="h-5 w-5" />
                  <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/85">
                    Direct from the kitchen
                  </span>
                </div>
                <div className="relative">
                  <p className="t-h2">Order on WhatsApp</p>
                  <p className="mt-4 max-w-xs text-[15px] leading-[1.6] text-white/85">
                    Fastest reply, and the easiest way to plan a larger order.
                  </p>
                  <span className="mt-8 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em]">
                    Start a conversation
                    <ArrowUpRight
                      className="h-4 w-4 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      strokeWidth={1.5}
                    />
                  </span>
                </div>
              </a>
            </Reveal>
          )}

          <div className={whatsapp ? "lg:col-span-7" : "lg:col-span-12"}>
            {partners.length > 0 ? (
              <RevealStagger
                as="ul"
                className="h-full divide-y divide-black-iron/10 border-y border-black-iron/10"
              >
                {partners.map((p) => (
                  <RevealItem as="li" key={p.id}>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between gap-6 py-7 md:py-9"
                    >
                      <span>
                        <span className="block caption">Delivery partner</span>
                        <span className="t-h2 mt-2 block transition-colors duration-300 group-hover:text-terracotta-ink">
                          {p.label}
                        </span>
                      </span>
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-black-iron/15 transition-all duration-500 group-hover:border-terracotta group-hover:bg-terracotta group-hover:text-white">
                        <ArrowUpRight className="h-5 w-5" strokeWidth={1.5} />
                        <span className="sr-only">Order on {p.label} (opens in a new tab)</span>
                      </span>
                    </a>
                  </RevealItem>
                ))}
              </RevealStagger>
            ) : (
              <div className="rounded-[18px] border border-black-iron/10 p-8">
                <p className="t-h3">Delivery apps — coming soon.</p>
                <p className="t-body mt-3 text-dark-grey">
                  In the meantime, our kitchen takes orders directly on WhatsApp.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        data-theme="cream"
        aria-label="Hours and contact"
        className="section-sm bg-cream"
      >
        <div className="container-shazdeh grid gap-12 md:grid-cols-3 md:gap-10">
          <Reveal>
            <h2 className="eyebrow eyebrow-accent">Kitchen hours</h2>
            {daily ? (
              <>
                <p className="t-h3 mt-5 tabular-nums">{daily}</p>
                <p className="t-body mt-2 text-dark-grey">Every day of the week</p>
              </>
            ) : hours ? (
              <ul className="mt-5 space-y-2.5 text-[15px]">
                {hours.map((h) => (
                  <li key={h.day} className="flex justify-between gap-6">
                    <span className="text-dark-grey">{h.label}</span>
                    <span className="tabular-nums">{h.hours}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-body mt-5 text-dark-grey">
                Live hours are shown in each delivery app.
              </p>
            )}
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="eyebrow eyebrow-accent">Get in touch</h2>
            <ul className="mt-5 space-y-3 text-[15px]">
              {settings.email && (
                <li>
                  <a
                    href={`mailto:${settings.email}`}
                    className="inline-flex min-h-11 items-center gap-3 hover:text-terracotta-ink [overflow-wrap:anywhere]"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-terracotta-ink" strokeWidth={1.5} />
                    {settings.email}
                  </a>
                </li>
              )}
              {settings.phone && (
                <li>
                  <a
                    href={telHref(settings.phone)}
                    className="inline-flex min-h-11 items-center gap-3 tabular-nums hover:text-terracotta-ink"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-terracotta-ink" strokeWidth={1.5} />
                    {settings.phone}
                  </a>
                </li>
              )}
              {instagram && (
                <li>
                  <a
                    href={instagram.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-3 hover:text-terracotta-ink"
                  >
                    <InstagramIcon className="h-4 w-4 shrink-0 text-terracotta-ink" />
                    Follow the kitchen on Instagram
                  </a>
                </li>
              )}
            </ul>
          </Reveal>

          <Reveal delay={0.16}>
            <h2 className="eyebrow eyebrow-accent">Good to know</h2>
            <div className="mt-5 divide-y divide-black-iron/10 border-y border-black-iron/10">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-1">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span
                      aria-hidden
                      className="text-lg leading-none text-terracotta-ink transition-transform duration-300 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="t-body pb-4 pr-6 text-dark-grey">{f.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
