"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChefHat,
  ExternalLink,
  FileText,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Store,
  TicketPercent,
  Truck,
  Users,
  UtensilsCrossed,
  Wallet,
  Sparkles,
  Banknote,
  Percent,
  TrendingUp,
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { roleHome } from "@/lib/roles";
import { LanguageSwitch, LanguageToggle, useAdminI18n } from "@/components/admin/i18n";

type Role = "ADMIN" | "EDITOR" | "STAFF" | "PURCHASER";
const ALL: Role[] = ["ADMIN", "EDITOR", "STAFF"];
const CMS: Role[] = ["ADMIN", "EDITOR"];
const PURCHASING: Role[] = ["ADMIN", "EDITOR", "PURCHASER"];
const ADMIN_ONLY: Role[] = ["ADMIN"];

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[]; group: string };

/*
 * Grouped by topic, so related screens sit together: everything about
 * guests' orders, everything about the menu, the kitchen's purchasing and
 * stock, the public website, and who has access.
 */
const NAV: NavItem[] = [
  { href: "/admin", label: "Today", icon: LayoutDashboard, roles: CMS, group: "Home" },
  { href: "/admin/ops/assistant", label: "Assistant", icon: Sparkles, roles: PURCHASING, group: "Home" },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText, roles: ALL, group: "Orders" },
  { href: "/admin/delivery", label: "Delivery zones", icon: Truck, roles: CMS, group: "Orders" },
  { href: "/admin/coupons", label: "Promo codes", icon: TicketPercent, roles: CMS, group: "Orders" },
  { href: "/admin/ordering", label: "Online ordering", icon: SlidersHorizontal, roles: ADMIN_ONLY, group: "Orders" },
  { href: "/admin/ops/sales", label: "Sales", icon: TrendingUp, roles: CMS, group: "Sales" },
  { href: "/admin/ops/channels", label: "Channels & fees", icon: Percent, roles: CMS, group: "Sales" },
  { href: "/admin/menu-items", label: "Menu", icon: UtensilsCrossed, roles: CMS, group: "Menu" },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, roles: CMS, group: "Menu" },
  { href: "/admin/ops/recipes", label: "Recipes", icon: ChefHat, roles: CMS, group: "Kitchen" },
  { href: "/admin/ops/stock", label: "Stock", icon: Package, roles: PURCHASING, group: "Kitchen" },
  { href: "/admin/ops/invoices", label: "Invoices", icon: FileText, roles: PURCHASING, group: "Kitchen" },
  { href: "/admin/ops/suppliers", label: "Suppliers", icon: Store, roles: PURCHASING, group: "Kitchen" },
  { href: "/admin/ops/payables", label: "Payables", icon: Wallet, roles: CMS, group: "Kitchen" },
  { href: "/admin/ops/cash", label: "Owner cash", icon: Banknote, roles: CMS, group: "Kitchen" },
  { href: "/admin/ops/settings", label: "Kitchen settings", icon: SlidersHorizontal, roles: CMS, group: "Kitchen" },
  { href: "/admin/settings", label: "Business details", icon: SettingsIcon, roles: CMS, group: "Website" },
  { href: "/admin/gallery", label: "Gallery", icon: ImageIcon, roles: CMS, group: "Website" },
  { href: "/admin/social", label: "Links", icon: Link2, roles: CMS, group: "Website" },
  { href: "/admin/team", label: "Team", icon: Users, roles: ADMIN_ONLY, group: "Access" },
];

function navFor(role: Role) {
  return NAV.filter((n) => n.roles.includes(role));
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function useSignOut() {
  const router = useRouter();
  const { t } = useAdminI18n();
  return async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      toast.error(t("Could not sign out"));
    }
  };
}

export function AdminSidebar({ user }: { user: { email: string; name: string | null; role: Role } }) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const { t } = useAdminI18n();
  const items = navFor(user.role);

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-black-iron/[0.07] bg-white pb-[var(--safe-bottom)] pt-[var(--safe-top)] lg:flex print:!hidden">
      <div className="flex h-16 items-center px-5">
        <Link href={roleHome(user.role)} aria-label={t("SHĀZDEH admin home")}>
          <Wordmark size="sm" />
        </Link>
      </div>

      <nav aria-label={t("Admin menu")} className="flex-1 overflow-y-auto px-3 pb-4">
        {items.map((item, i) => {
          const heading = item.group !== items[i - 1]?.group ? item.group : null;
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <React.Fragment key={item.href}>
              {heading && heading !== "Home" && items.length > 1 && (
                <p className={cn("px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-black-iron/40", i > 0 ? "pt-5" : "pt-2")}>
                  {t(heading)}
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
                {t(item.label)}
              </Link>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-black-iron/[0.07] p-3">
        <LanguageSwitch className="mb-2" />
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] text-dark-grey hover:bg-black-iron/[0.04] hover:text-black-iron"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={1.6} />
          {t("View website")}
        </a>
        <div className="flex items-center gap-3 rounded-[10px] px-3 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-terracotta/[0.12] text-[13px] font-semibold text-terracotta-ink">
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span dir="auto" className="block truncate text-[13px] font-medium text-black-iron">{user.name ?? t("Admin")}</span>
            <span dir="auto" className="block truncate text-[11.5px] text-dark-grey">{user.email}</span>
          </span>
          <button
            type="button"
            onClick={signOut}
            aria-label={t("Sign out")}
            title={t("Sign out")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-dark-grey hover:bg-pomegranate-red/[0.08] hover:text-pomegranate-red"
          >
            <LogOut className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AdminMobileBar({ user }: { user: { email: string; name: string | null; role: Role } }) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const { t } = useAdminI18n();
  const items = navFor(user.role);

  return (
    <header className="sticky top-0 z-40 border-b border-black-iron/[0.07] bg-white/95 pt-[var(--safe-top)] backdrop-blur lg:hidden print:hidden">
      <div className="flex h-14 items-center justify-between px-[max(1rem,var(--safe-left))]">
        <Link href={roleHome(user.role)} aria-label={t("SHĀZDEH admin home")}>
          <Wordmark size="xs" />
        </Link>
        <div className="-me-2 flex items-center">
          <LanguageToggle />
          <button
            type="button"
            onClick={signOut}
            className="inline-flex min-h-11 items-center gap-2 px-2 text-[13px] text-dark-grey hover:text-pomegranate-red"
          >
            <LogOut className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.6} />
            {t("Sign out")}
          </button>
        </div>
      </div>
      {items.length > 1 && <MobileMenu items={items} pathname={pathname} />}
    </header>
  );
}

/**
 * Phones: the current screen's name and a "Menu" button that opens every
 * screen in the same groups as the desktop sidebar, as a bottom sheet —
 * one tap, big targets, nothing hidden off to the side.
 */
function MobileMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const { t } = useAdminI18n();
  const [open, setOpen] = React.useState(false);
  const current = items.find((i) => isActive(pathname, i.href));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2 px-[max(1rem,var(--safe-left))] pb-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-black-iron/[0.05] px-4 text-[14px] font-medium text-black-iron"
        >
          <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {t("All screens")}
        </button>
        {current && (
          <span className="inline-flex min-w-0 items-center gap-2 truncate text-[14px] text-terracotta-ink">
            <current.icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
            <span className="truncate">{t(current.label)}</span>
          </span>
        )}
      </div>
      <DialogContent className="bg-white text-black-iron">
        <DialogTitle className="sr-only">{t("Admin menu")}</DialogTitle>
        <DialogDescription className="sr-only">{t("Go to another screen")}</DialogDescription>
        <nav aria-label={t("Admin menu")} className="px-4 pb-[max(1.25rem,var(--safe-bottom))] pt-5">
          {items.map((item, i) => {
            const heading = item.group !== items[i - 1]?.group && item.group !== "Home" ? item.group : null;
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <React.Fragment key={item.href}>
                {heading && <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-black-iron/40">{t(heading)}</p>}
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-[12px] px-3 text-[15px]",
                    active ? "bg-terracotta/[0.09] font-medium text-terracotta-ink" : "text-black-iron/80 active:bg-black-iron/[0.05]",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.6} />
                  {t(item.label)}
                </Link>
              </React.Fragment>
            );
          })}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
