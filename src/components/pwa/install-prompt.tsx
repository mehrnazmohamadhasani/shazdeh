"use client";
import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/*
 * A quiet "install the app" card.
 *
 *  – Chrome / Edge (Android, desktop): uses the browser's own install
 *    flow via `beforeinstallprompt`. We only decide *when* to offer it.
 *  – iOS / iPadOS Safari: there is no install API, so the card explains
 *    Share → Add to Home Screen.
 *  – Everywhere else (Firefox, macOS Safari, in-app browsers): nothing.
 *    Browsers that can install keep their own menu entry.
 *
 * It waits for real interest (a second page, or ~20s on the first), never
 * shows while already installed, and a dismissal is remembered for 90 days.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "shazdeh.install.dismissedAt";
const SNOOZE_MS = 90 * 24 * 60 * 60 * 1000;
const ENGAGED_AFTER_MS = 20_000;

function readDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (raw === "installed") return true;
    const at = Number(raw);
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function remember(value: number | "installed" = Date.now()) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(value));
  } catch {
    // Private mode — the card simply may show again next visit.
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari before display-mode support
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const iOS =
    /iP(hone|od|ad)/.test(ua) ||
    // iPadOS reports itself as a Mac
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Other iOS browsers and in-app web views can't add to the home screen
  // the same way, so the Safari instructions would be wrong there.
  return iOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram|Line\//.test(ua);
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [mode, setMode] = React.useState<"prompt" | "ios" | null>(null);
  const [engaged, setEngaged] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);
  const deferred = React.useRef<BeforeInstallPromptEvent | null>(null);
  const firstPath = React.useRef(pathname);

  // Eligibility + the browser's install event.
  React.useEffect(() => {
    if (isStandalone() || readDismissed()) return;

    const onPrompt = (e: Event) => {
      // Keep Chrome's own mini-infobar from popping up on first paint;
      // we offer the same prompt once the visitor has shown interest.
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setMode("prompt");
    };
    const onInstalled = () => {
      deferred.current = null;
      remember("installed");
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const timer = window.setTimeout(() => {
      setEngaged(true);
      if (isIosSafari()) setMode((m) => m ?? "ios");
    }, ENGAGED_AFTER_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  // A second page counts as interest too.
  React.useEffect(() => {
    if (pathname === firstPath.current) return;
    const id = window.setTimeout(() => {
      setEngaged(true);
      if (!isStandalone() && !readDismissed() && isIosSafari()) {
        setMode((m) => m ?? "ios");
      }
    }, 1500);
    return () => window.clearTimeout(id);
  }, [pathname]);

  if (!mode || !engaged || hidden) return null;

  function dismiss() {
    remember();
    setHidden(true);
  }

  async function install() {
    const evt = deferred.current;
    if (!evt) return;
    deferred.current = null;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    // Accepted → `appinstalled` follows. Declined → treat as "not now".
    if (outcome === "dismissed") remember();
    setHidden(true);
  }

  return (
    <aside
      aria-label="Install the SHĀZDEH app"
      className="animate-rise fixed inset-x-3 bottom-[calc(0.75rem+var(--safe-bottom)+var(--tabbar-h))] z-40 sm:inset-x-auto sm:left-6 sm:bottom-6 sm:w-[380px]"
    >
      <div className="flex gap-4 rounded-[18px] border border-black-iron/10 bg-warm-white/95 p-4 pr-3 text-black-iron shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] backdrop-blur">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-[12px]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-tight">Install SHĀZDEH</p>
          {mode === "prompt" ? (
            <>
              <p className="mt-1 text-[13px] leading-[1.5] text-dark-grey">
                Install this app for a faster, app-like experience.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={install}>
                  Install
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>
                  Not now
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-[13px] leading-[1.55] text-dark-grey">
              Install this app for a faster, app-like experience: tap{" "}
              <Share className="inline h-4 w-4 -translate-y-px text-black-iron" strokeWidth={1.7} aria-label="Share" />{" "}
              then <span className="whitespace-nowrap font-medium text-black-iron">
                <SquarePlus className="inline h-4 w-4 -translate-y-px" strokeWidth={1.7} aria-hidden /> Add to Home Screen
              </span>
              .
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-dark-grey transition-colors hover:bg-black-iron/[0.05] hover:text-black-iron"
        >
          <X className="h-4 w-4" strokeWidth={1.6} />
        </button>
      </div>
    </aside>
  );
}
