import "server-only";

/*
 * One place for unexpected server errors. Every error is written as a
 * single JSON log line (searchable in the host's logs as "server_error").
 * If ERROR_ALERT_WEBHOOK_URL is set — a Slack, Discord or Google Chat
 * incoming webhook — a short alert is posted there too, at most once per
 * distinct error every 10 minutes per server instance.
 */

const ALERT_EVERY_MS = 10 * 60_000;
const lastAlert = new Map<string, number>();

export type ErrorContext = { where: string; method?: string; path?: string; digest?: string };

function describe(err: unknown): { name: string; message: string; code?: string; cause?: string; stack?: string } {
  if (!(err instanceof Error)) return { name: "NonError", message: String(err) };
  // Prisma errors keep the useful part (e.g. "DatabaseNotReachable") in
  // the code and the driver adapter's cause, not in the message.
  const e = err as Error & { code?: unknown; meta?: { driverAdapterError?: { cause?: { kind?: unknown; message?: unknown } } } };
  const adapter = e.meta?.driverAdapterError?.cause;
  const cause = adapter ? [adapter.kind, adapter.message].filter(Boolean).join(": ") : err.cause instanceof Error ? err.cause.message : undefined;
  return {
    name: err.name,
    message: err.message.replace(/\s+/g, " ").trim(),
    code: typeof e.code === "string" ? e.code : undefined,
    cause: cause || undefined,
    stack: err.stack?.split("\n").slice(0, 8).join("\n"),
  };
}

export async function reportError(err: unknown, context: ErrorContext): Promise<void> {
  const e = describe(err);
  console.error(JSON.stringify({ level: "error", event: "server_error", ...context, ...e, at: new Date().toISOString() }));

  const url = process.env.ERROR_ALERT_WEBHOOK_URL?.trim();
  if (!url) return;
  const fingerprint = `${context.where}|${e.name}|${e.message.slice(0, 200)}`;
  const now = Date.now();
  if ((lastAlert.get(fingerprint) ?? 0) > now - ALERT_EVERY_MS) return;
  lastAlert.set(fingerprint, now);
  if (lastAlert.size > 500) lastAlert.clear();

  const detail = [e.code, e.cause].filter(Boolean).join(" · ");
  const text = `⚠️ SHĀZDEH server error in ${context.where}${context.path ? ` (${context.method ?? ""} ${context.path})` : ""}: ${e.name}: ${e.message.slice(0, 300)}${detail ? ` [${detail.slice(0, 200)}]` : ""}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Slack and Google Chat read "text", Discord reads "content".
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (alertErr) {
    console.error("[report-error] alert webhook failed", alertErr);
  }
}
