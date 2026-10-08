"use client";
import * as React from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/*
 * Offline page actions: retry (automatically, too, once the connection
 * returns) and the pages this device has saved — so the list only ever
 * shows what will genuinely open without a network.
 */

const LABELS: Record<string, string> = {
  "/": "Home",
  "/menu": "Menu",
  "/about": "Our story",
  "/gallery": "Gallery",
  "/order/apps": "Delivery apps & contact",
};

function labelFor(path: string) {
  if (LABELS[path]) return LABELS[path];
  const slug = path.split("/").pop() ?? path;
  const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (path.startsWith("/menu/")) return `Menu · ${name}`;
  if (path.startsWith("/legal/")) return `Policy · ${name}`;
  return name;
}

async function savedPages(): Promise<string[]> {
  if (!("caches" in window)) return [];
  const names = (await caches.keys()).filter((n) => n.startsWith("shazdeh-pages-"));
  const paths = new Set<string>();
  for (const name of names) {
    const cache = await caches.open(name);
    for (const req of await cache.keys()) {
      const path = new URL(req.url).pathname;
      if (path !== "/offline") paths.add(path);
    }
  }
  // Main sections first, then dishes and policies alphabetically.
  const order = Object.keys(LABELS);
  return [...paths].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });
}

export function OfflineActions() {
  const [pages, setPages] = React.useState<string[]>([]);

  React.useEffect(() => {
    let alive = true;
    savedPages()
      .then((p) => alive && setPages(p))
      .catch(() => {});
    const retry = () => window.location.reload();
    window.addEventListener("online", retry);
    return () => {
      alive = false;
      window.removeEventListener("online", retry);
    };
  }, []);

  return (
    <div className="relative mt-10 flex w-full max-w-sm flex-col items-center">
      <Button size="lg" onClick={() => window.location.reload()} className="w-full sm:w-auto">
        <RotateCw className="h-4 w-4" strokeWidth={1.6} />
        Try again
      </Button>

      {pages.length > 0 && (
        <nav aria-label="Saved pages" className="mt-12 w-full text-left">
          <h2 className="caption text-center">Saved on this device</h2>
          <ul className="mt-4 divide-y divide-black-iron/[0.08] border-y border-black-iron/[0.08]">
            {pages.slice(0, 8).map((path) => (
              <li key={path}>
                {/* Plain <a>: a full navigation lets the service worker
                    answer from its cache. */}
                <a
                  href={path}
                  className="flex min-h-12 items-center justify-between gap-4 py-3 text-[15px] font-normal transition-colors hover:text-terracotta-ink"
                >
                  {labelFor(path)}
                  <span aria-hidden className="text-dark-grey">→</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
