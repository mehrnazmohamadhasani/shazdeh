"use client";
import * as React from "react";
import { toast } from "sonner";

/*
 * Registers the service worker (production only) and surfaces the two
 * things the user should know about it:
 *
 *  – a new version is ready → offer a refresh instead of swapping the
 *    page underneath them (a checkout in progress must never reload by
 *    itself);
 *  – the connection dropped / came back.
 *
 * In development any worker left over from a production run on the same
 * origin is removed, so it can't serve stale chunks against HMR.
 */

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
const OFFLINE_TOAST = "network-offline";

/*
 * This sits in the root layout, outside the admin's i18n provider, so it
 * reads the panel's language from the page: staff get admin wording (in
 * Persian when the panel is), guests get the site's.
 */
const MESSAGES = {
  site: {
    update: "A new version of SHĀZDEH is ready.",
    refresh: "Refresh",
    offline: "You're offline",
    offlineHint: "Pages you've opened before still work. Ordering and tracking need a connection.",
    online: "Back online",
  },
  admin: {
    update: "A new version of the panel is ready.",
    refresh: "Refresh",
    offline: "You're offline",
    offlineHint: "Changes can't be saved until the connection is back.",
    online: "Back online",
  },
  adminFa: {
    update: "نسخه‌ی تازه‌ی پنل آماده است.",
    refresh: "تازه‌سازی",
    offline: "اتصال اینترنت قطع است",
    offlineHint: "تا اتصال برنگردد، تغییرات ذخیره نمی‌شوند.",
    online: "اتصال برقرار شد",
  },
};

function messages() {
  const admin = document.querySelector(".admin-root");
  if (!admin) return MESSAGES.site;
  return admin.getAttribute("lang") === "fa" ? MESSAGES.adminFa : MESSAGES.admin;
}

function promptRefresh(worker: ServiceWorker) {
  const m = messages();
  toast(m.update, {
    id: "sw-update",
    duration: Infinity,
    action: {
      label: m.refresh,
      onClick: () => worker.postMessage({ type: "SKIP_WAITING" }),
    },
  });
}

function useServiceWorker() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }

    let refreshing = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      // Fires after the user accepted the refresh (or on the very first
      // install, when there was no controller to replace — skip that one).
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = () =>
      navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(VERSION)}`, {
          scope: "/",
          updateViaCache: "none",
        })
        .then((reg) => {
          if (reg.waiting && navigator.serviceWorker.controller) {
            promptRefresh(reg.waiting);
          }
          reg.addEventListener("updatefound", () => {
            const next = reg.installing;
            next?.addEventListener("statechange", () => {
              if (next.state === "installed" && navigator.serviceWorker.controller) {
                promptRefresh(next);
              }
            });
          });
        })
        .catch(() => {
          // No worker means no offline support — the site works as before.
        });

    // Don't compete with the first paint for bandwidth.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("load", register);
    };
  }, []);
}

function useNetworkStatus() {
  React.useEffect(() => {
    const offline = () => {
      const m = messages();
      toast(m.offline, { id: OFFLINE_TOAST, description: m.offlineHint, duration: Infinity });
    };
    const online = () => {
      toast.dismiss(OFFLINE_TOAST);
      toast.success(messages().online, { duration: 2500 });
    };
    if (!navigator.onLine) offline();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);
}

export function ServiceWorker() {
  useServiceWorker();
  useNetworkStatus();
  return null;
}
