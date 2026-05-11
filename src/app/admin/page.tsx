import Link from "next/link";
import {
  UtensilsCrossed,
  FolderTree,
  Image as ImageIcon,
  Sparkles,
  Star,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [
    itemCount,
    categoryCount,
    galleryCount,
    bannerCount,
    bestsellerCount,
    unavailableCount,
    recentItems,
  ] = await Promise.all([
    prisma.menuItem.count(),
    prisma.category.count(),
    prisma.galleryImage.count(),
    prisma.banner.count(),
    prisma.menuItem.count({ where: { isBestseller: true } }),
    prisma.menuItem.count({ where: { isAvailable: false } }),
    prisma.menuItem.findMany({
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { category: true },
    }),
  ]);

  const stats = [
    {
      label: "Menu items",
      value: itemCount,
      icon: UtensilsCrossed,
      href: "/admin/menu-items",
      tone: "accent" as const,
    },
    {
      label: "Categories",
      value: categoryCount,
      icon: FolderTree,
      href: "/admin/categories",
      tone: "default" as const,
    },
    {
      label: "Bestsellers",
      value: bestsellerCount,
      icon: Star,
      href: "/admin/menu-items?filter=bestseller",
      tone: "default" as const,
    },
    {
      label: "Sold out",
      value: unavailableCount,
      icon: EyeOff,
      href: "/admin/menu-items?filter=unavailable",
      tone: unavailableCount > 0 ? "warn" : "default",
    },
    {
      label: "Gallery",
      value: galleryCount,
      icon: ImageIcon,
      href: "/admin/gallery",
      tone: "default" as const,
    },
    {
      label: "Banners",
      value: bannerCount,
      icon: Sparkles,
      href: "/admin/banners",
      tone: "default" as const,
    },
  ];

  return (
    <div className="container-shazdeh py-10 md:py-14 space-y-12">
      <AdminPageHeader
        eyebrow="Atelier"
        title="Welcome back."
        description="Manage every plate, image and word that lives on the SHĀZDEH table."
        actions={
          <Button asChild>
            <Link href="/admin/menu-items/new">
              <Plus className="h-3.5 w-3.5" strokeWidth={1.6} /> New dish
            </Link>
          </Button>
        }
      />

      {/* Stats */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.label}
                href={stat.href}
                className="group relative overflow-hidden rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] p-5 transition-colors hover:border-terracotta/30 hover:bg-warm-white/[0.04]"
              >
                <div className="flex items-start justify-between">
                  <Icon
                    className={`h-4 w-4 ${
                      stat.tone === "accent"
                        ? "text-terracotta"
                        : stat.tone === "warn"
                          ? "text-pomegranate-red"
                          : "text-warm-white/55"
                    }`}
                    strokeWidth={1.5}
                  />
                </div>
                <p className="mt-5 font-bold text-3xl text-warm-white leading-none tabular-nums tracking-[-0.03em]">
                  {stat.value}
                </p>
                <p className="mt-3 text-[10px] tracking-[0.22em] uppercase text-warm-white/55">
                  {stat.label}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent items */}
      <section>
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-[10px] tracking-[0.32em] uppercase text-terracotta">
              Recently updated
            </p>
            <h2 className="mt-3 font-bold text-2xl md:text-3xl text-warm-white tracking-[-0.035em]">
              The latest in the kitchen
            </h2>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/menu-items">View all →</Link>
          </Button>
        </div>

        <div className="rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] overflow-hidden">
          <div className="divide-y divide-warm-white/[0.06]">
            {recentItems.map((item) => (
              <Link
                key={item.id}
                href={`/admin/menu-items/${item.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-warm-white/[0.04] transition-colors"
              >
                <div
                  className="h-12 w-12 rounded-sm bg-black-iron bg-cover bg-center shrink-0 border border-warm-white/[0.06]"
                  style={
                    item.imageUrl
                      ? { backgroundImage: `url(${item.imageUrl})` }
                      : undefined
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="text-warm-white text-[14px] truncate font-medium">
                    {item.name}
                  </p>
                  <p className="text-warm-white/55 text-[12px] truncate font-light">
                    {item.category.name} ·{" "}
                    {formatPrice(item.price, item.currency)}
                  </p>
                </div>
                <div className="hidden md:flex items-center gap-1.5">
                  {item.isSignature && (
                    <Badge variant="signature">Signature</Badge>
                  )}
                  {item.isBestseller && !item.isSignature && (
                    <Badge variant="default">Best</Badge>
                  )}
                  {item.isNew && <Badge variant="new">New</Badge>}
                  {!item.isAvailable && (
                    <Badge variant="outline">
                      <EyeOff className="h-3 w-3" strokeWidth={1.6} />
                      Off
                    </Badge>
                  )}
                </div>
                <Eye
                  className="h-3.5 w-3.5 text-warm-white/45 shrink-0"
                  strokeWidth={1.5}
                />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
