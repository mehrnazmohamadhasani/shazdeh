/** Persian for the admin stock, suppliers and payables screens. English text → Persian; see ../index.ts. */
export const stock: Record<string, string> = {
  // Units (after amounts, in labels)
  kg: "کیلو",
  L: "لیتر",
  pcs: "عدد",
  litres: "لیتر",
  pieces: "عدد",
  "e.g. {example}": "مثلاً {example}",

  // Stock
  "What is in the kitchen: purchases in, waste and staff meals out, corrected by the weekly count.":
    "موجودی آشپزخانه: خریدها اضافه می‌شوند، ضایعات و غذای کارکنان کم می‌شوند و شمارش هفتگی آن را اصلاح می‌کند.",
  "Count stock": "شمارش انبار",
  "No stock yet": "هنوز موجودی‌ای ثبت نشده",
  "Save your first supplier invoice and its ingredients appear here.":
    "اولین فاکتور تأمین‌کننده را ذخیره کنید تا مواد اولیه‌اش اینجا بیاید.",
  Ingredient: "ماده‌ی اولیه",
  "On hand": "موجودی",
  "Last price (ex VAT)": "آخرین قیمت (بدون VAT)",
  "Last bought": "آخرین خرید",
  packaging: "بسته‌بندی",
  supplies: "مصرفی",
  Supplies: "مصرفی",

  // Stock count
  "Stock count": "شمارش انبار",
  "Back to stock": "بازگشت به انبار",
  "Weekly count: type what is actually on the shelf. Differences are saved as corrections, so the history stays complete.":
    "شمارش هفتگی: مقداری را که واقعاً در قفسه هست وارد کنید. اختلاف‌ها به‌عنوان اصلاحیه ذخیره می‌شوند تا تاریخچه کامل بماند.",
  "Nothing to count yet": "هنوز چیزی برای شمارش نیست",
  "Ingredients appear after you save an invoice.": "مواد اولیه بعد از ذخیره‌ی اولین فاکتور اینجا می‌آیند.",
  "Count day": "روز شمارش",
  "Only fill in what you counted; empty rows are left as they are.":
    "فقط چیزهایی را که شمردید پر کنید؛ ردیف‌های خالی دست نمی‌خورند.",
  "System says {amount}": "طبق سیستم: {amount}",
  "{name} counted ({unit})": "مقدار شمرده‌شده‌ی {name} ({unit})",
  "Save count ({n})": "ذخیره‌ی شمارش ({n})",
  "Enter at least one count": "دست‌کم یک مقدار شمرده‌شده وارد کنید",
  "Count saved — {n} item": "شمارش ذخیره شد — {n} قلم",
  "Count saved — {n} items": "شمارش ذخیره شد — {n} قلم",

  // Suppliers
  Supplier: "تأمین‌کننده",
  "Added automatically from invoices. Set delivery days and payment terms here.":
    "از روی فاکتورها خودکار اضافه می‌شوند. روزهای تحویل و مهلت پرداخت را اینجا تنظیم کنید.",
  "No suppliers yet": "هنوز تأمین‌کننده‌ای نیست",
  "They appear here when you save their first invoice.": "با ذخیره‌ی اولین فاکتورشان اینجا نمایش داده می‌شوند.",
  "{n} invoice": "{n} فاکتور",
  "{n} invoices": "{n} فاکتور",
  "last {date}": "آخرین: {date}",
  "delivers {days}": "تحویل: {days}",
  "Owed {amount}": "بدهی {amount}",
  "Back to suppliers": "بازگشت به تأمین‌کننده‌ها",
  Details: "مشخصات",
  "No invoices.": "فاکتوری نیست.",
  "No number": "بدون شماره",
  Undone: "برگردانده شد",
  "Due {date}": "سررسید {date}",
  Unpaid: "پرداخت‌نشده",
  "What we've learned": "آنچه یاد گرفته‌ایم",
  "How this supplier prints each item, and how much stock one of its units is.":
    "این تأمین‌کننده هر قلم را با چه اسمی روی فاکتور می‌نویسد و هر واحدش چقدر موجودی حساب می‌شود.",
  "1 unit = {amount}": "1 واحد = {amount}",
  Merge: "ادغام",
  "Same supplier under two names (e.g. “Unknown (handwritten veg)”)? Move everything into the right one.":
    "یک تأمین‌کننده با دو اسم ثبت شده (مثلاً «Unknown (handwritten veg)»)؟ همه‌چیز را به اسم درست منتقل کنید.",

  // Supplier form
  TRN: "TRN",
  "15 digits": "15 رقم",
  "Payment terms": "مهلت پرداخت",
  "Days to pay a credit invoice. Leave empty if they want cash or card.":
    "چند روز برای پرداخت فاکتور نسیه وقت دارید. اگر نقد یا کارت می‌خواهند، خالی بگذارید.",
  "Delivers on": "روزهای تحویل",
  "Lead time": "زمان تحویل",
  "Days from ordering to delivery.": "تعداد روز از سفارش تا تحویل.",
  "Contact name, minimum order…": "نام رابط، حداقل سفارش…",
  "Save supplier": "ذخیره‌ی تأمین‌کننده",
  "Supplier saved": "تأمین‌کننده ذخیره شد",
  "Could not save": "ذخیره انجام نشد",

  // Merge form
  "No other supplier to merge with.": "تأمین‌کننده‌ی دیگری برای ادغام نیست.",
  "No other ingredient to merge with.": "ماده‌ی اولیه‌ی دیگری برای ادغام نیست.",
  'Merge into "{name}"? All history moves there and this supplier is removed.':
    "در «{name}» ادغام شود؟ همه‌ی سوابق به آنجا منتقل و این تأمین‌کننده حذف می‌شود.",
  'Merge into "{name}"? All history moves there and this ingredient is removed.':
    "در «{name}» ادغام شود؟ همه‌ی سوابق به آنجا منتقل و این ماده‌ی اولیه حذف می‌شود.",
  "Merged into {name}": "در {name} ادغام شد",
  "Same supplier as…": "همان تأمین‌کننده‌ی…",
  "Same ingredient as…": "همان ماده‌ی اولیه‌ی…",
  "Choose…": "انتخاب کنید…",

  // Payables
  "Credit invoices waiting to be paid, oldest due date first.":
    "فاکتورهای نسیه‌ای که باید پرداخت شوند، به ترتیب نزدیک‌ترین سررسید.",
  "Owed to suppliers": "بدهی به تأمین‌کننده‌ها",
  Overdue: "سررسید گذشته",
  "To pay": "برای پرداخت",
  "Nothing owed": "بدهی‌ای ندارید",
  "Invoices saved as “Credit (pay later)” appear here until they're marked paid.":
    "فاکتورهایی که «نسیه (پرداخت بعداً)» ذخیره شده‌اند تا وقتی پرداخت‌شده علامت بخورند اینجا می‌مانند.",
  Invoice: "فاکتور",
  "Overdue {date}": "سررسید گذشته {date}",
  "No due date": "بدون سررسید",
  "Recently paid": "پرداخت‌های اخیر",

  // Ingredient
  "Cheapest now": "ارزان‌ترین فعلی",
  "of {n} suppliers": "از بین {n} تأمین‌کننده",
  "Waste, staff meal or correction": "ضایعات، غذای کارکنان یا اصلاحیه",
  "By supplier": "بر اساس تأمین‌کننده",
  "Latest price from each supplier, cheapest first.": "آخرین قیمت هر تأمین‌کننده، از ارزان‌ترین.",
  Cheapest: "ارزان‌ترین",
  "Price history": "سابقه‌ی قیمت",
  "No purchases yet.": "هنوز خریدی ثبت نشده.",
  "Stock history": "سابقه‌ی موجودی",
  "Nothing yet.": "هنوز چیزی نیست.",
  Bought: "خرید",
  Used: "مصرف",
  Waste: "ضایعات",
  "Staff meal": "غذای کارکنان",
  Correction: "اصلاحیه",
  "Same ingredient saved twice? Move everything into the right one (both counted in {unit}).":
    "یک ماده‌ی اولیه دو بار ثبت شده؟ همه‌چیز را به مورد درست منتقل کنید (هر دو بر حسب {unit} شمرده می‌شوند).",

  // Ingredient and stock movement forms
  "Persian name": "نام فارسی",
  Type: "نوع",
  Food: "مواد غذایی",
  Packaging: "بسته‌بندی",
  "Ingredient saved": "ماده‌ی اولیه ذخیره شد",
  "What happened": "چه اتفاقی افتاد",
  "Waste (thrown away)": "ضایعات (دورریخته)",
  "Correction (+ or −)": "اصلاحیه (+ یا −)",
  "Amount ({unit})": "مقدار ({unit})",
  "Use − to remove": "برای کم کردن از − استفاده کنید",
  "Taken out of stock": "از موجودی کم می‌شود",
  Day: "روز",
  "e.g. burnt rice, expired": "مثلاً برنج سوخته، تاریخ‌گذشته",
  "Enter an amount": "مقدار را وارد کنید",
  "Stock updated": "موجودی به‌روز شد",

  // Errors from the stock and supplier APIs
  "Supplier not found.": "تأمین‌کننده پیدا نشد.",
  "Choose a different supplier.": "یک تأمین‌کننده‌ی دیگر انتخاب کنید.",
  "Ingredient not found.": "ماده‌ی اولیه پیدا نشد.",
  "Choose a different ingredient.": "یک ماده‌ی اولیه‌ی دیگر انتخاب کنید.",
  "Enter an amount.": "مقدار را وارد کنید.",
  "Use YYYY-MM-DD": "تاریخ را به شکل YYYY-MM-DD وارد کنید",
  "That record already exists.": "این مورد از قبل وجود دارد.",
  "A related record is missing or still in use.": "یک مورد مرتبط پیدا نشد یا هنوز در حال استفاده است.",

  // Opening stock
  "Opening stock": "موجودی اولیه",
  "Enter opening stock": "ثبت موجودی اولیه",
  "Everything that was already in the kitchen on the first day, once. After this, add that month's invoices — the stock then stays right on its own.":
    "یک بار، هر چیزی که روز اول در آشپزخانه بود. بعد فاکتورهای همان ماه را اضافه کنید؛ از آن به بعد انبار خودش درست می‌ماند.",
  "Starting out? Enter what is in the kitchen today as the opening stock, then add this month's invoices.":
    "تازه شروع می‌کنید؟ موجودی امروز آشپزخانه را به‌عنوان موجودی اولیه وارد کنید، بعد فاکتورهای این ماه را اضافه کنید.",
  "Stock on the morning of": "موجودی صبحِ روز",
  "Paste from Excel": "چسباندن از Excel",
  "One item per line: name, quantity, unit, price per unit": "هر قلم در یک خط: اسم، مقدار، واحد، قیمت هر واحد",
  "Copy the columns from Excel, or type e.g. “Sella rice, 200, kg, 5.25”. Units: kg, g, L, ml, pcs.":
    "ستون‌ها را از Excel کپی کنید یا بنویسید مثلاً «برنج سلا، 200، کیلو، 5.25». واحدها: کیلو، گرم، لیتر، ml، عدد.",
  "Add these lines": "افزودن این خط‌ها",
  "Nothing to add — check the lines": "چیزی برای افزودن نیست؛ خط‌ها را بررسی کنید",
  "{n} lines added — check them below": "{n} خط اضافه شد؛ پایین بررسی‌شان کنید",
  "Item {n}": "قلم {n}",
  "Sella rice": "برنج سلا",
  Amount: "مقدار",
  "Price per {unit} (ex VAT)": "قیمت هر {unit} (بدون VAT)",
  "Already has an opening stock — use a stock count instead": "موجودی اولیه‌اش قبلاً ثبت شده؛ به‌جایش از شمارش انبار استفاده کنید",
  "{name} already has an opening stock": "موجودی اولیه‌ی {name} قبلاً ثبت شده",
  "Add at least one item with an amount": "دست‌کم یک قلم با مقدار وارد کنید",
  "Save opening stock ({n})": "ذخیره‌ی موجودی اولیه ({n})",
  "Opening stock saved — {n} items": "موجودی اولیه ذخیره شد — {n} قلم",
  "Value {amount}": "ارزش {amount}",

  // Deleting unused ingredients
  "Delete ingredient": "حذف ماده",
  "Ingredient deleted": "ماده حذف شد",
  "Nothing uses it any more, so it can be deleted.": "دیگر چیزی از آن استفاده نمی‌کند، پس می‌شود حذفش کرد.",
  "It is used in {names}. Remove it from those recipes first.": "در {names} استفاده شده. اول از آن دستور پخت‌ها حذفش کنید.",
  "It is on an invoice that still counts. Undo that invoice first, or merge this ingredient into another.": "روی فاکتوری است که هنوز حساب می‌شود. اول آن فاکتور را برگردانید، یا این ماده را با ماده‌ی دیگری ادغام کنید.",
  "It has stock history (opening stock, counts, waste or sales). Merge it into another ingredient instead.": "سابقه‌ی انبار دارد (موجودی اول، شمارش، ضایعات یا فروش). به‌جای حذف، آن را با ماده‌ی دیگری ادغام کنید.",
  "Delete unused ({n})": "حذف بی‌استفاده‌ها ({n})",
  "Delete {n} ingredients nothing uses any more? {names}. This can't be undone.": "{n} ماده‌ای که دیگر استفاده نمی‌شوند حذف شوند؟ {names}. این کار برگشت‌پذیر نیست.",
  "{n} ingredients deleted": "{n} ماده حذف شد",
};
