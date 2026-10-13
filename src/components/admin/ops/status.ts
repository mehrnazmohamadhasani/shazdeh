/** How each document status reads in the admin. */
export const DOC_STATUS: Record<string, { label: string; tone: "neutral" | "good" | "warn" | "bad" | "accent" }> = {
  PROCESSING: { label: "Reading…", tone: "neutral" },
  NEEDS_REVIEW: { label: "Check & save", tone: "accent" },
  SAVED: { label: "Saved", tone: "good" },
  FAILED: { label: "Couldn't read", tone: "bad" },
  DISCARDED: { label: "Discarded", tone: "neutral" },
};
