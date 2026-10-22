"use client";
import * as React from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Card, EmptyState, StatTile, StatusPill, TextInput, chipButtonClass } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import { formatPhone } from "@/lib/ordering/phone";
import { cn } from "@/lib/utils";
import { matchesFilter, type CustomerFilter, type CustomerListRow } from "@/lib/ordering/customer-list";

const FILTERS: { key: CustomerFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "marketing", label: "OK to send offers" },
  { key: "lapsed", label: "No order in 30+ days" },
  { key: "gift_no_order", label: "Gift claimed, never ordered" },
];
// Rendering thousands of rows is slow on a tablet; the download always has them all.
const SHOWN = 300;

export function CustomersList({ rows }: { rows: CustomerListRow[] }) {
  const { t, money, date } = useAdminI18n();
  const [filter, setFilter] = React.useState<CustomerFilter>("all");
  const [q, setQ] = React.useState("");
  const [now] = React.useState(() => new Date());

  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const shown = rows.filter(
    (r) =>
      matchesFilter(r, filter, now) &&
      (!needle ||
        (r.name ?? "").toLowerCase().includes(needle) ||
        (r.email ?? "").toLowerCase().includes(needle) ||
        (digits.length >= 3 && r.phone.includes(digits))),
  );
  const count = (f: CustomerFilter) => rows.filter((r) => matchesFilter(r, f, now)).length;

  function exportCsv() {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      ["Name", "Mobile", "Email", "Orders", "Total spent (AED)", "Last order", "Gift", "Gift codes", "OK to send offers", "First seen"],
      ...shown.map((r) => [
        r.name ?? "",
        r.phone,
        r.email ?? "",
        String(r.orders),
        (r.spentFils / 100).toFixed(2),
        r.lastOrderAt?.slice(0, 10) ?? "",
        r.gift === "none" ? "" : r.gift,
        r.giftCodes.join(" "),
        r.marketingOk ? "yes" : "no",
        r.firstSeenAt.slice(0, 10),
      ]),
    ];
    // BOM so Excel reads Persian/Arabic names correctly.
    const blob = new Blob(["﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shazdeh-customers-${filter}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t("Customers")} value={rows.length} />
        <StatTile label={t("OK to send offers")} value={count("marketing")} />
        <StatTile label={t("No order in 30+ days")} value={count("lapsed")} />
        <StatTile label={t("Gift claimed, never ordered")} value={count("gift_no_order")} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(chipButtonClass, filter === f.key && "bg-black-iron text-warm-white hover:bg-black-iron hover:text-warm-white")}
            >
              {t(f.label)} · {count(f.key)}
            </button>
          ))}
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search name, mobile or email")} className="min-w-[12rem] flex-1" dir="auto" />
          <button type="button" onClick={exportCsv} disabled={shown.length === 0} className={chipButtonClass}>
            <Download className="h-3.5 w-3.5" /> {t("Download (Excel)")}
          </button>
        </div>
        {filter === "marketing" && (
          <p className="mt-3 text-[12.5px] text-dark-grey">
            {t("Only these customers agreed to receive news and offers. Send promotions to them only, with a way to unsubscribe.")}
          </p>
        )}
      </Card>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            title={rows.length === 0 ? t("No customers yet") : t("Nothing matches")}
            description={rows.length === 0 ? t("Customers appear here after their first website order or gift claim.") : undefined}
          />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[16px] border border-black-iron/[0.07] bg-white">
          <table className="w-full text-start text-[13px]">
            <thead className="border-b border-black-iron/[0.08] text-[10px] uppercase tracking-[0.2em] text-dark-grey">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("Customer")}</th>
                <th className="px-4 py-3 text-start font-medium max-lg:hidden">{t("Email")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("Orders")}</th>
                <th className="px-4 py-3 text-end font-medium max-sm:hidden">{t("Total spent")}</th>
                <th className="px-4 py-3 text-start font-medium max-md:hidden">{t("Last order")}</th>
                <th className="px-4 py-3 text-start font-medium max-md:hidden">{t("Gift")}</th>
                <th className="px-4 py-3 text-start font-medium max-sm:hidden">{t("Offers")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black-iron/[0.06]">
              {shown.slice(0, SHOWN).map((r) => (
                <tr key={r.phone} className="align-top hover:bg-black-iron/[0.03]">
                  <td className="px-4 py-3">
                    <span dir="auto" className="block font-medium text-black-iron">
                      {r.name || "—"}
                    </span>
                    <a href={`tel:${r.phone}`} dir="ltr" className="admin-link tabular-nums text-black-iron/80 hover:text-terracotta-ink">
                      {formatPhone(r.phone)}
                    </a>
                    {r.email && (
                      <span className="block break-all text-dark-grey lg:hidden" dir="ltr">
                        {r.email}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-lg:hidden" dir="ltr">
                    {r.email ? (
                      <a href={`mailto:${r.email}`} className="admin-link break-all text-black-iron/80 hover:text-terracotta-ink">
                        {r.email}
                      </a>
                    ) : (
                      <span className="text-dark-grey">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">{r.orders}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-end tabular-nums max-sm:hidden">{r.orders ? money(r.spentFils) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-dark-grey max-md:hidden">
                    {r.lastOrderAt && r.lastOrderId ? (
                      <Link href={`/admin/orders/${r.lastOrderId}`} className="admin-link hover:text-terracotta-ink">
                        {date(r.lastOrderAt, { dateStyle: "medium" })}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 max-md:hidden">
                    {r.gift === "none" ? (
                      <span className="text-dark-grey">—</span>
                    ) : (
                      <StatusPill tone={r.gift === "used" ? "good" : "accent"}>
                        {r.gift === "used" ? t("Redeemed") : t("Claimed")} · <span className="font-mono">{r.giftCodes.join(", ")}</span>
                      </StatusPill>
                    )}
                  </td>
                  <td className="px-4 py-3 max-sm:hidden">
                    {r.marketingOk ? <StatusPill tone="good">{t("Yes")}</StatusPill> : <span className="text-dark-grey">{t("No")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > SHOWN && (
            <p className="border-t border-black-iron/[0.06] px-4 py-3 text-[12.5px] text-dark-grey">
              {t("Showing {n} of {total}. Search, or download the list to see everyone.", { n: SHOWN, total: shown.length })}
            </p>
          )}
        </div>
      )}
    </>
  );
}
