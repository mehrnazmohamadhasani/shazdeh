/** Persian for owner cash, kitchen settings (VAT, AI limit, VAT export) and the purchaser role. English text → Persian; see ../index.ts. */
export const purchasing: Record<string, string> = {
  // Owner cash
  "Owner cash": "نقدِ صاحب رستوران",
  "Invoices paid with someone's own money, against cash they took from the business account (or were paid back). Set “Their own” in an invoice's Payment box; the name must match.":
    "فاکتورهایی که کسی با پول خودش پرداخته، در برابر پولی که از حساب رستوران برداشته (یا به او برگردانده شده). در کادر پرداختِ فاکتور «پول خودش» را بزنید؛ اسم باید یکی باشد.",
  "Balance by person": "مانده برای هر نفر",
  "Nothing yet": "هنوز چیزی ثبت نشده",
  "When someone pays an invoice with their own money, open its Payment box and choose “Their own”.":
    "وقتی کسی فاکتوری را با پول خودش می‌پردازد، کادر پرداختِ آن فاکتور را باز کنید و «پول خودش» را بزنید.",
  "Taken {taken} · invoices {presented}": "برداشت {taken} · فاکتور {presented}",
  "{amount} still needs invoices": "{amount} هنوز فاکتور ندارد",
  "Business owes {amount}": "رستوران {amount} بدهکار است",
  Settled: "تسویه",
  "Money taken or paid back": "برداشت یا بازپرداخت",
  Month: "ماه",
  "Paid with own money": "پرداخت با پول خودش",
  "Taken / paid back": "برداشت / بازپرداخت",
  "At month end": "آخر ماه",
  "Paid back": "بازپرداخت شد",
  "Paid {amount} back to {name} today?": "امروز {amount} به {name} برگردانده شد؟",
  Withdrawals: "برداشت‌ها",
  "No withdrawals yet": "هنوز برداشتی ثبت نشده",
  "Invoices paid with own money": "فاکتورهای پرداخت‌شده با پول خودِ افراد",
  "No invoices paid with own money yet": "هنوز فاکتوری با پول شخصی پرداخت نشده",
  "Enter the amount taken.": "مبلغ برداشت را وارد کنید.",
  "Withdrawal saved": "برداشت ذخیره شد",
  "Taken by": "برداشت‌کننده",
  "e.g. ATM, bank transfer ref": "مثلاً خودپرداز، شماره‌ی حواله",
  "Delete this withdrawal? Use this only for a mistake.": "این برداشت حذف شود؟ فقط برای ثبت اشتباه.",
  Removed: "حذف شد",

  // Kitchen settings
  "Kitchen settings": "تنظیمات آشپزخانه",
  "How food cost is worked out, the AI spending limit, and the VAT report for the accountant.":
    "نحوه‌ی حساب هزینه‌ی مواد، سقف هزینه‌ی هوش مصنوعی، و گزارش VAT برای حسابدار.",
  "AI reading this month": "خواندن با هوش مصنوعی در این ماه",
  "of {cap} · {n} readings": "از {cap} · {n} بار خواندن",
  "Limit reached — reading is paused": "به سقف رسید — خواندن متوقف است",
  "Over 80 % used": "بیش از ۸۰٪ مصرف شده",
  "Monthly AI limit: {cap}": "سقف ماهانه‌ی هوش مصنوعی: {cap}",
  "Only an admin can change these.": "فقط مدیر سیستم می‌تواند این‌ها را تغییر دهد.",
  "Enter a monthly limit (0 or more).": "سقف ماهانه را وارد کنید (۰ یا بیشتر).",
  "Food cost includes VAT": "هزینه‌ی مواد با VAT",
  "Food cost without VAT": "هزینه‌ی مواد بدون VAT",
  "Off: costs without VAT (SHĀZDEH gets purchase VAT back). On: costs with the VAT paid to suppliers. Recipes, stock prices and margins all follow this.":
    "خاموش: هزینه‌ها بدون VAT (شازده VAT خرید را پس می‌گیرد). روشن: هزینه‌ها با VATی که به تأمین‌کننده پرداخت شده. دستور پخت، قیمت انبار و سود همه از این پیروی می‌کنند.",
  "Monthly AI limit (US$)": "سقف ماهانه‌ی هوش مصنوعی (دلار)",
  "Reading stops for the rest of the month at this amount; admins get a warning at 80 %.":
    "با رسیدن به این مبلغ، خواندن تا آخر ماه متوقف می‌شود؛ در ۸۰٪ به مدیران هشدار داده می‌شود.",
  "Last price (with VAT)": "آخرین قیمت (با VAT)",

  // VAT export
  "Purchase VAT for the accountant": "VAT خرید برای حسابدار",
  "Every saved invoice in the period: supplier TRN, net, VAT and total, with anything to check. Excel file.":
    "همه‌ی فاکتورهای ذخیره‌شده در این بازه: TRN تأمین‌کننده، مبلغ خالص، VAT و جمع، همراه با مواردی که باید بررسی شوند. فایل اکسل.",
  From: "از",
  To: "تا",
  "Download Excel": "دانلود اکسل",

  // Purchaser role
  Purchasing: "خرید و انبار",
  "Invoice photos, stock counts and suppliers — no menu, orders or money pages.":
    "عکس فاکتور، شمارش انبار و تأمین‌کننده‌ها — بدون منو، سفارش‌ها یا صفحه‌های مالی.",
};
