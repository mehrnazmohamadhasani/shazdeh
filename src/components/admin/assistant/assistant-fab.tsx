"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminI18n } from "@/components/admin/i18n";
import { ASSISTANT_ROLES } from "@/lib/ops/assistant/types";

/*
 * The round mic button that opens the assistant from the main kitchen
 * screens (bottom corner, under the thumb; mirrored in Persian). Only on
 * list screens, so it never covers a form's save bar; on Today's phone
 * layout it sits above the Add bar.
 */
const SCREENS = ["/admin", "/admin/ops/stock", "/admin/ops/invoices", "/admin/ops/recipes", "/admin/ops/suppliers", "/admin/ops/sales"];

export function AssistantFab({ role }: { role: string }) {
  const pathname = usePathname();
  const { t } = useAdminI18n();
  if (!(ASSISTANT_ROLES as readonly string[]).includes(role) || !SCREENS.includes(pathname)) return null;
  return (
    <Link
      href="/admin/ops/assistant"
      aria-label={t("Assistant")}
      title={t("Assistant")}
      className={cn(
        "fixed end-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-terracotta text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform hover:scale-105 active:scale-95 print:hidden",
        pathname === "/admin" ? "bottom-[calc(6.5rem+var(--safe-bottom))] lg:bottom-6" : "bottom-[max(1.25rem,var(--safe-bottom))]",
      )}
    >
      <Mic className="h-6 w-6" />
    </Link>
  );
}
