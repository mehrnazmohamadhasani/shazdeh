"use client";
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/*
 * Error state for public pages — usually a transient database hiccup.
 * Offers a retry and a way back, never a stack trace.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="container-shazdeh flex min-h-[80svh] flex-col justify-center py-32">
      <p className="eyebrow eyebrow-accent">A moment, please</p>
      <h1 className="t-h1 mt-5 max-w-3xl">
        The kitchen is a little busy right now.
      </h1>
      <p className="t-lead mt-6 max-w-lg text-dark-grey">
        We couldn&apos;t load this page. Please try again — or order directly
        through our delivery partners.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/order">Order delivery</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="caption mt-10">Reference · {error.digest}</p>
      )}
    </section>
  );
}
