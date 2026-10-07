import * as React from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { getSocialIcon } from "@/components/icons/social";
import type { RestaurantSettingsView } from "@/lib/settings";
import { parseOpeningHours, summariseHours } from "@/lib/settings";
import type { SocialLinkView } from "@/lib/social";
import { isDeliveryPlatform, telHref } from "@/lib/links";

/*
 * Footer — Black ground (the brand's "logo on dark" application) so
 * the page ends with a decisive full stop after the warm-white body.
 */
export function SiteFooter({
  settings,
  socials,
  partners,
  whatsapp,
}: {
  settings: RestaurantSettingsView;
  socials: SocialLinkView[];
  partners: SocialLinkView[];
  whatsapp?: string;
}) {
  const year = new Date().getFullYear();
  const hours = parseOpeningHours(settings.openingHours);
  const daily = hours ? summariseHours(hours) : null;
  const follow = socials.filter(
    (s) => !isDeliveryPlatform(s.platform) && s.platform !== "whatsapp",
  );

  return (
    <footer data-theme="dark" className="bg-black-iron text-warm-white">
      <div className="container-shazdeh pb-10 pt-20 md:pt-28">
        <div className="grid gap-14 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-5">
            <Link href="/" aria-label="SHĀZDEH — home" className="inline-block">
              <Wordmark size="lg" withDescriptor logoUrl={settings.logoUrl} />
            </Link>
            <p className="mt-8 max-w-sm text-[15px] leading-[1.65] text-warm-white/70">
              From our heart to your home — contemporary Persian cuisine,
              delivered across Dubai.
            </p>
          </div>

          <FooterColumn label="Order" className="md:col-span-3">
            {partners.map((p) => (
              <FooterLink key={p.id} href={p.url} external>
                {p.label}
              </FooterLink>
            ))}
            {whatsapp && (
              <FooterLink href={whatsapp} external>
                WhatsApp
              </FooterLink>
            )}
            {daily && (
              <span className="block pt-2 text-[13px] text-warm-white/55">
                Daily · <span className="tabular-nums">{daily}</span>
              </span>
            )}
          </FooterColumn>

          <FooterColumn label="Explore" className="md:col-span-2">
            <FooterLink href="/menu">Menu</FooterLink>
            <FooterLink href="/about">Our story</FooterLink>
            <FooterLink href="/gallery">Gallery</FooterLink>
            <FooterLink href="/order">Order &amp; contact</FooterLink>
          </FooterColumn>

          <FooterColumn label="Contact" className="md:col-span-2">
            {settings.email && (
              <FooterLink href={`mailto:${settings.email}`}>
                {settings.email}
              </FooterLink>
            )}
            {settings.phone && (
              <FooterLink href={telHref(settings.phone)}>
                {settings.phone}
              </FooterLink>
            )}
            {settings.address && (
              <span className="block text-[14px] text-warm-white/70">
                {settings.address}
              </span>
            )}
          </FooterColumn>
        </div>

        <div className="mt-20 flex flex-col-reverse gap-6 border-t border-warm-white/[0.12] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] uppercase tracking-[0.2em] text-warm-white/50">
            © {year} SHĀZDEH · Dubai
          </p>
          {follow.length > 0 && (
            <ul className="-ml-3 flex items-center gap-1 sm:ml-0 sm:-mr-3">
              {follow.map((s) => {
                const Icon = getSocialIcon(s.platform);
                return (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${s.label} (opens in a new tab)`}
                      className="grid h-11 w-11 place-items-center rounded-full text-warm-white/70 transition-colors hover:bg-warm-white/10 hover:text-warm-white"
                    >
                      {Icon ? (
                        <Icon className="h-[18px] w-[18px]" />
                      ) : (
                        <span className="text-[11px] uppercase tracking-[0.18em]">
                          {s.label}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className={className}>
      <h2 className="mb-5 text-[11px] font-medium uppercase tracking-[0.2em] text-warm-white/50">
        {label}
      </h2>
      <ul className="space-y-3">
        {items.map((child, i) => (
          <li key={i}>{child}</li>
        ))}
      </ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const className =
    "inline-block text-[14px] text-warm-white/80 transition-colors duration-300 hover:text-white [overflow-wrap:anywhere]";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  if (href.startsWith("mailto:") || href.startsWith("tel:")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
