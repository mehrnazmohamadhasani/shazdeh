import { AdminPage, Card, StatusPill } from "@/components/admin/ui";
import { OpsSettingsForm, VatExportForm } from "@/components/admin/ops/purchasing-forms";
import { requireAdmin } from "@/lib/auth";
import { aiSpendThisMonth } from "@/lib/ops/ai-usage";
import { getOpsSettings } from "@/lib/ops/settings";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Kitchen settings") };
}

export default async function OpsSettingsPage() {
  const { t, number } = await getAdminI18n();
  const [user, settings, spent] = await Promise.all([requireAdmin(), getOpsSettings(), aiSpendThisMonth()]);
  const cap = settings.aiMonthlyCapUsd;
  const pct = cap > 0 ? Math.min(100, (spent.usd / cap) * 100) : 100;
  const usd = (v: number) => `US$ ${number(v, { min: 2, max: 2 })}`;
  return (
    <AdminPage title={t("Kitchen settings")} description={t("How food cost is worked out, the AI spending limit, and the VAT report for the accountant.")}>
      <Card title={t("AI reading this month")}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[24px] font-bold tabular-nums">{usd(spent.usd)}</p>
          <p className="text-[13px] text-dark-grey">
            {t("of {cap} · {n} readings", { cap: usd(cap), n: spent.calls })}
          </p>
          {spent.usd >= cap ? (
            <StatusPill tone="bad">{t("Limit reached — reading is paused")}</StatusPill>
          ) : pct >= 80 ? (
            <StatusPill tone="warn">{t("Over 80 % used")}</StatusPill>
          ) : null}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black-iron/[0.08]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full ${pct >= 100 ? "bg-pomegranate-red" : pct >= 80 ? "bg-saffron-orange" : "bg-black-iron"}`} style={{ width: `${pct}%` }} />
        </div>
      </Card>

      <Card title={t("Settings")}>
        {user.role === "ADMIN" ? (
          <OpsSettingsForm
            initial={{
              foodCostIncludesVat: settings.foodCostIncludesVat,
              aiMonthlyCapUsd: cap,
              autoSavePlatform: settings.autoSavePlatform,
              autoSaveInvoices: settings.autoSaveInvoices,
            }}
          />
        ) : (
          <ul className="space-y-1 text-[14px]">
            <li>{t(settings.foodCostIncludesVat ? "Food cost includes VAT" : "Food cost without VAT")}</li>
            <li>{t("Monthly AI limit: {cap}", { cap: usd(cap) })}</li>
            <li className="text-[12.5px] text-dark-grey">{t("Only an admin can change these.")}</li>
          </ul>
        )}
      </Card>

      <Card title={t("Purchase VAT for the accountant")} description={t("Every saved invoice in the period: supplier TRN, net, VAT and total, with anything to check. Excel file.")}>
        <VatExportForm />
      </Card>
    </AdminPage>
  );
}
