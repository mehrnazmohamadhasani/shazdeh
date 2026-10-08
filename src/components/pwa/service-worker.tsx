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

function promptRefresh(worker: ServiceWorker) {
  toast("A new version of SHĀZDEH is ready.", {
    id: "sw-update",
    duration: Infinity,
    action: {
      label: "Refresh",
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
    const offline = () =>
      toast("You're offline", {
        id: OFFLINE_TOAST,
        description:
          "Pages you've opened before still work. Ordering and tracking need a connection.",
        duration: Infinity,
      });
    const online = () => {
      toast.dismiss(OFFLINE_TOAST);
      toast.success("Back online", { duration: 2500 });
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
