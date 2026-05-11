import * as React from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import {
  InstagramIcon,
  WhatsappIcon,
} from "@/components/icons/social";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

/*
 * Footer — warm-white ground with Black Iron type. Same editorial
 * structure as before; colour palette now matches the light body.
 */
export async function SiteFooter() {
  const [settings, socials] = await Promise.all([
    getSettings(),
    prisma.socialLink
      .findMany({ where: { isActive: true }, orderBy: { order: "asc" } })
      .catch(() => []),
  ]);

  const year = new Date().getFullYear();
  const instagram = socials.find((s) => s.platform === "instagram");
  const whatsapp = socials.find((s) => s.platform === "whatsapp");

  return (
    <footer className="relative bg-soft-grey/20 text-black-iron">
      {/* Editorial top — slogan + wordmark, set massive */}
      <section className="border-b border-black-iron/[0.08]">
        <div className="container-shazdeh py-20 md:py-28 lg:py-36">
          <p className="eyebrow">From our heart to your home</p>
          <h2 className="mt-6 display-lg text-[10vw] md:text-[6.5rem] lg:text-[8rem] leading-[0.92] tracking-[-0.05em] max-w-5xl">
            A table set with{" "}
            <span className="text-terracotta">intention</span>.
          </h2>
        </div>
      </section>

      {/* Information row */}
      <section className="container-shazdeh py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5 space-y-6">
            <Wordmark size="lg" withDescriptor />
            <p className="text-[14px] font-light text-black-iron/60 leading-[1.55] max-w-sm">
              {settings.description}
            </p>
          </div>

          <FooterColumn label="Visit" className="md:col-span-3">
            {settings.address && (
              <FooterText>{settings.address}</FooterText>
            )}
            {settings.phone && (
              <FooterLink href={`tel:${settings.phone}`}>
                {settings.phone}
              </FooterLink>
            )}
            {settings.email && (
              <FooterLink href={`mailto:${settings.email}`}>
                {settings.email}
              </FooterLink>
            )}
          </FooterColumn>

          <FooterColumn label="Explore" className="md:col-span-2">
            <FooterLink href="/menu">Menu</FooterLink>
            <FooterLink href="/about">Story</FooterLink>
            <FooterLink href="/gallery">Gallery</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
          </FooterColumn>

          <FooterColumn label="Follow" className="md:col-span-2">
            {socials.map((s) => (
              <FooterLink key={s.id} href={s.url} external>
                {s.label}
              </FooterLink>
            ))}
          </FooterColumn>
        </div>
      </section>

      <section className="border-t border-black-iron/[0.08]">
        <div className="container-shazdeh py-7 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] tracking-[0.22em] uppercase text-black-iron/40">
            © {year} SHĀZDEH · Dubai · All rights reserved
          </p>
          <div className="flex items-center gap-2">
            {instagram && (
              <a
                href={instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="grid place-items-center h-9 w-9 rounded-full border border-black-iron/15 text-black-iron/55 hover:text-terracotta hover:border-terracotta/40 transition-colors"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
            )}
            {whatsapp && (
              <a
                href={whatsapp.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="grid place-items-center h-9 w-9 rounded-full border border-black-iron/15 text-black-iron/55 hover:text-terracotta hover:border-terracotta/40 transition-colors"
              >
                <WhatsappIcon className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </section>
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
  return (
    <div className={className}>
      <p className="text-[10px] tracking-[0.22em] uppercase text-black-iron/40 mb-5">
        {label}
      </p>
      <ul className="space-y-2.5">
        {React.Children.map(children, (child, i) => (
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
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-[14px] font-light text-black-iron/65 hover:text-terracotta transition-colors duration-300"
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className="inline-block text-[14px] font-light text-black-iron/65 hover:text-terracotta transition-colors duration-300"
    >
      {children}
    </Link>
  );
}

function FooterText({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[14px] font-light text-black-iron/65">
      {children}
    </span>
  );
}
