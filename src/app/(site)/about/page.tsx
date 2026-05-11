import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/shared/page-hero";
import { Reveal, RevealStagger, RevealItem } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Story",
  description:
    "SHĀZDEH — a contemporary Persian food brand in Dubai, rooted in heritage and expressed through a modern visual language.",
};

const TONE = [
  { left: "Youthful", right: "Mature", value: 0.86 },
  { left: "Playful", right: "Serious", value: 0.78 },
  { left: "Casual", right: "Elegant", value: 0.92 },
  { left: "Mass appeal", right: "Elite", value: 0.84 },
  { left: "Traditional", right: "Contemporary", value: 0.74 },
  { left: "Economical", right: "Expensive", value: 0.82 },
  { left: "Innovative", right: "Classic", value: 0.5 },
  { left: "Decorative", right: "Minimal", value: 0.92 },
];

const PILLARS = [
  {
    n: "01",
    title: "Heritage",
    body:
      "Respecting Persian culture, craftsmanship, and tradition. The recipes are not interpretations — they are the originals, plated with care.",
  },
  {
    n: "02",
    title: "Quality",
    body:
      "Attention to detail across ingredients, presentation, and visual identity. The slow simmer, the better olive oil, the right lamb.",
  },
  {
    n: "03",
    title: "Clarity",
    body:
      "Expressing ideas with simplicity, balance, and intention. Every dish, every layout, every word — chosen, not added.",
  },
];

export default async function AboutPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHero
        eyebrow="The Brand"
        title={
          <>
            A Persian table,
            <br />
            <span className="text-terracotta">refined for today</span>.
          </>
        }
        description="SHĀZDEH is a contemporary Persian food brand rooted in heritage and expressed through a modern visual language."
      />

      {/* Editorial 12-grid spread */}
      <section className="container-shazdeh py-20 md:py-32 lg:py-44">
        <div className="grid grid-cols-12 gap-y-12 lg:gap-x-12">
          <div className="col-span-12 lg:col-span-6 lg:col-start-1">
            <Reveal>
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-cream">
                <Image
                  src="/menu/ghormeh-sabzi.jpg"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>
          </div>
          <div className="col-span-12 lg:col-span-5 lg:col-start-8 lg:pt-24">
            <Reveal>
              <p className="eyebrow eyebrow-accent">Brand Essence</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-6 font-bold text-4xl md:text-5xl lg:text-6xl tracking-[-0.045em] leading-[0.96]">
                Authenticity, balanced with
                <span className="text-terracotta"> simplicity</span>.
              </h2>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-10 space-y-5 font-light text-[16px] md:text-[17px] leading-[1.65] text-black-iron/75">
                <p>
                  Inspired by Persian culture, craftsmanship, and hospitality,
                  SHĀZDEH translates tradition into a refined and accessible
                  experience suited to today&apos;s urban lifestyle.
                </p>
                <p>
                  Every visual element is designed to balance authenticity and
                  simplicity, ensuring clarity, consistency, and a premium
                  presence across all touchpoints — from the plate to the page.
                </p>
                {settings.description && (
                  <p className="text-black-iron/55">{settings.description}</p>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Three pillars on cream */}
      <section
        data-theme="cream"
        className="bg-cream py-24 md:py-36 border-y border-black-iron/[0.06]"
      >
        <div className="container-shazdeh">
          <div className="max-w-5xl">
            <Reveal>
              <p className="eyebrow eyebrow-accent">Brand Values</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-6 font-bold text-4xl md:text-6xl lg:text-7xl tracking-[-0.045em] leading-[0.94]">
                Heritage. Quality. Clarity.
              </h2>
            </Reveal>
          </div>

          <RevealStagger className="mt-20 grid gap-y-14 md:grid-cols-3 md:gap-x-12 lg:gap-x-16">
            {PILLARS.map((p) => (
              <RevealItem key={p.title}>
                <p className="text-[10px] tracking-[0.32em] uppercase text-terracotta">
                  {p.n}
                </p>
                <h3 className="mt-6 font-bold text-3xl md:text-4xl tracking-[-0.035em]">
                  {p.title}
                </h3>
                <p className="mt-5 text-[14px] md:text-[15px] font-light text-black-iron/65 leading-[1.65]">
                  {p.body}
                </p>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Tone scale — verbatim from the brand book */}
      <section className="container-shazdeh py-24 md:py-36">
        <div className="grid grid-cols-12 gap-y-12 lg:gap-x-12">
          <div className="col-span-12 lg:col-span-4">
            <Reveal>
              <p className="eyebrow eyebrow-accent">Tone &amp; Voice</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-6 font-bold text-4xl md:text-5xl lg:text-6xl tracking-[-0.045em] leading-[0.96]">
                Calm, confident, restrained.
              </h2>
            </Reveal>
            <Reveal delay={0.18}>
              <p className="mt-8 text-[15px] font-light leading-[1.65] text-black-iron/65 max-w-sm">
                The brand voice is composed and culturally grounded —
                avoiding exaggeration and informality, never loud or playful.
              </p>
            </Reveal>
          </div>
          <div className="col-span-12 lg:col-span-7 lg:col-start-6">
            <RevealStagger className="space-y-7">
              {TONE.map((t) => (
                <RevealItem key={t.left}>
                  <div className="flex items-center gap-4">
                    <span className="w-32 shrink-0 text-[10px] tracking-[0.22em] uppercase text-black-iron/45 text-right">
                      {t.left}
                    </span>
                    <div className="relative flex-1 h-px bg-black-iron/10">
                      <span
                        className="absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-terracotta"
                        style={{ left: `${t.value * 100}%` }}
                      />
                    </div>
                    <span className="w-32 shrink-0 text-[10px] tracking-[0.22em] uppercase text-black-iron font-medium">
                      {t.right}
                    </span>
                  </div>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </div>
      </section>

      {/* Closing invitation */}
      <section className="bg-soft-grey/25 text-black-iron py-28 md:py-40">
        <div className="container-shazdeh">
          <Reveal>
            <p className="eyebrow">An Invitation</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-6 font-bold text-5xl md:text-7xl lg:text-[7rem] tracking-[-0.05em] leading-[0.94] max-w-5xl">
              From our heart
              <br />
              <span className="text-terracotta">to your home.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-12 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg">
                <Link href="/menu">View the menu</Link>
              </Button>
              {/* <Button asChild size="lg" variant="outline">
                <Link href="/contact">Reserve a table</Link>
              </Button> */}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
