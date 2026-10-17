import Link from "next/link";
import { Info } from "lucide-react";
import { AdminPage, Card, EmptyState } from "@/components/admin/ui";
import { DayPicker } from "@/components/admin/today/day-picker";
import { FreeFoodActions, FreeFoodForm } from "@/components/admin/ops/free-food-form";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { getFreeFoodForEdit, listFreeFood } from "@/lib/ops/free-food";
import { FREE_FOOD_LABEL, summariseFreeFood, type FreeFoodKind } from "@/lib/ops/free-food-shared";
import { dubaiToday, pickDay } from "@/lib/ops/today";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Free food") };
}

/** Staff meals, gifts, tastings and compensation: what left the kitchen without a sale, and what it cost. */
export default async function FreeFoodPage({ searchParams }: { searchParams: Promise<{ day?: string; edit?: string }> }) {
  const { t, money, date, locale } = await getAdminI18n();
  const { day: asked, edit } = await searchParams;
  // One Dubai day at a time (today unless another is picked).
  const today = dubaiToday();
  const day = pickDay(asked);
  const start = new Date(`${day}T00:00:00+04:00`);
  const end = new Date(start.getTime() + 86_400_000);
  const [rows, menu, editing] = await Promise.all([
    listFreeFood(start, end),
    prisma.menuItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
      select: { id: true, name: true, nameFa: true, category: { select: { name: true } } },
    }),
    edit ? getFreeFoodForEdit(edit.slice(0, 40)) : Promise.resolve(null),
  ]);
  const summary = summariseFreeFood(
    rows.map((r) => ({ kind: r.kind as FreeFoodKind, costFils: r.costFils, menuValueFils: r.menuValueFils, portions: r.items.reduce((s, i) => s + i.quantity, 0) })),
  );
  // Dishes on this month's records whose cost couldn't be worked out, by name.
  const missing = [
    ...new Set(rows.flatMap((r) => r.items.filter((i) => i.unitCostFils == null).map((i) => (locale === "fa" && i.menuItem?.nameFa ? i.menuItem.nameFa : i.name)))),
  ];
  const listHref = `/admin/ops/free-food${day !== today ? `?day=${day}` : ""}`;
  const editHref = (id: string) => `/admin/ops/free-food?${day !== today ? `day=${day}&` : ""}edit=${id}`;

  return (
    <AdminPage
      title={t("Free food")}
      description={t("Staff meals, gifts, tastings and compensation: dishes that leave the kitchen without a sale. Their ingredients come out of stock by the recipes, and the cost is kept as it was that day.")}
      className="max-w-4xl"
    >
      <Card title={editing ? t("Edit free food") : t("Add free food")}>
        <FreeFoodForm
          key={editing?.id ?? `new-${day}`}
          dishes={menu.map((m) => ({ id: m.id, name: m.name, nameFa: m.nameFa, category: m.category.name }))}
          today={today}
          defaultDay={day}
          editing={editing}
          doneHref={listHref}
        />
      </Card>

      <Card title={<DayPicker day={day} today={today} path="/admin/ops/free-food" />} bodyClassName="p-0">
        {rows.length > 0 && (
          <div className="grid grid-cols-2 gap-3 border-b border-black-iron/[0.06] p-4 sm:grid-cols-4 md:px-6">
            {summary.byKind.map((k) => (
              <div key={k.kind} className="rounded-[12px] bg-black-iron/[0.03] px-3 py-2.5">
                <p className="text-[12.5px] font-medium text-dark-grey">{t(FREE_FOOD_LABEL[k.kind])}</p>
                <p className="text-[18px] font-semibold tabular-nums text-black-iron">{t(k.portions === 1 ? "{n} portion" : "{n} portions", { n: k.portions })}</p>
                <p className="mt-0.5 text-[12px] text-dark-grey">{t("Menu value {amount}", { amount: money(k.menuValueFils) })}</p>
                <p className="text-[12px] text-dark-grey">{k.costFils != null ? t("Food cost {amount}", { amount: money(k.costFils) }) : t("Food cost not known yet")}</p>
              </div>
            ))}
          </div>
        )}
        {missing.length > 0 && (
          // Name the dishes that have no cost and say how to fix it — not a bare "unknown".
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-black-iron/[0.06] bg-saffron-orange/[0.07] px-4 py-3 text-[13.5px] md:px-6">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-cinnamon-bark" />
            <div className="min-w-0 flex-1 text-black-iron">
              <p className="font-medium">{t("Food cost isn't known yet for: {dishes}", { dishes: missing.join(", ") })}</p>
              <p className="mt-0.5 text-[12.5px] text-dark-grey">{t("To see what they cost, each needs an approved recipe whose ingredients have a purchase price.")}</p>
            </div>
            <Link
              href="/admin/ops/recipes"
              className="inline-flex h-9 shrink-0 items-center rounded-full border border-black-iron/[0.15] bg-white px-4 text-[13px] font-medium text-black-iron hover:border-terracotta"
            >
              {t("Open Recipes")}
            </Link>
          </div>
        )}
        {rows.length === 0 ? (
          <EmptyState title={day === today ? t("No free food recorded today") : t("No free food recorded on this day")} />
        ) : (
          <ul className="divide-y divide-black-iron/[0.06]">
            {rows.map((r) => (
              <li key={r.id} className={editing?.id === r.id ? "bg-terracotta/[0.05] px-4 py-3 md:px-6" : "px-4 py-3 md:px-6"}>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-medium text-black-iron">
                      {t(FREE_FOOD_LABEL[r.kind as FreeFoodKind])}
                      {r.recipient ? ` · ${r.recipient}` : ""}
                    </p>
                    <p className="text-[13px] text-dark-grey">
                      {r.items.map((i) => `${i.quantity}× ${locale === "fa" && i.menuItem?.nameFa ? i.menuItem.nameFa : i.name}`).join(" · ")}
                    </p>
                    <p className="text-[12px] text-dark-grey">
                      {date(r.at, { hour: "2-digit", minute: "2-digit" })}
                      {r.reason ? ` · ${r.reason}` : ""}
                      {r.via !== "manual" ? ` · ${t(r.via === "voice" ? "by voice" : "by chat")}` : ""}
                    </p>
                  </div>
                  <div className="text-end text-[12.5px] text-dark-grey">
                    <p>
                      {t("Menu price")} <span className="font-semibold tabular-nums text-black-iron">{money(r.menuValueFils)}</span>
                    </p>
                    <p>
                      {r.costFils != null ? (
                        <>
                          {t("Food cost")} <span className="font-semibold tabular-nums text-black-iron">{money(r.costFils)}</span>
                        </>
                      ) : (
                        t("Food cost not known yet")
                      )}
                    </p>
                    <div className="mt-1">
                      <FreeFoodActions id={r.id} editHref={editHref(r.id)} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminPage>
  );
}
