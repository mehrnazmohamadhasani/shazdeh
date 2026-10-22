"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Card, EmptyState, Select, StatTile, StatusPill, TextInput, chipButtonClass } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import { formatPhone } from "@/lib/ordering/phone";
import { cn } from "@/lib/utils";
import type { GiftStatus } from "@/lib/ordering/gift-utils";

export type GiftClaimRow = {
  id: string;
  code: string;
  name: string | null;
  phone: string;
  email: string;
  marketingOptIn: boolean;
  emailStatus: string;
  createdAt: string;
  usedAt: string | null;
  order: { id: string; number: string; totalFils: number } | null;
  status: GiftStatus;
};

const STATUS: Record<GiftStatus, { label: string; tone: "good" | "accent" | "warn" | "neutral" }> = {
  used: { label: "Redeemed", tone: "good" },
  ready: { label: "Not used yet", tone: "accent" },
  expired: { label: "Ended", tone: "neutral" },
};
const FILTERS = ["all", "used", "ready", "expired"] as const;
type Filter = (typeof FILTERS)[number];

export function GiftClaims({
  gifts,
  code,
  claims,
}: {
  gifts: { code: string; scanCount: number }[];
  code: string | null;
  claims: GiftClaimRow[];
}) {
  const { t, money, date } = useAdminI18n();
  const router = useRouter();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");

  const scans = gifts.filter((g) => !code || g.code === code).reduce((s, g) => s + g.scanCount, 0);
  const count = (s: GiftStatus) => claims.filter((c) => c.status === s).length;
  const needle = q.trim().toLowerCase();
  const shown = claims.filter(
    (c) =>
      (filter === "all" || c.status === filter) &&
      (!needle || [c.name ?? "", c.phone, c.email].some((v) => v.toLowerCase().includes(needle))),
  );

  function exportCsv() {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ["Gift", "Name", "Mobile", "Email", "Claimed", "Status", "Order", "Used", "Marketing OK"],
      ...shown.map((c) => [
        c.code,
        c.name ?? "",
        c.phone,
        c.email,
        c.createdAt.slice(0, 16).replace("T", " "),
        STATUS[c.status].label,
        c.order?.number ?? "",
        c.usedAt?.slice(0, 16).replace("T", " ") ?? "",
        c.marketingOptIn ? "yes" : "no",
      ]),
    ];
    // BOM so Excel reads names in Persian/Arabic correctly.
    const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gift-claims${code ? `-${code.toLowerCase()}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t("Scans")} value={scans} />
        <StatTile label={t("Claimed")} value={claims.length} />
        <StatTile label={t("Not used yet")} value={count("ready")} />
        <StatTile label={t("Redeemed")} value={count("used")} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {gifts.length > 1 && (
            <Select
              value={code ?? ""}
              aria-label={t("Gift")}
              className="w-auto"
              onChange={(e) => router.push(e.target.value ? `/admin/gift-claims?code=${encodeURIComponent(e.target.value)}` : "/admin/gift-claims")}
            >
              <option value="">{t("All gifts")}</option>
              {gifts.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.code}
                </option>
              ))}
            </Select>
          )}
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(chipButtonClass, filter === f && "bg-black-iron text-warm-white hover:bg-black-iron hover:text-warm-white")}
            >
              {f === "all" ? t("All") : t(STATUS[f].label)} · {f === "all" ? claims.length : count(f)}
            </button>
          ))}
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Search name, mobile or email")}
            className="min-w-[12rem] flex-1"
            dir="auto"
          />
          <button type="button" onClick={exportCsv} disabled={shown.length === 0} className={chipButtonClass}>
            <Download className="h-3.5 w-3.5" /> {t("Download (Excel)")}
          </button>
        </div>
      </Card>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            title={claims.length === 0 ? t("No gift claims yet") : t("Nothing matches")}
            description={claims.length === 0 ? t("When a customer scans a gift card and leaves their details, they show up here.") : undefined}
          />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[16px] border border-black-iron/[0.07] bg-white">
          <table className="w-full text-start text-[13px]">
            <thead className="border-b border-black-iron/[0.08] text-[10px] uppercase tracking-[0.2em] text-dark-grey">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("Customer")}</th>
                <th className="px-4 py-3 text-start font-medium max-lg:hidden">{t("Email")}</th>
                <th className="px-4 py-3 text-start font-medium max-md:hidden">{t("Claimed")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("Status")}</th>
                <th className="px-4 py-3 text-end font-medium max-sm:hidden">{t("Order")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black-iron/[0.06]">
              {shown.map((c) => (
                <tr key={c.id} className="align-top hover:bg-black-iron/[0.03]">
                  <td className="px-4 py-3">
                    <span dir="auto" className="block font-medium text-black-iron">
                      {c.name || "—"}
                      {!code && gifts.length > 1 && <span className="ms-2 font-mono text-[11px] text-dark-grey">{c.code}</span>}
                    </span>
                    <a href={`tel:${c.phone}`} dir="ltr" className="admin-link tabular-nums text-black-iron/80 hover:text-terracotta-ink">
                      {formatPhone(c.phone)}
                    </a>
                    <span className="block break-all text-dark-grey lg:hidden" dir="ltr">
                      {c.email}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-lg:hidden" dir="ltr">
                    <a href={`mailto:${c.email}`} className="admin-link break-all text-black-iron/80 hover:text-terracotta-ink">
                      {c.email}
                    </a>
                    {c.emailStatus !== "sent" && (
                      <span className="mt-1 block">
                        <StatusPill tone="warn">{c.emailStatus === "failed" ? t("Email failed") : t("Email not sent")}</StatusPill>
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-dark-grey max-md:hidden">
                    {date(c.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={STATUS[c.status].tone}>{t(STATUS[c.status].label)}</StatusPill>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end tabular-nums max-sm:hidden">
                    {c.order ? (
                      <Link href={`/admin/orders/${c.order.id}`} className="admin-link font-semibold text-black-iron hover:text-terracotta-ink">
                        {c.order.number}
                      </Link>
                    ) : (
                      <span className="text-dark-grey">—</span>
                    )}
                    {c.order && <span className="block text-dark-grey">{money(c.order.totalFils)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
