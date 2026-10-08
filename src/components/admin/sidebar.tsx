"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutDashboard,
  UtensilsCrossed,
  FolderTree,
  Image as ImageIcon,
  Sparkles,
  Settings as SettingsIcon,
  LogOut,
  Globe,
  Link2,
  ReceiptText,
  Truck,
  SlidersHorizontal,
  TicketPercent,
  Users,
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";

type Role = "ADMIN" | "EDITOR" | "STAFF";
const ALL: Role[] = ["ADMIN", "EDITOR", "STAFF"];
const CMS: Role[] = ["ADMIN", "EDITOR"];
const ADMIN_ONLY: Role[] = ["ADMIN"];

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[]; group?: string }[] = [
  { href: "/admin/orders", label: "Orders", icon: ReceiptText, roles: ALL, group: "Ordering" },
  { href: "/admin/delivery", label: "Delivery zones", icon: Truck, roles: CMS, group: "Ordering" },
  { href: "/admin/coupons", label: "Promo codes", icon: TicketPercent, roles: CMS, group: "Ordering" },
  { href: "/admin/ordering", label: "Ordering settings", icon: SlidersHorizontal, roles: ADMIN_ONLY, group: "Ordering" },
  { href: "/admin", label: "Overview", icon: LayoutDashboard, roles: CMS, group: "Content" },
  { href: "/admin/menu-items", label: "Menu Items", icon: UtensilsCrossed, roles: CMS, group: "Content" },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, roles: CMS, group: "Content" },
  { href: "/admin/banners", label: "Banners", icon: Sparkles, roles: CMS, group: "Content" },
  { href: "/admin/gallery", label: "Gallery", icon: ImageIcon, roles: CMS, group: "Content" },
  { href: "/admin/social", label: "Social Links", icon: Link2, roles: CMS, group: "Content" },
  { href: "/admin/settings", label: "Brand Settings", icon: SettingsIcon, roles: CMS, group: "Content" },
  { href: "/admin/team", label: "Team", icon: Users, roles: ADMIN_ONLY, group: "Content" },
];

function navFor(role: Role) {
  return NAV.filter((n) => n.roles.includes(role));
}

/*
 * Admin "Atelier" — kept on Black Iron because dark working tools
 * are easier on the eyes during long content sessions, but reskinned
 * with the SHĀZDEH tokens (terracotta accent, warm-white type, Inter).
 */

export function AdminSidebar({
  user,
}: {
  user: { email: string; name: string | null; role: Role };
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Signed out");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out");
    }
  }

  return (
    <aside
      data-theme="dark"
      className="hidden lg:flex print:!hidden flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-warm-white/[0.08] bg-black-iron text-warm-white"
    >
      <div className="p-6 border-b border-warm-white/[0.08]">
        <Link href="/admin" className="block">
          <Wordmark size="sm" className="text-warm-white" />
        </Link>
        <p className="mt-3 text-[10px] tracking-[0.32em] uppercase text-terracotta">
          The Atelier
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navFor(user.role).map((item, i, list) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const heading = item.group && item.group !== list[i - 1]?.group ? item.group : null;
          return (
            <React.Fragment key={item.href}>
            {heading && (
              <p className={cn("px-3 pb-1 text-[9.5px] uppercase tracking-[0.28em] text-warm-white/35", i > 0 && "pt-5")}>
                {heading}
              </p>
            )}
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-light transition-colors",
                active
                  ? "bg-terracotta/[0.12] text-terracotta"
                  : "text-warm-white/65 hover:text-warm-white hover:bg-warm-white/[0.04]",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="p-3 border-t border-warm-white/[0.08] space-y-1">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-light text-warm-white/55 hover:text-warm-white hover:bg-warm-white/[0.04] transition-colors"
        >
          <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />
          View public site
        </Link>
        <div className="px-3 py-3 rounded-md bg-warm-white/[0.03] border border-warm-white/[0.06]">
          <p className="text-[12px] text-warm-white truncate">
            {user.name ?? "Admin"}
          </p>
          <p className="text-[10px] text-warm-white/50 truncate mt-0.5 font-light">
            {user.email}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-light text-warm-white/65 hover:text-pomegranate-red hover:bg-pomegranate-red/[0.10] transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function AdminMobileBar({
  user,
}: {
  user: { email: string; name: string | null; role: Role };
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      data-theme="dark"
      className="lg:hidden print:hidden sticky top-0 z-40 bg-black-iron/95 text-warm-white backdrop-blur-xl border-b border-warm-white/[0.08]"
    >
      <div className="flex items-center justify-between px-4 h-14">
        <Link href="/admin">
          <Wordmark size="xs" className="text-warm-white" />
        </Link>
        <button
          onClick={handleLogout}
          className="text-[10px] tracking-[0.22em] uppercase font-medium text-warm-white/65 hover:text-pomegranate-red"
        >
          Sign out
        </button>
      </div>
      <nav className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        {navFor(user.role).map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 px-3 h-8 rounded-pill text-[10px] tracking-[0.22em] uppercase font-medium",
                active
                  ? "bg-terracotta text-warm-white"
                  : "bg-warm-white/[0.05] text-warm-white/65 border border-warm-white/[0.08]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
