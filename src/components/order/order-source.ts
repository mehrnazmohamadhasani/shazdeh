"use client";

/*
 * Orders that start from the link sent on WhatsApp (shazdeh.ae/order?src=whatsapp)
 * are counted as WhatsApp orders in Sales. The mark is kept for this tab
 * only, from the menu to checkout; anything else is a website order.
 */

const KEY = "shazdeh-order-source";

/** Call on the order pages: remembers ?src=whatsapp if the link had it. */
export function rememberOrderSource() {
  try {
    const src = new URLSearchParams(window.location.search).get("src");
    if (src === "whatsapp") sessionStorage.setItem(KEY, "whatsapp");
  } catch {
    // Storage blocked: the order is simply counted as a website order.
  }
}

export function orderSource(): "whatsapp" | undefined {
  try {
    return sessionStorage.getItem(KEY) === "whatsapp" ? "whatsapp" : undefined;
  } catch {
    return undefined;
  }
}
