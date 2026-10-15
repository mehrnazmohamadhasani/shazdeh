/*
 * Whether a stored document can be read again. Uploads are recognised by
 * their bytes, so a photo that was discarded, failed, or got stuck while
 * reading would otherwise open a dead end when uploaded a second time.
 */

/** A reading still "in progress" after this long was cut off (the request timed out). */
export const STUCK_MS = 10 * 60_000;

/** Discarded, failed or stuck: may be read again. Saved or waiting for review: left as it is. */
export function canReadAgain(doc: { status: string; updatedAt: Date }, now = new Date()) {
  if (doc.status === "DISCARDED" || doc.status === "FAILED") return true;
  return doc.status === "PROCESSING" && now.getTime() - doc.updatedAt.getTime() > STUCK_MS;
}
