"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ExternalLink,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  LogOut,
  ReceiptText,
  Settings as SettingsIcon,
  SlidersHorizontal,
  TicketPercent,
  Truck,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";

type Role = "ADMIN" | "EDITOR" | "STAFF";
const ALL: Role[] = ["ADMIN", "EDITOR", "STAFF"];
const CMS: Role[] = ["ADMIN", "EDITOR"];
const ADMIN_ONLY: Role[] = ["ADMIN"];

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[]; group: string };

/* Grouped by how often staff need them: daily work, setup, settings. */
const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: CMS, group: "Daily" },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText, roles: ALL, group: "Daily" },
  { href: "/admin/menu-items", label: "Menu", icon: UtensilsCrossed, roles: CMS, group: "Daily" },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, roles: CMS, group: "Setup" },
  { href: "/admin/delivery", label: "Delivery zones", icon: Truck, roles: CMS, group: "Setup" },
  { href: "/admin/coupons", label: "Promo codes", icon: TicketPercent, roles: CMS, group: "Setup" },
  { href: "/admin/gallery", label: "Gallery", icon: ImageIcon, roles: CMS, group: "Setup" },
  { href: "/admin/social", label: "Links", icon: Link2, roles: CMS, group: "Setup" },
  { href: "/admin/settings", label: "Business details", icon: SettingsIcon, roles: CMS, group: "Settings" },
  { href: "/admin/ordering", label: "Online ordering", icon: SlidersHorizontal, roles: ADMIN_ONLY, group: "Settings" },
  { href: "/admin/team", label: "Team", icon: Users, roles: ADMIN_ONLY, group: "Settings" },
];

function navFor(role: Role) {
  return NAV.filter((n) => n.roles.includes(role));
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function useSignOut() {
  const router = useRouter();
  return async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out");
    }
  };
}

export function AdminSidebar({ user }: { user: { email: string; name: string | null; role: Role } }) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const items = navFor(user.role);

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-black-iron/[0.07] bg-white pb-[var(--safe-bottom)] pt-[var(--safe-top)] lg:flex print:!hidden">
      <div className="flex h-16 items-center px-5">
        <Link href={user.role === "STAFF" ? "/admin/orders" : "/admin"} aria-label="SHĀZDEH admin home">
          <Wordmark size="sm" />
        </Link>
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 pb-4">
        {items.map((item, i) => {
          const heading = item.group !== items[i - 1]?.group ? item.group : null;
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <React.Fragment key={item.href}>
              {heading && items.length > 1 && (
                <p className={cn("px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-black-iron/40", i > 0 ? "pt-5" : "pt-2")}>
                  {heading}
                </p>
              )}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] transition-colors",
                  active
                    ? "bg-terracotta/[0.09] font-medium text-terracotta-ink"
                    : "text-black-iron/70 hover:bg-black-iron/[0.04] hover:text-black-iron",
                )}
              >
                <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.6} />
                {item.label}
              </Link>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-black-iron/[0.07] p-3">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] text-dark-grey hover:bg-black-iron/[0.04] hover:text-black-iron"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={1.6} />
          View website
        </a>
        <div className="flex items-center gap-3 rounded-[10px] px-3 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-terracotta/[0.12] text-[13px] font-semibold text-terracotta-ink">
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-black-iron">{user.name ?? "Admin"}</span>
            <span className="block truncate text-[11.5px] text-dark-grey">{user.email}</span>
          </span>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-dark-grey hover:bg-pomegranate-red/[0.08] hover:text-pomegranate-red"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AdminMobileBar({ user }: { user: { email: string; name: string | null; role: Role } }) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const items = navFor(user.role);

  return (
    <header className="sticky top-0 z-40 border-b border-black-iron/[0.07] bg-white/95 pt-[var(--safe-top)] backdrop-blur lg:hidden print:hidden">
      <div className="flex h-14 items-center justify-between px-[max(1rem,var(--safe-left))]">
        <Link href={user.role === "STAFF" ? "/admin/orders" : "/admin"} aria-label="SHĀZDEH admin home">
          <Wordmark size="xs" />
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="-mr-2 inline-flex min-h-11 items-center gap-2 px-2 text-[13px] text-dark-grey hover:text-pomegranate-red"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.6} />
          Sign out
        </button>
      </div>
      {items.length > 1 && (
        <nav aria-label="Admin" className="no-scrollbar flex gap-1.5 overflow-x-auto px-[max(1rem,var(--safe-left))] pb-3">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] transition-colors",
                  active ? "bg-terracotta text-white" : "bg-black-iron/[0.04] text-black-iron/75",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
