import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AdminPage, Card, StatusPill } from "@/components/admin/ui";
import { AddSheet } from "@/components/admin/today/add-sheet";
import { DayPicker } from "@/components/admin/today/day-picker";
import { UNIT, amountText } from "@/components/admin/ops/format";
import { requireAdmin } from "@/lib/auth";
import { CMS_ROLES } from "@/lib/api";
import { dubaiToday, pickDay, todaySummary, type TodaySummary } from "@/lib/ops/today";
import type { ProfitGap } from "@/lib/ops/profit";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import type { AdminI18n } from "@/lib/admin-i18n";
import { cn } from "@/lib/utils";

/*
 * Today: the owner's first screen, built for a phone held in one hand.
 * Sales by channel, an estimated profit that says what it covers, what
 * needs attention, and one big Add button at the bottom.
 */

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Today") };
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const [i18n, user, { day: asked }] = await Promise.all([getAdminI18n(), requireAdmin(), searchParams]);
  const { t, date } = i18n;
  const summary = await todaySummary(pickDay(asked));
  const noon = `${summary.day}T12:00:00+04:00`;

  return (
    <AdminPage
      title={summary.isToday ? t("Today") : date(noon, { weekday: "long" })}
      description={date(noon, { weekday: summary.isToday ? "long" : undefined, day: "numeric", month: "long", year: "numeric" })}
      actions={<AddSheet canAddRecipes={CMS_ROLES.includes(user.role)} />}
      className="pb-32 lg:pb-10"
    >
      <div className="-mt-2">
        <DayPicker day={summary.day} today={dubaiToday()} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="space-y-4 lg:space-y-6">
          <SalesCard summary={summary} i18n={i18n} />
          <ProfitCard summary={summary} i18n={i18n} />
        </div>
        <AlertsCard alerts={summary.alerts} i18n={i18n} />
      </div>
    </AdminPage>
  );
}

function SalesCard({ summary, i18n }: { summary: TodaySummary; i18n: AdminI18n }) {
  const { t, money } = i18n;
  const orders = (n: number) => (n === 1 ? t("1 order") : t("{n} orders", { n }));
  const { profit, byChannel } = summary;
  return (
    <Card bodyClassName="p-0 md:p-0">
      <Link href="/admin/ops/sales" className="block px-5 pb-4 pt-5 md:px-6">
        <p className="text-[13px] font-medium text-dark-grey">{t("Food sales")}</p>
        <p className="mt-1 text-[34px] font-bold leading-none tabular-nums tracking-[-0.03em]">{money(profit.salesFils)}</p>
        <p className="mt-2 text-[13px] text-dark-grey">
          {orders(profit.orders)} · {t("with VAT, without customer delivery and service fees")}
        </p>
      </Link>
      <ul className="divide-y divide-black-iron/[0.06] border-t border-black-iron/[0.06] text-[15px]">
        {/* The website always shows; WhatsApp, phone and each platform only on a day they sold. */}
        {byChannel.filter((c) => c.code === "direct" || c.orders > 0).map((c) => (
          <li key={c.code} className={cn("flex min-h-12 items-center gap-3 px-5 py-2.5 md:px-6", c.orders === 0 && "text-dark-grey")}>
            <span className="min-w-0 flex-1 truncate">{t(c.name)}</span>
            <span className="text-[13px] tabular-nums text-dark-grey">{orders(c.orders)}</span>
            <span className="w-28 text-end font-semibold tabular-nums">{money(c.foodSalesFils)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ProfitCard({ summary, i18n }: { summary: TodaySummary; i18n: AdminI18n }) {
  const { t, money } = i18n;
  const { covered, salesFils, orders, gaps } = summary.profit;
  const unknown = orders > 0 && covered.orders === 0;
  const complete = orders > 0 && covered.orders === orders;
  return (
    <Card bodyClassName="p-0 md:p-0">
      <div className="px-5 pb-4 pt-5 md:px-6">
        <p className="flex items-center gap-2 text-[13px] font-medium text-dark-grey">
          {t("Profit")}
          <StatusPill tone="warn">{t("Estimated")}</StatusPill>
        </p>
        <p className={cn("mt-2 text-[34px] font-bold leading-none tabular-nums tracking-[-0.03em]", (unknown || orders === 0) && "text-dark-grey")}>
          {orders === 0 ? "—" : unknown ? t("Unknown") : money(covered.profitFils)}
        </p>
        <p className="mt-2 text-[13px] text-dark-grey">
          {orders === 0
            ? t("No sales yet.")
            : unknown
              ? t("No order can be estimated yet — see why below.")
              : complete
                ? t("Covers all {n} orders.", { n: orders })
                : t("Covers {covered} of {total} food sales ({n} of {m} orders).", {
                    covered: money(covered.salesFils),
                    total: money(salesFils),
                    n: covered.orders,
                    m: orders,
                  })}
        </p>
      </div>

      {covered.orders > 0 && (
        <dl className="space-y-1.5 border-t border-black-iron/[0.06] px-5 py-3.5 text-[14px] md:px-6">
          <Line label={t("Sales without VAT")} value={money(covered.salesExVatFils)} />
          <Line label={t("Food cost (approved recipes)")} value={`− ${money(covered.foodCostFils)}`} />
          <Line label={t("Platform fees (fee rules)")} value={`− ${money(covered.feesFils)}`} />
        </dl>
      )}

      {gaps.length > 0 && (
        <div className="border-t border-black-iron/[0.06] px-5 py-3.5 md:px-6">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-dark-grey">{t("Not in the estimate")}</p>
          <ul className="mt-1">
            {gaps.slice(0, 6).map((g, i) => (
              <li key={i}>
                <GapRow gap={g} i18n={i18n} channelName={(code) => summary.byChannel.find((c) => c.code === code)?.name ?? code} />
              </li>
            ))}
          </ul>
          {gaps.length > 6 && <p className="pt-1 text-[13px] text-dark-grey">{t("…and {n} more", { n: gaps.length - 6 })}</p>}
        </div>
      )}

      <p className="border-t border-black-iron/[0.06] px-5 py-3 text-[12.5px] leading-relaxed text-dark-grey md:px-6">
        {t(
          summary.foodCostIncludesVat
            ? "Food cost is what the approved recipes should use, at the latest prices with VAT. Menu prices are taken to include 5% VAT."
            : "Food cost is what the approved recipes should use, at the latest prices without VAT. Menu prices are taken to include 5% VAT.",
        )}
      </p>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-dark-grey">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

const DISH_REASON = {
  no_recipe: "no recipe",
  not_approved: "recipe not approved",
  prep_not_approved: "a prep in it is not approved",
  no_price: "an ingredient has no price",
  not_matched: "not matched to a dish",
} as const;

function GapRow({ gap, i18n, channelName }: { gap: ProfitGap; i18n: AdminI18n; channelName: (code: string) => string }) {
  const { t, money } = i18n;
  const row = "flex min-h-11 items-center gap-2 py-1.5 text-[14px]";
  if (gap.kind === "fees_unknown") {
    return (
      <Link href="/admin/ops/channels" className={row}>
        <span className="min-w-0 flex-1">
          {t("{channel}: fees unknown — no fee rule", { channel: channelName(gap.channel) })}
          <span className="block text-[12.5px] text-dark-grey">{gap.orders === 1 ? t("1 order · {amount}", { amount: money(gap.salesFils) }) : t("{n} orders · {amount}", { n: gap.orders, amount: money(gap.salesFils) })}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-dark-grey rtl:-scale-x-100" />
      </Link>
    );
  }
  if (gap.kind === "no_dishes") {
    return (
      <Link href="/admin/ops/sales" className={row}>
        <span className="min-w-0 flex-1">{t("{channel}: {n} receipts with no dishes read", { channel: channelName(gap.channel), n: gap.orders })}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-dark-grey rtl:-scale-x-100" />
      </Link>
    );
  }
  return (
    <Link href={gap.reason === "not_matched" ? "/admin/ops/sales" : "/admin/ops/recipes"} className={row}>
      <span className="min-w-0 flex-1">
        <span dir="auto">{gap.name}</span> <span className="tabular-nums text-dark-grey">×{gap.quantity}</span>
        <span className="block text-[12.5px] text-dark-grey">{t(DISH_REASON[gap.reason])}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-dark-grey rtl:-scale-x-100" />
    </Link>
  );
}

type Alert = { href: string; label: string; value?: string; note?: string; tone: "bad" | "warn" | "accent" };

function AlertsCard({ alerts: a, i18n }: { alerts: TodaySummary["alerts"]; i18n: AdminI18n }) {
  const { t, money, locale } = i18n;
  const name = (i: { name: string; nameFa: string | null }) => (locale === "fa" ? (i.nameFa ?? i.name) : i.name);
  const list = (rows: { name: string; nameFa: string | null }[]) =>
    rows.slice(0, 3).map(name).join(", ") + (rows.length > 3 ? ` ${t("+{n} more", { n: rows.length - 3 })}` : "");
  const usd = (n: number) => `US$ ${n.toFixed(2)}`;
  const invoices = (n: number) => (n === 1 ? t("1 invoice") : t("{n} invoices", { n }));

  const alerts: Alert[] = [];
  if (a.ordersWaiting) alerts.push({ href: "/admin/orders", label: t("Website orders waiting to accept"), value: String(a.ordersWaiting), tone: "accent" });
  if (a.ai.level === "reached")
    alerts.push({ href: "/admin/ops/settings", label: t("AI limit reached — photos are not read"), note: t("{spent} of {cap} this month", { spent: usd(a.ai.spentUsd), cap: usd(a.ai.capUsd) }), tone: "bad" });
  if (a.credit.overdue.count)
    alerts.push({ href: "/admin/ops/payables", label: t("Credit invoices overdue"), value: money(a.credit.overdue.fils), note: invoices(a.credit.overdue.count), tone: "bad" });
  if (a.stock.negative.length)
    alerts.push({ href: "/admin/ops/stock", label: t("Stock below zero — count needed"), value: String(a.stock.negative.length), note: list(a.stock.negative), tone: "bad" });
  if (a.receiptsToCheck) alerts.push({ href: "/admin/ops/sales", label: t("Platform receipts to check"), value: String(a.receiptsToCheck), tone: "accent" });
  if (a.invoicesToCheck) alerts.push({ href: "/admin/ops/invoices", label: t("Invoices to check"), value: String(a.invoicesToCheck), tone: "accent" });
  if (a.recipePhotosToCheck) alerts.push({ href: "/admin/ops/recipes", label: t("Recipe photos to check"), value: String(a.recipePhotosToCheck), tone: "accent" });
  if (a.credit.soon.count)
    alerts.push({ href: "/admin/ops/payables", label: t("Credit invoices due in 3 days"), value: money(a.credit.soon.fils), note: invoices(a.credit.soon.count), tone: "warn" });
  if (a.stock.low.length)
    alerts.push({
      href: "/admin/ops/stock",
      label: t("Low stock"),
      value: String(a.stock.low.length),
      note: a.stock.low
        .slice(0, 3)
        .map((i) => `${name(i)} ${amountText(i.onHand, UNIT[i.unit], locale)}`)
        .join(" · ") + (a.stock.low.length > 3 ? ` ${t("+{n} more", { n: a.stock.low.length - 3 })}` : ""),
      tone: "warn",
    });
  if (a.ai.level === "near")
    alerts.push({ href: "/admin/ops/settings", label: t("AI limit nearly used"), note: t("{spent} of {cap} this month", { spent: usd(a.ai.spentUsd), cap: usd(a.ai.capUsd) }), tone: "warn" });

  const dot = { bad: "bg-pomegranate-red", warn: "bg-saffron-orange", accent: "bg-terracotta" };
  const value = { bad: "text-pomegranate-red", warn: "text-cinnamon-bark", accent: "text-terracotta-ink" };

  return (
    <Card title={t("Needs attention")} description={t("Right now")} bodyClassName="p-0 md:p-0" className="self-start">
      {alerts.length === 0 ? (
        <p className="flex items-center gap-3 px-5 py-6 text-[15px] text-olive-leaf md:px-6">
          <CheckCircle2 className="h-6 w-6" strokeWidth={1.7} />
          {t("All clear")}
        </p>
      ) : (
        <ul className="divide-y divide-black-iron/[0.06]">
          {alerts.map((al) => (
            <li key={al.label}>
              <Link href={al.href} className="flex min-h-14 items-center gap-3 px-5 py-3 active:bg-black-iron/[0.03] md:px-6">
                <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dot[al.tone])} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{al.label}</span>
                  {al.note && (
                    <span dir="auto" className="block truncate text-[12.5px] text-dark-grey">
                      {al.note}
                    </span>
                  )}
                </span>
                {al.value && <span className={cn("shrink-0 text-[15px] font-semibold tabular-nums", value[al.tone])}>{al.value}</span>}
                <ArrowRight className="h-4 w-4 shrink-0 text-dark-grey rtl:-scale-x-100" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
