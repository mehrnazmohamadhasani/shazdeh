import type { Metadata } from "next";
import { MapPin, Mail, Phone, ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import {
  WhatsappIcon,
  InstagramIcon,
  getSocialIcon,
} from "@/components/icons/social";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Order SHĀZDEH in Dubai. From our heart to your home.",
};

export default async function ContactPage() {
  const [settings, socials] = await Promise.all([
    getSettings(),
    prisma.socialLink.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }),
  ]);

  const hours = settings.openingHours
    ? safeParseHours(settings.openingHours)
    : null;

  const whatsappUrl = settings.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`
    : socials.find((s) => s.platform === "whatsapp")?.url;

  const instagram = socials.find((s) => s.platform === "instagram");
  const deliveryPartners = socials.filter((s) =>
    ["talabat", "deliveroo", "careem", "noon"].includes(s.platform),
  );

  return (
    <>
      {/* Quick actions */}
      <section className="container-shazdeh pt-36 md:pt-48 pb-24 md:pb-32">
        <div className="grid grid-cols-12 gap-y-12 lg:gap-x-12">
          <div className="col-span-12 lg:col-span-7 space-y-6">
            {whatsappUrl && (
              <Reveal>
                <ContactCard
                  href={whatsappUrl}
                  external
                  eyebrow="Fastest reply"
                  title="Order on WhatsApp"
                  body="Tap to open a conversation with our kitchen — usually replied within minutes."
                  icon={<WhatsappIcon className="h-5 w-5" />}
                  cta="Open"
                />
              </Reveal>
            )}

            {instagram && (
              <Reveal delay={0.1}>
                <ContactCard
                  href={instagram.url}
                  external
                  eyebrow="Behind the kitchen"
                  title="Follow on Instagram"
                  body="Daily plates, slow stews, and what's resting on the counter."
                  icon={<InstagramIcon className="h-5 w-5" />}
                  cta="Follow"
                />
              </Reveal>
            )}

            {deliveryPartners.length > 0 && (
              <Reveal delay={0.2}>
                <div className="rounded-sm border border-black-iron/10 p-7 md:p-8 bg-cream/40">
                  <p className="eyebrow eyebrow-accent">Delivery partners</p>
                  <h3 className="mt-3 font-bold text-2xl md:text-3xl tracking-[-0.035em]">
                    Order anywhere in Dubai.
                  </h3>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {deliveryPartners.map((p) => {
                      const Icon = getSocialIcon(p.platform);
                      return (
                        <a
                          key={p.id}
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 h-11 rounded-pill border border-black-iron/15 text-black-iron/85 hover:border-terracotta hover:text-terracotta transition-colors text-[11px] tracking-[0.22em] uppercase font-medium"
                        >
                          {Icon && <Icon className="h-3.5 w-3.5" />}
                          {p.label}
                        </a>
                      );
                    })}
                  </div>
                </div>
              </Reveal>
            )}
          </div>

          {/* Visit info */}
          <div className="col-span-12 lg:col-span-5 space-y-6">
            <Reveal delay={0.1}>
              <div className="rounded-sm border border-black-iron/10 p-7 md:p-8 bg-cream/40">
                <p className="eyebrow eyebrow-accent">Visit</p>
                <ul className="mt-6 space-y-4 text-[14px] font-light text-black-iron/80">
                  {settings.address && (
                    <li className="flex items-start gap-3">
                      <MapPin
                        className="h-3.5 w-3.5 mt-1 text-terracotta shrink-0"
                        strokeWidth={1.6}
                      />
                      <span>{settings.address}</span>
                    </li>
                  )}
                  {settings.phone && (
                    <li className="flex items-start gap-3">
                      <Phone
                        className="h-3.5 w-3.5 mt-1 text-terracotta shrink-0"
                        strokeWidth={1.6}
                      />
                      <a
                        href={`tel:${settings.phone}`}
                        className="hover:text-terracotta transition-colors"
                      >
                        {settings.phone}
                      </a>
                    </li>
                  )}
                  {settings.email && (
                    <li className="flex items-start gap-3">
                      <Mail
                        className="h-3.5 w-3.5 mt-1 text-terracotta shrink-0"
                        strokeWidth={1.6}
                      />
                      <a
                        href={`mailto:${settings.email}`}
                        className="hover:text-terracotta transition-colors"
                      >
                        {settings.email}
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            </Reveal>

            {hours && (
              <Reveal delay={0.2}>
                <div className="rounded-sm border border-black-iron/10 p-7 md:p-8 bg-cream/40">
                  <p className="eyebrow eyebrow-accent">Hours</p>
                  <ul className="mt-6 space-y-3 text-[13px]">
                    {Object.entries(hours).map(([day, time]) => (
                      <li
                        key={day}
                        className="flex items-center justify-between"
                      >
                        <span className="text-[10px] tracking-[0.22em] uppercase text-black-iron/55 font-medium">
                          {day}
                        </span>
                        <span className="text-black-iron font-light tabular-nums">
                          {String(time)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            )}

            <Reveal delay={0.3}>
              <a
                href={settings.mapUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center h-14 px-9 rounded-pill bg-terracotta text-warm-white text-[12px] tracking-[0.22em] uppercase font-medium glow-terracotta transition-all duration-500 hover:bg-[oklch(from_#ce4927_calc(l-0.04)_c_h)]"
              >
                Open in Maps
              </a>
            </Reveal>
          </div>
        </div>

        {settings.mapUrl && (
          <Reveal delay={0.4}>
            <div className="mt-16 md:mt-24 relative w-full aspect-[16/9] md:aspect-[21/9] overflow-hidden rounded-sm border border-black-iron/10 bg-cream">
              <iframe
                src={mapEmbedSrc(settings.address)}
                className="absolute inset-0 w-full h-full"
                loading="lazy"
                title="SHĀZDEH location"
              />
            </div>
          </Reveal>
        )}
      </section>
    </>
  );
}

function ContactCard({
  href,
  external,
  eyebrow,
  title,
  body,
  icon,
  cta,
}: {
  href: string;
  external?: boolean;
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  cta: string;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group block rounded-sm border border-black-iron/10 p-7 md:p-8 bg-cream/40 transition-colors hover:bg-cream"
    >
      <div className="flex items-center gap-6">
        <div className="grid place-items-center h-12 w-12 rounded-full bg-terracotta/10 text-terracotta border border-terracotta/25 shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] tracking-[0.22em] uppercase text-terracotta">
            {eyebrow}
          </p>
          <h3 className="mt-2 font-bold text-2xl md:text-[28px] tracking-[-0.035em]">
            {title}
          </h3>
          <p className="mt-1.5 text-[14px] font-light text-black-iron/65">
            {body}
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-2 text-[10px] tracking-[0.22em] uppercase font-medium text-terracotta group-hover:translate-x-1 transition-transform">
          {cta}
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
        </span>
      </div>
    </a>
  );
}

function safeParseHours(s: string): Record<string, string> | null {
  try {
    const o = JSON.parse(s);
    if (o && typeof o === "object") return o;
    return null;
  } catch {
    return null;
  }
}

function mapEmbedSrc(address: string | null) {
  const q = encodeURIComponent(address ?? "Dubai");
  return `https://www.google.com/maps?q=${q}&output=embed`;
}
