"use client";
import * as React from "react";

/*
 * Kitchen alerts beyond the chime: desktop notifications and keeping the
 * screen awake. Both degrade silently where the browser can't do them.
 */

/** Asks once (must run from a click); true when notifications may show. */
export async function requestNotifications(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

/**
 * Shows a system notification that stays until dismissed. Goes through the
 * service worker when there is one — Android Chrome only allows that — and
 * falls back to the page-level API (desktop, `next dev`).
 */
export async function notifyNewOrder(title: string, body: string, tag: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body,
    tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    requireInteraction: true,
    data: { url: "/admin/orders" },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Blocked or unsupported — the chime and toast still fire.
  }
}

/**
 * Holds a screen wake lock while `enabled`. The browser drops the lock
 * whenever the tab is hidden, so it is re-acquired on return.
 * Returns whether the lock is currently held.
 */
export function useWakeLock(enabled: boolean) {
  const [held, setHeld] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        setHeld(true);
        lock.addEventListener("release", () => setHeld(false));
      } catch {
        // Low battery / power-saver can refuse; nothing to do.
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [enabled]);

  return enabled && held;
}
