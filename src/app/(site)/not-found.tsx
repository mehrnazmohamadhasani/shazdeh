import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="min-h-[100svh] flex flex-col items-center justify-center text-center p-6 bg-warm-white text-black-iron">
      <p className="text-[10px] tracking-[0.32em] uppercase text-terracotta">
        Off menu
      </p>
      <h1 className="mt-6 font-bold text-[18vw] md:text-[12rem] tracking-[-0.05em] leading-[0.92]">
        404
      </h1>
      <p className="mt-6 max-w-md text-[15px] font-light text-black-iron/65 leading-[1.6]">
        That dish isn&apos;t on the menu. Return to the table back home.
      </p>
      <div className="mt-10 flex flex-col sm:flex-row gap-3">
        <Button asChild size="lg">
          <Link href="/">Back home</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/menu">View the menu</Link>
        </Button>
      </div>
    </section>
  );
}
