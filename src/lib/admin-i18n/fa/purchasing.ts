/** Persian for owner cash, kitchen settings (VAT, AI limit, VAT export) and the purchaser role. English text → Persian; see ../index.ts. */
export const purchasing: Record<string, string> = {
  // Owner cash
  "Owner cash": "نقدِ صاحب رستوران",
  "Cash taken from the business account for purchases, against the cash and card invoices presented. Invoices count when their “Paid by” is the same name.":
    "پولی که برای خرید از حساب رستوران برداشته شده، در برابر فاکتورهای نقدی و کارتیِ ارائه‌شده. فاکتوری حساب می‌شود که «پرداخت‌کننده»اش همین اسم باشد.",
  "Balance by person": "مانده برای هر نفر",
  "Nothing yet": "هنوز چیزی ثبت نشده",
  "Add a withdrawal below, and write the same name in “Paid by” when saving a cash invoice.":
    "برداشت را پایین ثبت کنید و موقع ذخیره‌ی فاکتور نقدی، همین اسم را در «پرداخت‌کننده» بنویسید.",
  "Taken {taken} · invoices {presented}": "برداشت {taken} · فاکتور {presented}",
  "{amount} still needs invoices": "{amount} هنوز فاکتور ندارد",
  "Business owes {amount}": "رستوران {amount} بدهکار است",
  Settled: "تسویه",
  "Add a withdrawal": "ثبت برداشت",
  Withdrawals: "برداشت‌ها",
  "No withdrawals yet": "هنوز برداشتی ثبت نشده",
  "Invoices presented": "فاکتورهای ارائه‌شده",
  "No cash or card invoices with “Paid by” yet": "هنوز فاکتور نقدی یا کارتی با «پرداخت‌کننده» نیست",
  "Enter the amount taken.": "مبلغ برداشت را وارد کنید.",
  "Withdrawal saved": "برداشت ذخیره شد",
  "Taken by": "برداشت‌کننده",
  "e.g. ATM, bank transfer ref": "مثلاً خودپرداز، شماره‌ی حواله",
  "Remove this withdrawal? Use this only for a mistake.": "این برداشت حذف شود؟ فقط برای ثبت اشتباه.",
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
