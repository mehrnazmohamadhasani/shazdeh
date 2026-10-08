import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/*
 * Web Push (VAPID). Switched on by three env vars:
 *
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY   npx web-push generate-vapid-keys
 *   VAPID_SUBJECT                          mailto:orders@your-domain
 *
 * Works in Chrome/Edge/Firefox on desktop and Android, and on iPhone
 * only once the site is added to the Home Screen (iOS 16.4+).
 */

export type PushPayload = { title: string; body: string; url: string; tag?: string; requireInteraction?: boolean };

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

let configured: boolean | null = null;
function configure() {
  if (configured !== null) return configured;
  const pub = vapidPublicKey();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:orders@shazdeh.ae";
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(subject, pub!, priv!);
  return configured;
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

/** Sends to each subscription; drops the ones the browser has revoked. Returns how many were delivered. */
export async function sendPush(subs: Sub[], payload: PushPayload): Promise<number | "skipped"> {
  if (!configure()) return "skipped";
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 60,
          urgency: "high",
          timeout: 5000,
        });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          console.error("[push]", code ?? e);
        }
      }
    }),
  );
  return sent;
}
