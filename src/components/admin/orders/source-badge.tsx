"use client";
import { MessageCircle, Phone } from "lucide-react";
import { useAdminI18n } from "@/components/admin/i18n";

export type OrderSourceValue = "WEBSITE" | "WHATSAPP" | "PHONE";

/** Where an order came from; website orders (the usual case) show nothing. */
export function SourceBadge({ source }: { source: OrderSourceValue }) {
  const { t } = useAdminI18n();
  if (source === "WEBSITE") return null;
  const Icon = source === "WHATSAPP" ? MessageCircle : Phone;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-olive-leaf/[0.12] px-2.5 py-1 text-[11px] font-medium text-olive-leaf">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {source === "WHATSAPP" ? t("WhatsApp") : t("Phone call")}
    </span>
  );
}
