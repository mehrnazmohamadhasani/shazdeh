import { Reveal, RevealStagger, RevealItem } from "@/components/shared/reveal";

/*
 * Brand values — Heritage · Quality · Clarity (verbatim from the
 * brand book). Calm three-column editorial list on a cream ground.
 */

const VALUES = [
  {
    n: "01",
    title: "Heritage",
    body:
      "Respecting Persian culture, craftsmanship, and tradition. Every recipe is rooted in the family table and the rhythms of Tehran kitchens.",
  },
  {
    n: "02",
    title: "Quality",
    body:
      "Attention to detail across ingredients, presentation, and visual identity. We choose the better olive oil, the slower simmer, the right lamb.",
  },
  {
    n: "03",
    title: "Clarity",
    body:
      "Expressing ideas with simplicity, balance, and intention. Plates and palettes both, with nothing decorative for its own sake.",
  },
];

export function HomeValues() {
  return (
    <section className="relative bg-soft-grey/25 text-black-iron py-28 md:py-44">
      <div className="container-shazdeh">
        <Reveal>
          <p className="eyebrow">Brand Values</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="mt-6 max-w-5xl font-bold text-5xl md:text-7xl lg:text-[6rem] leading-[0.94] tracking-[-0.045em]">
            Three principles
            <br />
            <span className="text-black-iron/35">at every table.</span>
          </h2>
        </Reveal>

        <RevealStagger className="mt-20 md:mt-28 grid gap-y-14 md:grid-cols-3 md:gap-x-12 lg:gap-x-20">
          {VALUES.map((v) => (
            <RevealItem key={v.title}>
              <p className="text-[10px] tracking-[0.32em] uppercase text-terracotta">
                {v.n}
              </p>
              <h3 className="mt-6 font-bold text-3xl md:text-4xl tracking-[-0.035em]">
                {v.title}
              </h3>
              <p className="mt-5 max-w-sm text-[14px] md:text-[15px] font-light text-black-iron/60 leading-[1.6]">
                {v.body}
              </p>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
