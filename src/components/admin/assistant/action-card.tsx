"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Check, Loader2, Mic, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";
import { amountText, UNIT } from "@/components/admin/ops/format";
import { messageFromUnknown } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import type { ActionCard, CountPreview, FreeFoodPreview, InvoicePreview, NewRecipePreview, Preview, RecipePreview, StockPreview } from "@/lib/ops/assistant/types";
import { FREE_FOOD_LABEL } from "@/lib/ops/free-food-shared";

/*
 * One change the assistant suggested: what it would do (before → after),
 * then Confirm or Cancel. Sensitive changes (money, recipes, big count
 * differences) ask a second time. An applied change can be deleted for a
 * day (the stock, recipe or invoice goes back to how it was).
 */

type I18n = ReturnType<typeof useAdminI18n>;

function nameOf(item: { name: string; nameFa: string | null }, locale: string) {
  return locale === "fa" && item.nameFa ? item.nameFa : item.name;
}

function BeforeAfter({ before, after, tone }: { before: React.ReactNode; after: React.ReactNode; tone?: "bad" | "good" }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {/* Numbers stay left-to-right inside Persian text, so a negative reads "−500", not "500-". */}
      <bdi dir="ltr" className="text-dark-grey line-through decoration-black-iron/25">
        {before}
      </bdi>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-dark-grey rtl:rotate-180" aria-hidden />
      <bdi dir="ltr" className={cn("font-semibold", tone === "bad" ? "text-pomegranate-red" : tone === "good" ? "text-olive-leaf" : "text-black-iron")}>
        {after}
      </bdi>
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-[14px]">
      <span className="shrink-0 text-dark-grey">{label}</span>
      <span className="min-w-0 text-end">{children}</span>
    </div>
  );
}

/** A value at the last price, labelled estimated; `signed` shows +/− (kept left-to-right so Persian reads "−45", not "45-"). */
function valueText(fils: number | null, i18n: I18n, signed = false) {
  if (fils == null) return i18n.t("Unknown");
  const amount = signed ? `${fils < 0 ? "−" : "+"}${i18n.money(Math.abs(fils))}` : i18n.money(fils);
  return (
    <>
      <bdi dir="ltr">{amount}</bdi> · {i18n.t("estimated")}
    </>
  );
}

function StockBody({ p, i18n }: { p: StockPreview; i18n: I18n }) {
  const { t, locale } = i18n;
  const unit = UNIT[p.item.unit];
  return (
    <>
      <Row label={t("Amount")}>
        <bdi dir="ltr" className="font-semibold">
          {(p.quantity < 0 ? "−" : "+") + amountText(Math.abs(p.quantity), unit, locale)}
        </bdi>
      </Row>
      <Row label={t("On hand")}>
        <BeforeAfter before={amountText(p.before, unit, locale)} after={amountText(p.after, unit, locale)} tone={p.after < 0 ? "bad" : undefined} />
      </Row>
      <Row label={t("Value")}>{valueText(p.valueFils, i18n)}</Row>
      <Row label={t("Day")}>{i18n.date(`${p.day}T12:00:00+04:00`, { day: "numeric", month: "short" })}</Row>
      {p.note && <Row label={t("Note")}>{p.note}</Row>}
    </>
  );
}

function CountBody({ p, i18n }: { p: CountPreview; i18n: I18n }) {
  const { t, locale } = i18n;
  return (
    <>
      <ul className="divide-y divide-black-iron/[0.06]">
        {p.rows.map((r) => {
          const unit = UNIT[r.item.unit];
          return (
            <li key={r.item.id} className={cn("py-2 text-[14px]", r.big && "rounded-[8px] bg-saffron-orange/[0.08] px-2")}>
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{nameOf(r.item, locale)}</span>
                <BeforeAfter before={amountText(r.before, unit, locale)} after={amountText(r.after, unit, locale)} />
              </div>
              <div className="mt-0.5 flex justify-between gap-3 text-[12.5px] text-dark-grey">
                <span>
                  {t("Difference")}: <bdi dir="ltr">{(r.after - r.before >= 0 ? "+" : "−") + amountText(Math.abs(r.after - r.before), unit, locale)}</bdi>
                </span>
                <span>{valueText(r.valueFils, i18n, true)}</span>
              </div>
              {r.big && <p className="mt-1 text-[12.5px] font-medium text-cinnamon-bark">{t("Big difference — check this one.")}</p>}
            </li>
          );
        })}
      </ul>
      <Row label={t("Day")}>{i18n.date(`${p.day}T12:00:00+04:00`, { day: "numeric", month: "short" })}</Row>
    </>
  );
}

function RecipeBody({ p, i18n }: { p: RecipePreview; i18n: I18n }) {
  const { t, locale, money, number } = i18n;
  const pct = (v: number | null) => (v == null ? t("Unknown") : `${number(v, { max: 1 })}%`);
  // A prep costs fils per gram; per kg / litre reads the way the kitchen buys.
  const big = p.recipe.kind === "PREP" && p.recipe.yieldUnit !== "PCS";
  const per = big ? 1000 : 1;
  const costLabel = p.recipe.kind === "DISH" ? t("Cost per portion") : !big ? t("Cost per piece") : p.recipe.yieldUnit === "G" ? t("Cost per kg") : t("Cost per litre");
  return (
    <>
      <ul className="divide-y divide-black-iron/[0.06]">
        {p.changes.map((c, i) => {
          const unit = UNIT[c.unit];
          return (
            <li key={i} className="flex items-start justify-between gap-3 py-2 text-[14px]">
              <span className="font-medium">{nameOf(c.item, locale)}</span>
              {c.before == null ? (
                <span className="font-semibold text-olive-leaf">
                  {t("Added")}: {amountText(c.after!, unit, locale)}
                </span>
              ) : c.after == null ? (
                <span className="font-semibold text-pomegranate-red">{t("Removed")}</span>
              ) : (
                <BeforeAfter before={amountText(c.before, unit, locale)} after={amountText(c.after, unit, locale)} />
              )}
            </li>
          );
        })}
      </ul>
      <Row label={costLabel}>
        <BeforeAfter
          before={p.cost.beforeFils == null ? t("Unknown") : money(Math.round(p.cost.beforeFils * per))}
          after={p.cost.afterFils == null ? t("Unknown") : money(Math.round(p.cost.afterFils * per))}
        />
        <span className="block text-[12px] text-dark-grey">{p.cost.verified ? t("verified prices") : t("estimated")}</span>
      </Row>
      {p.menuPriceFils != null && (
        <Row label={t("Food cost")}>
          <BeforeAfter before={pct(p.foodCostPct.before)} after={pct(p.foodCostPct.after)} />
        </Row>
      )}
      {p.note && <Row label={t("Note")}>{p.note}</Row>}
      <p className="mt-2 rounded-[10px] bg-black-iron/[0.03] px-3 py-2 text-[12.5px] text-dark-grey">
        {p.approve
          ? t("Confirming approves version {n}: cost, stock use of new sales and profit follow it at once. Past sales keep the version they used.", {
              n: (p.fromVersion ?? 0) + 1,
            })
          : t("Confirming saves a draft; the owner approves it on the recipe screen.")}
      </p>
    </>
  );
}

function NewRecipeBody({ p, i18n, applied }: { p: NewRecipePreview; i18n: I18n; applied: boolean }) {
  const { t, locale, money, number } = i18n;
  return (
    <>
      <p className="text-[12.5px] text-dark-grey">
        {p.portions > 1 ? t("Per portion (you said the amounts for {n} portions).", { n: p.portions }) : t("Per portion.")}
      </p>
      <ul className="mt-1 divide-y divide-black-iron/[0.06]">
        {p.rows.map((r, i) => {
          const name = nameOf(r.item, locale);
          // Show what was said when it matched under another name, so a wrong match is easy to spot.
          const heard = r.said.toLowerCase() !== r.item.name.toLowerCase() && r.said !== r.item.nameFa ? r.said : null;
          return (
            <li key={i} className="flex items-start justify-between gap-3 py-2 text-[14px]">
              <span className="min-w-0">
                <span className="font-medium">{name}</span>
                {heard && (
                  <span dir="auto" className="block text-[12px] text-dark-grey">
                    {t("heard: {words}", { words: heard })}
                  </span>
                )}
              </span>
              <bdi dir="ltr" className="shrink-0 font-semibold tabular-nums">
                {amountText(r.quantity, UNIT[r.unit], locale)}
              </bdi>
            </li>
          );
        })}
      </ul>
      <Row label={t("Cost per portion")}>
        {p.cost.perPortionFils == null ? (
          <>
            {t("Unknown")}
            {p.cost.missingPrices.length > 0 && (
              <span className="block text-[12px] text-dark-grey">{t("No price yet for: {names}", { names: p.cost.missingPrices.join(", ") })}</span>
            )}
          </>
        ) : (
          <>
            <bdi dir="ltr" className="font-semibold">
              {money(Math.round(p.cost.perPortionFils))}
            </bdi>
            <span className="block text-[12px] text-dark-grey">{p.cost.verified ? t("verified prices") : t("estimated")}</span>
          </>
        )}
      </Row>
      {p.foodCostPct != null && <Row label={t("Food cost")}>{`${number(p.foodCostPct, { max: 1 })}%`}</Row>}
      {p.note && <Row label={t("Note")}>{p.note}</Row>}
      {applied ? (
        <Link
          href={`/admin/menu-items/${p.dish.id}#recipe`}
          className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-[13.5px] font-medium text-terracotta-ink admin-link"
        >
          {t("Open the recipe to approve it")} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      ) : (
        <p className="mt-2 rounded-[10px] bg-black-iron/[0.03] px-3 py-2 text-[12.5px] text-dark-grey">
          {t("Confirming saves it as a draft. The owner approves it on the recipe screen; until then costs and stock don't change.")}
        </p>
      )}
    </>
  );
}

function InvoiceBody({ p, i18n }: { p: InvoicePreview; i18n: I18n }) {
  const { t, money, locale } = i18n;
  return (
    <>
      <Row label={t("Invoice")}>
        {p.invoice.supplier}
        {p.invoice.invoiceNo ? ` · ${p.invoice.invoiceNo}` : ""} · {i18n.date(`${p.invoice.day}T12:00:00+04:00`, { day: "numeric", month: "short" })}
      </Row>
      <Row label={t("Line")}>
        {p.line.item ? nameOf(p.line.item, locale) : p.line.rawName} · {i18n.number(p.line.quantity)} {p.line.unit ?? ""}
      </Row>
      <Row label={t("Unit price")}>
        <BeforeAfter before={p.unitPrice.beforeFils == null ? t("Unknown") : money(p.unitPrice.beforeFils)} after={money(p.unitPrice.afterFils)} />
      </Row>
      <Row label={t("Line total")}>
        <BeforeAfter before={money(p.lineTotal.beforeFils)} after={money(p.lineTotal.afterFils)} />
      </Row>
      <Row label={t("Invoice total")}>
        <BeforeAfter before={money(p.total.beforeFils)} after={money(p.total.afterFils)} />
      </Row>
      <p className="mt-2 rounded-[10px] bg-black-iron/[0.03] px-3 py-2 text-[12.5px] text-dark-grey">
        {t("The invoice is saved again with this price; the old one stays in the history. Stock value and food cost follow.")}
      </p>
    </>
  );
}

function FreeFoodBody({ p, i18n }: { p: FreeFoodPreview; i18n: I18n }) {
  const { t, money, locale } = i18n;
  return (
    <>
      <ul className="divide-y divide-black-iron/[0.06]">
        {p.lines.map((l, i) => (
          <li key={i} className="flex items-start justify-between gap-3 py-2 text-[14px]">
            <span className="font-medium">
              {l.quantity}× {nameOf(l, locale)}
            </span>
            <span className="text-end text-dark-grey">{l.unitCostFils == null ? t("Food cost not known yet") : money(l.unitCostFils * l.quantity)}</span>
          </li>
        ))}
      </ul>
      <Row label={t("Food cost")}>
        {p.costFils == null ? (
          t("Not known yet — needs an approved recipe with ingredient prices")
        ) : (
          <>
            <bdi dir="ltr">{money(p.costFils)}</bdi> · {t("estimated")}
          </>
        )}
      </Row>
      <Row label={t("On the menu")}>{money(p.menuValueFils)}</Row>
      {p.recipient && <Row label={p.type === "STAFF_MEAL" ? t("Who ate") : t("Given to")}>{p.recipient}</Row>}
      {p.reason && <Row label={t("Why")}>{p.reason}</Row>}
      <Row label={t("Day")}>{i18n.date(`${p.day}T12:00:00+04:00`, { day: "numeric", month: "short" })}</Row>
      <p className="mt-2 rounded-[10px] bg-black-iron/[0.03] px-3 py-2 text-[12.5px] text-dark-grey">
        {t("Confirming takes the ingredients out of stock by the recipes. No sale is recorded.")}
      </p>
    </>
  );
}

function title(p: Preview, i18n: I18n) {
  const { t, locale } = i18n;
  switch (p.kind) {
    case "stock":
      return `${p.type === "WASTE" ? t("Waste") : p.type === "STAFF_MEAL" ? t("Staff meal") : t("Stock correction")} · ${nameOf(p.item, locale)}`;
    case "count":
      return t("Stock count · {n} items", { n: p.rows.length });
    case "recipe":
      return `${t("Recipe change")} · ${nameOf(p.recipe, locale)}`;
    case "new_recipe":
      return `${t("New recipe")} · ${nameOf(p.dish, locale)}`;
    case "invoice":
      return t("Invoice price correction");
    case "free_food":
      return `${t("Free food")} · ${t(FREE_FOOD_LABEL[p.type])}`;
  }
}

export function ActionCardView({ card, onChange }: { card: ActionCard; onChange: (card: ActionCard) => void }) {
  const i18n = useAdminI18n();
  const { t } = i18n;
  const [busy, setBusy] = React.useState<null | "confirm" | "cancel" | "undo">(null);
  const [asking, setAsking] = React.useState(false);

  async function act(kind: "confirm" | "cancel" | "undo", sure = false) {
    setBusy(kind);
    try {
      const res = await fetch(`/api/admin/ops/assistant/actions/${card.id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: kind === "confirm" ? JSON.stringify({ sure }) : "{}",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw body;
      onChange(body.action);
      setAsking(false);
      if (kind === "confirm") toast.success(t("Saved. You can delete this change for a day."));
      if (kind === "undo") toast.success(t("Change deleted."));
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Something went wrong")));
    } finally {
      setBusy(null);
    }
  }

  const p = card.preview;
  const status =
    card.status === "APPLIED" ? (
      <StatusPill tone="good">
        <Check className="h-3 w-3" /> {t("Done")}
      </StatusPill>
    ) : card.status === "UNDONE" ? (
      <StatusPill>{t("Deleted")}</StatusPill>
    ) : card.status === "CANCELLED" ? (
      <StatusPill>{t("Cancelled")}</StatusPill>
    ) : card.sensitive ? (
      <StatusPill tone="warn">{t("Check carefully")}</StatusPill>
    ) : (
      <StatusPill tone="accent">{t("Waiting for you")}</StatusPill>
    );

  return (
    <div
      className={cn(
        "rounded-[14px] border bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        card.status === "PROPOSED" ? (card.sensitive ? "border-saffron-orange/50" : "border-terracotta/40") : "border-black-iron/[0.08]",
        (card.status === "CANCELLED" || card.status === "UNDONE") && "opacity-70",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold leading-snug text-black-iron">{title(p, i18n)}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {card.via === "voice" && (
            <span title={t("From a voice note")} className="text-dark-grey">
              <Mic className="h-3.5 w-3.5" aria-label={t("From a voice note")} />
            </span>
          )}
          {status}
        </div>
      </div>

      {p.kind === "stock" && <StockBody p={p} i18n={i18n} />}
      {p.kind === "count" && <CountBody p={p} i18n={i18n} />}
      {p.kind === "recipe" && <RecipeBody p={p} i18n={i18n} />}
      {p.kind === "new_recipe" && <NewRecipeBody p={p} i18n={i18n} applied={card.status === "APPLIED"} />}
      {p.kind === "invoice" && <InvoiceBody p={p} i18n={i18n} />}
      {p.kind === "free_food" && <FreeFoodBody p={p} i18n={i18n} />}

      {card.status === "PROPOSED" && !asking && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" disabled={!!busy} onClick={() => (card.sensitive ? setAsking(true) : act("confirm"))}>
            {busy === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("Confirm")}
          </Button>
          <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("cancel")}>
            {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            {t("Cancel")}
          </Button>
        </div>
      )}
      {card.status === "PROPOSED" && asking && (
        <div className="mt-3 rounded-[12px] bg-saffron-orange/[0.1] p-3">
          <p className="flex items-start gap-2 text-[13px] font-medium text-cinnamon-bark">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {t("This changes money, a recipe or a big stock difference. Are the numbers above right?")}
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" className="flex-1" disabled={!!busy} onClick={() => act("confirm", true)}>
              {busy === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {t("Yes, make this change")}
            </Button>
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setAsking(false)}>
              {t("Back")}
            </Button>
          </div>
        </div>
      )}
      {card.status === "APPLIED" && card.canUndo && (
        <div className="mt-3">
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("undo")}>
            {busy === "undo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {t("Delete this change")}
          </Button>
        </div>
      )}
    </div>
  );
}
