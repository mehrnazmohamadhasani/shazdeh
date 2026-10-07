import Image from "next/image";
import { RevealItem, RevealStagger } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { toPersianDigits } from "@/lib/dish";

/*
 * The craft — three pillars of the Persian kitchen, told through the
 * ingredients rather than adjectives. Numerals are set in both Latin
 * and Persian digits: a quiet bilingual detail, not decoration.
 */

const CRAFT = [
  {
    title: "Saffron",
    body: "Bloomed slowly in warm water, it gives the rice its colour and the whole kitchen its scent.",
    image: "/menu/zafaran.jpg",
    alt: "Zafaran — saffron and rose drink",
  },
  {
    title: "Rice & tahdig",
    body: "Long-grain rice, rinsed, steamed and finished over low heat until the base turns to a golden crust.",
    image: "/menu/shazdeh-mix.jpg",
    alt: "SHĀZDEH Mix — three rounds of golden tahdig, each crowned with a khoresh",
  },
  {
    title: "Herbs",
    body: "Green herbs chopped fine and simmered for hours — the patience behind ghormeh sabzi.",
    image: "/menu/ghormeh-sabzi.jpg",
    alt: "Ghormeh sabzi herb stew over a saffron tahdig",
  },
];

export function HomeCraft() {
  return (
    <section
      aria-labelledby="craft-heading"
      className="section border-t border-black-iron/[0.07]"
    >
      <div className="container-shazdeh">
        <SectionHeading
          id="craft-heading"
          eyebrow="The craft"
          title="Three things we never rush."
          description="Persian cooking is patient. These are the places where time does the work."
        />

        <RevealStagger
          as="ol"
          className="mt-16 grid gap-14 sm:grid-cols-3 sm:gap-6 md:mt-24 lg:gap-10"
        >
          {CRAFT.map((c, i) => (
            <RevealItem as="li" key={c.title}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-cream">
                <Image
                  src={c.image}
                  alt={c.alt}
                  fill
                  sizes="(min-width: 640px) 30vw, 100vw"
                  className="object-cover"
                />
              </div>
              <p className="caption mt-6 flex items-center gap-3">
                <span className="tabular-nums">0{i + 1}</span>
                <span aria-hidden className="h-px w-6 bg-current opacity-40" />
                <span lang="fa" aria-hidden className="text-[13px] tracking-normal">
                  {toPersianDigits(`0${i + 1}`)}
                </span>
              </p>
              <h3 className="t-h3 mt-4">{c.title}</h3>
              <p className="t-body mt-3 max-w-sm text-dark-grey">{c.body}</p>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
