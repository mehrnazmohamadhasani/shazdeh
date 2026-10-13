/** Persian for the admin orders screens. English text → Persian; see ../index.ts. */
export const orders: Record<string, string> = {
  // Orders board — control bar
  Order: "سفارش",
  "Now accepting orders": "سفارش آنلاین باز شد",
  "Online ordering paused": "سفارش آنلاین متوقف است",
  "Couldn't change ordering status": "وضعیت سفارش آنلاین عوض نشد",
  "Accepting online orders": "سفارش آنلاین باز است",
  "Pause when the kitchen is overloaded.": "وقتی آشپزخانه شلوغ است، متوقفش کنید.",
  "Ringing — accept, or tap “Got it”, to stop": "زنگ می‌زند — برای قطع، سفارش را قبول کنید یا «دیدم» را بزنید",
  "Order alarm on": "زنگ سفارش روشن است",
  "Print tickets automatically on this device": "چاپ خودکار تیکت روی این دستگاه",

  // Orders board — tabs and columns
  "Active · {n}": "فعال · {n}",
  "Completed today": "تمام‌شده‌ی امروز",
  History: "سوابق",
  "In the kitchen": "در آشپزخانه",
  "Nothing here": "خالی است",
  "Order number, phone or name": "شماره سفارش، موبایل یا نام",
  Newer: "جدیدتر",
  Older: "قدیمی‌تر",
  "Page {page} of {pages}": "صفحه‌ی {page} از {pages}",

  // Orders board — order card
  "Collect cash": "نقد بگیرید",
  "Card at door": "کارت دم در",
  "{n} min": "{n} دقیقه",
  "Note:": "یادداشت:",
  Cutlery: "قاشق و چنگال",
  "Got it": "دیدم",
  Reject: "رد",
  "Print tickets for {number}": "چاپ تیکت‌های {number}",
  "Print kitchen + delivery tickets": "چاپ تیکت آشپزخانه و پیک",

  // Orders board — history table
  "No orders.": "سفارشی نیست.",
  Placed: "زمان ثبت",
  Customer: "مشتری",

  // Reject / cancel dialog (preset reasons: only the label is translated; the English is sent to the customer)
  "Reject {number}?": "{number} رد شود؟",
  "Cancel {number}?": "{number} لغو شود؟",
  "Reject order": "رد سفارش",
  "Cancel order": "لغو سفارش",
  "The customer sees this reason.": "مشتری این دلیل را می‌بیند.",
  "Kitchen is too busy right now": "آشپزخانه الان خیلی شلوغ است",
  "An item is sold out": "یکی از غذاها تمام شده",
  "Address is outside our delivery area": "آدرس خارج از منطقه‌ی ارسال است",
  "Couldn't reach the customer": "به مشتری دسترسی پیدا نکردیم",
  "Or write a short reason": "یا یک دلیل کوتاه بنویسید",

  // Dispatch dialog
  "Dispatch order": "ارسال سفارش با پیک",
  "Optional details. The customer sees the rider's first name and any courier tracking link.":
    "این اطلاعات اختیاری است. مشتری اسم کوچک پیک و لینک پیگیری شرکت پیک را می‌بیند.",
  "Own rider": "پیک خودمان",
  "Courier partner": "شرکت پیک",
  "Rider name": "نام پیک",
  "Rider phone": "موبایل پیک",
  "Courier booking reference": "کد رزرو شرکت پیک",
  "Courier tracking link": "لینک پیگیری شرکت پیک",
  "Send out": "ارسال",

  // Order detail — header and items
  "All orders": "همه‌ی سفارش‌ها",
  "{status} · placed {time}": "{status} · ثبت {time}",
  "Reason: {reason}": "دلیل: {reason}",
  "Alarm stopped": "زنگ قطع شد",
  "Print tickets": "چاپ تیکت",
  Items: "غذاها",
  "Sold out…": "تمام شده…",
  "Kitchen note:": "یادداشت برای آشپزخانه:",
  "Include cutlery and napkins": "قاشق، چنگال و دستمال بگذارید",
  "No cutlery": "بدون قاشق و چنگال",
  Subtotal: "جمع غذاها",
  "Delivery ({zone})": "هزینه‌ی ارسال ({zone})",
  "Service fee": "هزینه‌ی خدمات",
  "Promo {code}": "کد تخفیف {code}",
  "VAT included": "شامل مالیات (VAT)",

  // Order detail — payment
  Payment: "پرداخت",
  "{status} — collect {amount}": "{status} — {amount} بگیرید",
  "Mark as paid": "پرداخت شد",
  "Marked as paid": "پرداخت ثبت شد",

  // Order detail — customer and address
  "{n} previous delivered order": "{n} سفارش قبلی تحویل‌شده",
  "{n} previous delivered orders": "{n} سفارش قبلی تحویل‌شده",
  "First order": "اولین سفارش",
  Apartment: "آپارتمان",
  Villa: "ویلا",
  Office: "دفتر",
  "Unit {unit}": "واحد {unit}",
  "Floor {floor}": "طبقه‌ی {floor}",
  "Open in Maps": "باز کردن در نقشه",
  "(customer shared location)": "(مشتری موقعیتش را فرستاده)",

  // Order detail — delivery
  Delivery: "ارسال",
  "Promised {min}–{max} min · by {time}": "قول {min} تا {max} دقیقه · تا {time}",
  Courier: "شرکت پیک",
  Rider: "پیک",
  "Estimate updated": "زمان تحویل به‌روز شد",
  "Running late +10 min": "تأخیر داریم +10 دقیقه",
  "Customer's tracking page": "صفحه‌ی پیگیری مشتری",
  Dispatched: "با پیک ارسال شد",

  // Order detail — timeline
  Timeline: "تاریخچه",
  "Note added": "یادداشت اضافه شد",
  "Add an internal note (not visible to the customer)": "یادداشت داخلی بنویسید (مشتری نمی‌بیند)",

  // Sold-out dialog
  "{dish} is sold out": "{dish} تمام شده",
  "We'll take it off this order, lower the total and tell the customer. A quick call first is kind.":
    "آن را از سفارش برمی‌داریم، مبلغ را کم می‌کنیم و به مشتری خبر می‌دهیم. بهتر است اول یک تماس کوتاه بگیرید.",
  "They paid online — refund the difference from the payment dashboard.":
    "مشتری آنلاین پرداخت کرده — مابه‌التفاوت را از داشبورد پرداخت برگردانید.",
  "How many can we still make?": "چندتا را هنوز می‌توانیم درست کنیم؟",
  "(ordered {n})": "(سفارش: {n})",
  "Also mark it sold out on the menu": "در منو هم «تمام شده» شود",
  "So no one else can order it. Switch it back on in Menu.": "تا کس دیگری سفارشش ندهد. بعداً از بخش منو دوباره روشنش کنید.",
  "This is the only dish on the order — reject or cancel it instead.": "این تنها غذای سفارش است — به‌جایش سفارش را رد یا لغو کنید.",
  "Reject / cancel order": "رد / لغو سفارش",
  "Remove {n}× from order": "حذف {n}× از سفارش",
  "Removed {n}× {dish} — customer notified": "{n}× {dish} حذف شد — به مشتری خبر داده شد",

  // Order alarm
  "New order {number}": "سفارش جدید {number}",
  "New order {number} (+{more})": "سفارش جدید {number} (+{more})",
  "New order {number} · {name}": "سفارش جدید {number} · {name}",
  "{n} new orders waiting": "{n} سفارش جدید منتظر است",
  "Printing {number}": "در حال چاپ {number}…",
  "Open orders": "باز کردن سفارش‌ها",
  "Tap to switch on the order alarm": "برای روشن شدن زنگ سفارش، بزنید",
  "Your browser keeps sound off until you tap. The alarm rings for every new order until it is accepted.":
    "مرورگر تا وقتی صفحه را لمس نکنید صدا را خاموش نگه می‌دارد. زنگ برای هر سفارش جدید تا وقتی قبول نشود می‌زند.",

  // Errors from the orders API
  "Couldn't update the order": "سفارش به‌روز نشد",
  "Connection problem — try again": "اتصال مشکل دارد — دوباره امتحان کنید",
  "Please give the customer a reason.": "لطفاً یک دلیل برای مشتری بنویسید.",
  "Order not found": "سفارش پیدا نشد",
  "This order was just updated by someone else — refresh and try again.":
    "همین الان کس دیگری این سفارش را تغییر داد — صفحه را تازه کنید و دوباره امتحان کنید.",
  "Dishes can only be removed before the order is ready.": "غذا را فقط قبل از آماده شدن سفارش می‌شود حذف کرد.",
  "That dish isn't on this order.": "این غذا در این سفارش نیست.",
  "Choose fewer than the customer ordered.": "تعدادی کمتر از سفارش مشتری انتخاب کنید.",
  "Nothing would be left — reject or cancel the order instead.": "چیزی باقی نمی‌ماند — به‌جایش سفارش را رد یا لغو کنید.",
  "Only pay-on-delivery orders can be marked paid by hand.": "فقط سفارش‌های پرداخت هنگام تحویل را می‌شود دستی پرداخت‌شده زد.",
  "Unknown delivery method": "روش ارسال نامعتبر است",
  "Something went wrong on our side. Please try again.": "مشکلی از طرف ما پیش آمد. لطفاً دوباره امتحان کنید.",
  "A related record is missing or still in use.": "یک مورد مرتبط پیدا نشد یا هنوز در حال استفاده است.",

  // Stored timeline messages with fixed wording (shown via tData)
  "Order placed": "سفارش ثبت شد",
  "Order created — waiting for online payment": "سفارش ساخته شد — در انتظار پرداخت آنلاین",
  "Payment collected on delivery": "پرداخت هنگام تحویل دریافت شد",
  "Online payment received": "پرداخت آنلاین دریافت شد",
  "Online payment captured — refund it from the payment gateway dashboard.": "پرداخت آنلاین انجام شده — مبلغ را از داشبورد درگاه پرداخت بازگردانید.",
};
