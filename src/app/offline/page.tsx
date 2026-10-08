import type { Metadata } from "next";
import { ArchLines } from "@/components/brand/arch";
import { Wordmark } from "@/components/brand/wordmark";
import { OfflineActions } from "@/components/pwa/offline-actions";

/*
 * Served by the service worker when a page can't be reached and no saved
 * copy exists. Precached at install, so it must stand alone: no data
 * fetching, no site chrome that needs the database.
 */

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 pb-[calc(6rem+var(--safe-bottom))] pt-[calc(6rem+var(--safe-top))] text-center">
      <ArchLines
        count={3}
        gap={18}
        className="absolute bottom-0 left-1/2 h-[72%] w-[min(520px,86vw)] -translate-x-1/2 text-terracotta/20"
      />
      <Wordmark size="md" className="relative" />
      <p className="eyebrow eyebrow-accent relative mt-14">No connection</p>
      <h1 className="t-h2 relative mt-5">You&apos;re offline</h1>
      <p className="t-lead relative mt-6 max-w-md text-dark-grey">
        This page needs the internet. Ordering, payment and order tracking
        only work online — nothing has been sent while you were away.
      </p>
      <OfflineActions />
    </main>
  );
}
