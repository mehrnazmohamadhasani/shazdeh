/*
 * Browsers hand us a push endpoint URL that the server later POSTs to.
 * Only accept the real browser push services, so a visitor can't make
 * the server send requests to an arbitrary (or internal) host.
 */

const EXACT_HOSTS = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com"]);
// Safari (web.push.apple.com) and Edge (wns2-*.notify.windows.com).
const HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com", ".wns.windows.com"];

export function isPushServiceUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || HOST_SUFFIXES.some((s) => host.endsWith(s));
}
