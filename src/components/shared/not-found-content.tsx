import Link from "next/link";
import { ArchLines } from "@/components/brand/arch";
import { Button } from "@/components/ui/button";

export function NotFoundContent() {
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 py-32 text-center">
      <ArchLines
        count={3}
        gap={18}
        className="absolute bottom-0 left-1/2 h-[72%] w-[min(520px,86vw)] -translate-x-1/2 text-terracotta/20"
      />
      <p className="eyebrow eyebrow-accent relative">Off the menu</p>
      <h1 className="t-display relative mt-6">404</h1>
      <p className="t-lead relative mt-6 max-w-md text-dark-grey">
        This page isn&apos;t on the table. Let us take you back to something
        delicious.
      </p>
      <div className="relative mt-10 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/menu">View the menu</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </section>
  );
}
