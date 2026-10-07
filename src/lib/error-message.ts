/** User-facing text from API bodies, thrown values, or Error (never "[object Object]"). */
export function messageFromUnknown(
  value: unknown,
  fallback = "Something went wrong",
): string {
  if (value == null || value === "") return fallback;
  if (typeof value === "string") return value;
  if (value instanceof Error) {
    const nested = messageFromUnknown(value.message, "");
    return nested || fallback;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string" && record.message) {
      return record.message;
    }
    if (record.error != null) {
      const nested = messageFromUnknown(record.error, "");
      if (nested) return nested;
    }
  }
  return fallback;
}

export function messageFromApiJson(
  body: unknown,
  fallback: string,
): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { error?: unknown; issues?: unknown };
  if (b.error != null) {
    const msg = messageFromUnknown(b.error, "");
    if (msg) return msg;
  }
  if (b.issues) return `${fallback} (validation failed)`;
  return null;
}
