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
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/menu-items", label: "Menu Items", icon: UtensilsCrossed },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/banners", label: "Banners", icon: Sparkles },
  { href: "/admin/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/admin/social", label: "Social Links", icon: Link2 },
  { href: "/admin/settings", label: "Brand Settings", icon: SettingsIcon },
];

/*
 * Admin "Atelier" — kept on Black Iron because dark working tools
 * are easier on the eyes during long content sessions, but reskinned
 * with the SHĀZDEH tokens (terracotta accent, warm-white type, Inter).
 */

export function AdminSidebar({
  user,
}: {
  user: { email: string; name: string | null };
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
      className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-warm-white/[0.08] bg-black-iron text-warm-white"
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
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
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
  user: _user,
}: {
  user: { email: string; name: string | null };
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
      className="lg:hidden sticky top-0 z-40 bg-black-iron/95 text-warm-white backdrop-blur-xl border-b border-warm-white/[0.08]"
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
        {NAV.map((item) => {
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
