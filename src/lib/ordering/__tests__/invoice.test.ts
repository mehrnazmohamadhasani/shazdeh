import { test } from "node:test";
import assert from "node:assert/strict";
import { hasInvoice, invoiceDate, invoiceTitle, renderInvoice, type InvoiceOrder, type InvoiceSeller } from "../invoice";
import { arabicView } from "../../dish";

const seller: InvoiceSeller = {
  brandName: "SHĀZDEH",
  legalName: "Test Kitchen LLC",
  tradeLicenseNo: "123456",
  licensingAuthority: "DET",
  trn: "100000000000003",
  address: "Dubai, United Arab Emirates",
  phone: "+971 4 000 0000",
  email: "hello@example.test",
  pricesIncludeVat: true,
};

const order: InvoiceOrder = {
  number: "SZ-100200",
  status: "DELIVERED",
  placedAt: new Date("2026-11-06T09:05:00Z"),
  paymentMethod: "CASH_ON_DELIVERY",
  paymentStatus: "PAID",
  subtotalFils: 10000,
  deliveryFeeFils: 500,
  serviceFeeFils: 0,
  discountFils: 0,
  vatFils: 500,
  totalFils: 10500,
  couponCode: null,
  items: [
    { name: "Ghormeh Sabzi", nameAr: "قورمه سبزي", portion: "Large", quantity: 2, unitPriceFils: 5000, lineTotalFils: 10000, modifiers: [{ name: "Extra rice" }] },
  ],
};

test("the invoice shows what Art. 6 asks for, in English and Arabic", () => {
  const html = renderInvoice(order, seller);
  for (const must of [
    "Tax invoice", "فاتورة ضريبية", // title in both languages
    "SZ-100200", "06 Nov 2026, 13:05", // number and Dubai date with year
    "Test Kitchen LLC", "Dubai, United Arab Emirates", "+971 4 000 0000", "hello@example.test", // seller and contact
    "123456", "رقم الرخصة التجارية", // trade licence
    "100000000000003", "الرقم الضريبي", // TRN
    "Ghormeh Sabzi", "قورمه سبزي", "Extra rice", // items in both languages
    "الكمية", "50 AED", "100 AED", // quantity and prices in AED
    "105 AED", "الإجمالي (درهم)", "شامل ضريبة القيمة المضافة", "5 AED", // total and VAT
    "نقداً عند التوصيل", "مدفوع", // payment
  ]) {
    assert.ok(html.includes(must), `missing: ${must}`);
  }
});

test("the invoice leaves out the customer's name and address", () => {
  const html = renderInvoice(order, seller);
  assert.ok(!/customer/i.test(html.replace(/<style>[\s\S]*?<\/style>/, "")));
});

test("without a TRN it is a plain invoice; VAT added on top is listed before the total", () => {
  assert.deepEqual(invoiceTitle({ trn: null }), ["Invoice", "فاتورة"]);
  const html = renderInvoice(order, { ...seller, trn: null, pricesIncludeVat: false });
  assert.ok(!html.includes("Tax invoice"));
  assert.ok(html.indexOf("ضريبة القيمة المضافة") < html.indexOf("الإجمالي (درهم)"));
});

test("text from the database is escaped", () => {
  const html = renderInvoice({ ...order, items: [{ ...order.items[0], name: "<script>x</script>" }] }, seller);
  assert.ok(!html.includes("<script>x"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("only sold orders get an invoice", () => {
  assert.equal(hasInvoice("DELIVERED"), true);
  assert.equal(hasInvoice("RECEIVED"), true);
  for (const s of ["PENDING_PAYMENT", "REJECTED", "CANCELLED"] as const) assert.equal(hasInvoice(s), false);
});

test("invoice dates are in Dubai time with the year", () => {
  assert.equal(invoiceDate(new Date("2026-12-31T21:30:00Z")), "01 Jan 2027, 01:30");
});

test("a dish's Arabic: null until written, portion word dropped for the product name", () => {
  assert.equal(arabicView({ nameAr: null, descriptionAr: null, ingredientsAr: null, allergensAr: null }), null);
  const a = arabicView({ nameAr: "فسنجان (كبير)", descriptionAr: null, ingredientsAr: "دجاج، رمان، جوز", allergensAr: "جوز" }, true)!;
  assert.equal(a.name, "فسنجان");
  assert.equal(a.ingredients, "دجاج، رمان، جوز");
  assert.equal(arabicView({ nameAr: "فسنجان كبير", descriptionAr: null, ingredientsAr: null, allergensAr: null })!.name, "فسنجان كبير");
});
