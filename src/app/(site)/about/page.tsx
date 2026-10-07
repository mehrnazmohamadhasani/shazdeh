import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/shared/page-hero";
import { Reveal, RevealItem, RevealStagger } from "@/components/shared/reveal";
import { ArchLines } from "@/components/brand/arch";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "SHĀZDEH is a contemporary Persian food brand in Dubai — rooted in heritage, expressed through a modern visual language, and delivered from our heart to your home.",
  alternates: { canonical: "/about" },
};

// Values verbatim from the brand guidelines.
const VALUES = [
  {
    title: "Heritage",
    body: "Respecting Persian culture, craftsmanship and tradition. The recipes are the ones we grew up with — plated with care, never reinvented for effect.",
  },
  {
    title: "Clarity",
    body: "Expressing ideas with simplicity, balance and intention. Every dish, every word, every detail is chosen — nothing is added for its own sake.",
  },
  {
    title: "Quality",
    body: "Attention to detail across ingredients, presentation and identity: the slow simmer, the bloomed saffron, the crust of the tahdig.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Our story"
        title={
          <>
            A Persian table,
            <br className="hidden sm:block" /> refined for today.
          </>
        }
        description="SHĀZDEH is a contemporary Persian food brand rooted in heritage and expressed through a modern visual language — from our heart to your home, across Dubai."
      />

      {/* Essence — editorial spread */}
      <section aria-labelledby="essence-heading" className="section pt-0 md:pt-0">
        <div className="container-shazdeh grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
          <Reveal className="relative mx-auto w-full max-w-[520px] lg:col-span-5">
            <ArchLines className="absolute -inset-4 text-terracotta/35" />
            <div className="arch relative aspect-[4/5] overflow-hidden bg-cream">
              <Image
                src="/menu/fesenjoon.jpg"
                alt="Fesenjan — pomegranate and walnut khoresh over saffron tahdig"
                fill
                preload
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-cover"
              />
            </div>
          </Reveal>
          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal>
              <p className="eyebrow eyebrow-accent">Brand essence</p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 id="essence-heading" className="t-h2 mt-5">
                Authenticity, balanced with simplicity.
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="t-lead mt-8 max-w-xl space-y-5 text-dark-grey">
                <p>
                  Inspired by Persian culture, craftsmanship and hospitality,
                  SHĀZDEH translates tradition into a refined and accessible
                  experience suited to today&apos;s urban life.
                </p>
                <p>
                  We cook the dishes of the Iranian home — khoresh that
                  simmer for hours, rice steamed until its crust turns
                  gold — and deliver them with the same care we would set
                  them on our own table.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Values — the brand book's three words, set large */}
      <section
        data-theme="cream"
        aria-labelledby="values-heading"
        className="section bg-cream"
      >
        <div className="container-shazdeh">
          <Reveal>
            <h2 id="values-heading" className="eyebrow eyebrow-accent">
              What we hold to
            </h2>
          </Reveal>
          <RevealStagger as="ol" className="mt-10 border-t border-black-iron/10">
            {VALUES.map((v, i) => (
              <RevealItem
                as="li"
                key={v.title}
                className="grid gap-4 border-b border-black-iron/10 py-10 md:grid-cols-12 md:items-baseline md:gap-8 md:py-14"
              >
                <span className="caption tabular-nums md:col-span-1">
                  0{i + 1}
                </span>
                <h3 className="t-h1 md:col-span-6">{v.title}</h3>
                <p className="t-body max-w-md text-dark-grey md:col-span-5">
                  {v.body}
                </p>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Hospitality — a Persian proverb, on the brand's dark ground */}
      <section
        data-theme="dark"
        aria-labelledby="proverb-heading"
        className="relative overflow-hidden bg-black-iron text-warm-white"
      >
        <ArchLines
          count={3}
          gap={20}
          className="absolute left-1/2 top-[14%] h-[120%] w-[min(560px,80vw)] -translate-x-1/2 text-warm-white/[0.09]"
        />
        <div className="container-shazdeh section relative text-center">
          <Reveal>
            <h2 id="proverb-heading" className="eyebrow eyebrow-accent">
              On hospitality
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p
              lang="fa"
              dir="rtl"
              className="mt-10 text-[clamp(2.5rem,1.6rem+4.5vw,5.5rem)] font-semibold leading-[1.25]"
            >
              مهمان حبیب خداست
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.28em] text-warm-white/60">
              Mehmān habib-e khodāst
            </p>
            <p className="t-lead mx-auto mt-8 max-w-xl text-warm-white/80">
              &ldquo;The guest is beloved of God&rdquo; — a saying every
              Iranian child knows. It is why the best of the pot goes to the
              guest, and why we cook for you the same way.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Invitation */}
      <section aria-labelledby="invite-heading" className="section">
        <div className="container-shazdeh grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <Reveal>
              <p className="eyebrow eyebrow-accent">An invitation</p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 id="invite-heading" className="t-h1 mt-5">
                From our heart to your home.
              </h2>
            </Reveal>
          </div>
          <Reveal
            delay={0.12}
            className="flex flex-col gap-3 sm:flex-row lg:col-span-4 lg:justify-end"
          >
            <Button asChild size="lg">
              <Link href="/order">Order now</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/menu">View the menu</Link>
            </Button>
          </Reveal>
        </div>
      </section>
    </>
  );
}
