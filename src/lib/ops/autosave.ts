import { checkExtraction, type Flag } from "./checks";
import { isStockCategory, type Extraction } from "./extraction";
import type { Suggestions } from "./match";
import { checkPlatformDraft, foodSales, type MenuEntry, type PlatformDraft } from "./platform";
import type { PlatformReading } from "./platform-reading";
import type { SavePlatformOrderInput } from "./platform-save-schema";
import type { SaveInvoiceInput } from "./save-schema";

/*
 * "The user shows, the system works" (brief §2): a reading is saved
 * without a person only when nothing about it is uncertain. Anything
 * short of that goes to review as before. The rules are deliberately
 * strict for invoices, which change stock, suppliers and money owed.
 */

export type AutoSaveDecision<T> = { ok: true; input: T } | { ok: false; reasons: string[] };

const blocking = (flags: Flag[]) => flags.filter((f) => f.level !== "info").map((f) => f.message);

/** A UTC instant → Dubai "YYYY-MM-DDTHH:mm". */
const dubaiLocal = (iso: string) => new Date(Date.parse(iso) + 4 * 3_600_000).toISOString().slice(0, 16);

export function decidePlatformAutoSave(
  reading: PlatformReading,
  draft: PlatformDraft,
  menu: MenuEntry[],
  minConfidence: number,
  now = new Date(),
): AutoSaveDecision<SavePlatformOrderInput> {
  const reasons: string[] = [];
  if (!reading.isPlatformReceipt) reasons.push("not a platform receipt");
  reading.items.forEach((it, i) => {
    if (it.confidence < minConfidence) reasons.push(`item ${i + 1} confidence ${it.confidence}`);
  });
  const items = draft.items.map((it) => {
    const menuPriceFils = it.match ? (menu.find((m) => m.id === it.match!.menuItemId)?.priceFils ?? null) : null;
    return { ...it, menuItemId: it.match?.menuItemId ?? null, menuPriceFils, confident: !!it.match?.confident };
  });
  // When the receipt's own sums tie every number together (dishes =
  // subtotal, subtotal + fees − discount = total, or menu prices = total),
  // the reading is checked independently of the model's self-rating, so
  // its overall confidence may be a little lower. Each dish still needs the full bar.
  const crossChecked =
    draft.totalFils != null &&
    ((draft.subtotalFils != null && items.length > 0 && items.every((i) => i.lineTotalFils != null)) || (items.length > 0 && items.every((i) => i.menuPriceFils != null)));
  const overallBar = crossChecked ? minConfidence - 0.1 : minConfidence;
  if (reading.confidence < overallBar) reasons.push(`overall confidence ${reading.confidence}`);
  items.forEach((it) => {
    if (!it.menuItemId || !it.confident) reasons.push(`dish not clearly matched: ${it.rawName}`);
  });
  reasons.push(...blocking(checkPlatformDraft({ ...draft, items }, { now, itemCount: reading.itemCount, isPlatformReceipt: reading.isPlatformReceipt })));
  if (!foodSales({ ...draft, items })) reasons.push("food sale can't be worked out");
  if (reasons.length || !draft.channelCode || !draft.orderNo || !draft.placedAt || draft.totalFils == null) {
    return { ok: false, reasons: reasons.length ? reasons : ["missing order details"] };
  }
  const aed = (f: number | null) => (f == null ? null : f / 100);
  return {
    ok: true,
    input: {
      channelCode: draft.channelCode,
      orderNo: draft.orderNo,
      altOrderId: draft.altOrderId,
      placedAt: dubaiLocal(draft.placedAt),
      fulfilment: draft.fulfilment,
      payment: draft.payment,
      customerFirstName: draft.customerFirstName,
      items: items.map((i) => ({ rawName: i.rawName, category: i.category, quantity: i.quantity, lineTotal: aed(i.lineTotalFils), menuItemId: i.menuItemId })),
      subtotal: aed(draft.subtotalFils),
      deliveryFee: aed(draft.deliveryFeeFils),
      serviceFee: aed(draft.serviceFeeFils),
      discount: draft.discountFils / 100,
      discountFundedBy: "UNKNOWN",
      total: draft.totalFils / 100,
      note: draft.note,
    },
  };
}

export function decideInvoiceAutoSave(x: Extraction, s: Suggestions, minConfidence: number, now = new Date()): AutoSaveDecision<SaveInvoiceInput> {
  const reasons: string[] = [];
  if (x.documentType !== "supplier_invoice" && x.documentType !== "shop_receipt") reasons.push(`document type ${x.documentType}`);
  if (x.handwritten) reasons.push("handwritten");
  if (x.confidence < minConfidence) reasons.push(`overall confidence ${x.confidence}`);
  if (!s.supplierId || !s.supplierName) reasons.push("new or unknown supplier");
  if (!x.lines.length) reasons.push("no lines");
  x.lines.forEach((l, i) => {
    if (l.confidence < minConfidence) reasons.push(`line ${i + 1} confidence ${l.confidence}`);
    if (l.quantity == null || l.quantity <= 0 || l.lineTotal == null) reasons.push(`line ${i + 1} incomplete`);
    const sug = s.lines[i];
    // Stock lines must be remembered from an earlier confirmation, pack size included.
    if (isStockCategory(l.category) && !(sug?.source === "learned" && sug.ingredientId && sug.unit && sug.quantity)) {
      reasons.push(`line ${i + 1} not learned yet: ${l.description}`);
    }
  });
  if (!x.invoiceDate) reasons.push("no date");
  if (x.total == null) reasons.push("no total");
  reasons.push(...blocking(checkExtraction(x)));
  if (x.invoiceDate) {
    const days = (now.getTime() - Date.parse(x.invoiceDate)) / 86_400_000;
    if (days > 60) reasons.push("older than 60 days");
  }
  if (reasons.length) return { ok: false, reasons };

  return {
    ok: true,
    input: {
      supplier: { id: s.supplierId, name: s.supplierName!, trn: x.supplier.trn, phone: x.supplier.phone },
      invoiceNo: x.invoiceNumber,
      invoiceDate: x.invoiceDate!,
      paymentMode: x.paymentMode,
      dueDate: null, // credit: from the supplier's terms
      paidBy: null,
      notes: x.notes,
      pricesIncludeVat: x.pricesIncludeVat ?? false,
      subtotal: x.subtotal,
      discount: Math.abs(x.discount ?? 0),
      vat: x.vat,
      total: x.total!,
      lines: x.lines.map((l, i) => {
        const sug = s.lines[i];
        const stocked = isStockCategory(l.category);
        return {
          rawName: l.description,
          itemCode: l.itemCode,
          quantity: l.quantity!,
          unit: l.unit,
          unitPrice: l.unitPrice,
          discount: Math.abs(l.discount ?? 0),
          vat: l.vat,
          lineTotal: l.lineTotal!,
          category: l.category,
          ingredient: stocked
            ? { id: sug!.ingredientId, name: sug!.ingredientName!, unit: sug!.unit!, ...(sug!.meatTypeId ? { meatTypeId: sug!.meatTypeId } : {}) }
            : null,
          stockQuantity: stocked ? sug!.quantity : null,
        };
      }),
    },
  };
}
