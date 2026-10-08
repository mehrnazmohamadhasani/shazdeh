"use client";
import * as React from "react";

/*
 * Printing the kitchen + delivery tickets from a hidden iframe, so the
 * board stays where it is. Browsers always show a print dialog — except
 * Chrome/Edge started with --kiosk-printing, which prints straight to
 * the default printer (see docs/ordering/README.md → "Printing tickets").
 */

const AUTO_PRINT_KEY = "shazdeh.kitchen.autoprint";
const AUTO_PRINT_EVENT = "shazdeh:autoprint";

let queue: Promise<void> = Promise.resolve();

function printOnce(orderId: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // Give the spooler a moment before the document disappears.
      setTimeout(() => frame.remove(), 1000);
      resolve();
    };
    frame.onload = () => {
      const w = frame.contentWindow;
      if (!w) return finish();
      w.addEventListener("afterprint", finish);
      w.focus();
      w.print(); // blocks until the dialog closes, except with kiosk printing
      setTimeout(finish, 60_000);
    };
    frame.onerror = finish;
    frame.src = `/api/admin/orders/${orderId}/tickets`;
    document.body.appendChild(frame);
  });
}

/** Prints both tickets. Calls queue up so dialogs never overlap. */
export function printTickets(orderId: string): Promise<void> {
  queue = queue.then(() => printOnce(orderId));
  return queue;
}

/**
 * Marks the order printed on the server. True only for the first caller,
 * so two auto-printing devices never print the same order twice.
 */
export async function claimPrint(orderId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claimPrint" }),
    });
    return res.ok && ((await res.json()) as { claimed: boolean }).claimed;
  } catch {
    return false;
  }
}

function readAutoPrint() {
  try {
    return window.localStorage.getItem(AUTO_PRINT_KEY) === "on";
  } catch {
    return false;
  }
}

/** Per-device "print tickets automatically" — only the device next to the printer should have it on. */
export function useAutoPrint(): [boolean, (on: boolean) => void] {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const sync = () => setOn(readAutoPrint());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(AUTO_PRINT_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(AUTO_PRINT_EVENT, sync);
    };
  }, []);
  const set = React.useCallback((value: boolean) => {
    try {
      window.localStorage.setItem(AUTO_PRINT_KEY, value ? "on" : "off");
    } catch {
      // Private mode: the setting lasts until reload.
    }
    setOn(value);
    window.dispatchEvent(new Event(AUTO_PRINT_EVENT));
  }, []);
  return [on, set];
}
