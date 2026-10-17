import { AdminPage, Card, EmptyState, StatusPill } from "@/components/admin/ui";
import { DeleteFeeRuleButton, FeeRuleForm } from "@/components/admin/ops/platform-forms";
import { day } from "@/components/admin/ops/format";
import { requireAdmin } from "@/lib/auth";
import { channelsWithRules } from "@/lib/ops/sales";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Channels & fees") };
}

export default async function ChannelsPage() {
  const { t, money, number, intl } = await getAdminI18n();
  const [user, channels] = await Promise.all([requireAdmin(), channelsWithRules()]);
  const isAdmin = user.role === "ADMIN";
  return (
    <AdminPage
      title={t("Channels & fees")}
      description={t("Each platform's fees from its contract or statement. Receipts don't show commission, so without fee terms a platform's fees stay “unknown” — nothing is guessed.")}
    >
      {channels.map((c) => (
        <Card
          key={c.id}
          title={
            <span className="flex flex-wrap items-center gap-2">
              {t(c.name)}
              <StatusPill tone="neutral">{t(c.kind === "DIRECT" ? (c.code === "direct" ? "Own website" : "Direct order") : "Delivery platform")}</StatusPill>
              {/* Platform receipts only; direct orders are counted in Sales. */}
              {c.kind !== "DIRECT" && (
                <span className="text-[12.5px] font-normal text-dark-grey">{t(c._count.orders === 1 ? "{n} order recorded" : "{n} orders recorded", { n: c._count.orders })}</span>
              )}
            </span>
          }
        >
          {c.kind === "DIRECT" ? (
            <p className="text-[14px] text-dark-grey">
              {t(
                c.code === "whatsapp"
                  ? "Orders a customer sends on WhatsApp, entered by staff (New order), or placed from the WhatsApp link shazdeh.ae/order?src=whatsapp. No platform commission."
                  : c.code === "phone"
                    ? "Orders taken by phone and entered by staff (New order). No platform commission."
                    : "Website orders pay no platform commission; card fees come with payment settlements later.",
              )}
            </p>
          ) : (
            <div className="space-y-3">
              {c.feeRules.length === 0 ? (
                <EmptyState title={t("No fee terms yet")} description={t("Add them from the contract or a monthly statement.")} />
              ) : (
                <ul className="divide-y divide-black-iron/[0.06] rounded-[12px] border border-black-iron/[0.06] text-[14px]">
                  {c.feeRules.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{t("From {date}", { date: day(r.validFrom, true, intl) })}</span>
                        <span className="block text-[12.5px] text-dark-grey">
                          {[
                            r.commissionPct != null ? t("commission {pct}%", { pct: number(r.commissionPct, { max: 2 }) }) : null,
                            r.paymentFeePct != null ? t("payment {pct}%", { pct: number(r.paymentFeePct, { max: 2 }) }) : null,
                            r.fixedFeeFils != null ? t("{amount} per order", { amount: money(r.fixedFeeFils) }) : null,
                            r.vatOnFees ? t("+ 5 % VAT") : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          {r.note ? (
                            <>
                              {" · "}
                              <span dir="auto">{r.note}</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                      {isAdmin && <DeleteFeeRuleButton ruleId={r.id} />}
                    </li>
                  ))}
                </ul>
              )}
              {isAdmin ? <FeeRuleForm channelId={c.id} /> : <p className="text-[12.5px] text-dark-grey">{t("Only an admin can change fee terms.")}</p>}
            </div>
          )}
        </Card>
      ))}
    </AdminPage>
  );
}
