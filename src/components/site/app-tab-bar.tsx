"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, House, Images, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Bottom tab bar for the installed app on phones.
 *
 * In a browser tab the site keeps its editorial header + menu sheet (a
 * second bar would stack on Safari's own toolbar). Once launched from the
 * home screen there is no browser chrome, so primary navigation moves to
 * where thumbs are — the way a native app would do it. Visibility is pure
 * CSS (display-mode), so there is no layout shift on hydration.
 */

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/order", label: "Order", icon: ShoppingBag, primary: true },
  { href: "/about", label: "Story", icon: BookOpen },
  { href: "/gallery", label: "Gallery", icon: Images },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // /order/apps is part of the site, but reads as "ordering".
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="App"
      data-app-tabbar
      className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-black-iron/[0.08] bg-warm-white/95 pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)] backdrop-blur select-none [-webkit-touch-callout:none] standalone:max-md:block print:!hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] transition-colors",
                  active ? "text-terracotta-ink" : "text-dark-grey active:text-black-iron",
                )}
              >
                {"primary" in tab ? (
                  <span
                    className={cn(
                      "grid h-8 w-12 place-items-center rounded-pill transition-colors",
                      active ? "bg-terracotta text-white" : "bg-terracotta/10 text-terracotta-ink",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  </span>
                ) : (
                  <span className="grid h-8 place-items-center">
                    <Icon className="h-5 w-5" strokeWidth={active ? 1.9 : 1.5} />
                  </span>
                )}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
