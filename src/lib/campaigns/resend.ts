import "server-only";

/*
 * The few Resend marketing endpoints campaigns use: contacts, one
 * segment, and Broadcasts. Uses RESEND_CAMPAIGN_API_KEY (a Full access
 * key); order emails keep their own sending-only key. Requests are paced
 * under Resend's 10 per second limit.
 */

const API = "https://api.resend.com";
const GAP_MS = 120;
let lastCall = 0;

export class ResendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
  const key = process.env.RESEND_CAMPAIGN_API_KEY?.trim();
  if (!key) throw new ResendError("RESEND_CAMPAIGN_API_KEY is not set", 0);
  const wait = lastCall + GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    return call(method, path, body, attempt + 1);
  }
  if (!res.ok) throw new ResendError(`Resend ${method} ${path.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 300)}`, res.status);
  return (await res.json()) as T;
}

export type ResendContact = { id: string; email: string; unsubscribed: boolean };

async function listAll<T extends { id: string }>(path: string): Promise<T[]> {
  const out: T[] = [];
  let after: string | null = null;
  for (let page = 0; page < 200; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const res: { data: T[]; has_more: boolean } = await call("GET", `${path}${sep}limit=100${after ? `&after=${after}` : ""}`);
    out.push(...res.data);
    if (!res.has_more || res.data.length === 0) break;
    after = res.data[res.data.length - 1].id;
  }
  return out;
}

export const resend = {
  contacts: () => listAll<ResendContact>("/contacts"),
  segmentContacts: (segmentId: string) => listAll<ResendContact>(`/segments/${segmentId}/contacts`),
  async ensureSegment(name: string): Promise<string> {
    const segments = await listAll<{ id: string; name: string }>("/segments");
    const found = segments.find((s) => s.name === name);
    if (found) return found.id;
    return (await call<{ id: string }>("POST", "/segments", { name })).id;
  },
  createContact: (email: string, firstName: string | null, segmentId: string) =>
    call<{ id: string }>("POST", "/contacts", {
      email,
      ...(firstName ? { first_name: firstName } : {}),
      unsubscribed: false,
      segments: [{ id: segmentId }],
    }),
  addToSegment: (contact: string, segmentId: string) =>
    call("POST", `/contacts/${encodeURIComponent(contact)}/segments/${segmentId}`),
  removeFromSegment: (contact: string, segmentId: string) =>
    call("DELETE", `/contacts/${encodeURIComponent(contact)}/segments/${segmentId}`),
  sendBroadcast: (b: { segmentId: string; from: string; replyTo: string | null; subject: string; html: string; text: string; name: string }) =>
    call<{ id: string }>("POST", "/broadcasts", {
      segment_id: b.segmentId,
      from: b.from,
      ...(b.replyTo ? { reply_to: b.replyTo } : {}),
      subject: b.subject,
      html: b.html,
      text: b.text,
      name: b.name,
      send: true,
    }),
  broadcast: (id: string) => call<{ id: string; status: string; sent_at: string | null }>("GET", `/broadcasts/${id}`),
  sendEmail: (e: { from: string; to: string; replyTo: string | null; subject: string; html: string; text: string }) =>
    call<{ id: string }>("POST", "/emails", {
      from: e.from,
      to: e.to,
      ...(e.replyTo ? { reply_to: e.replyTo } : {}),
      subject: e.subject,
      html: e.html,
      text: e.text,
    }),
};
