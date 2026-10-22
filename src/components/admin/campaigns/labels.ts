/** English labels (translated with t()) shared by the campaign screens. */
export const AUDIENCE_LABEL: Record<string, string> = {
  marketing: "Everyone who agreed to offers",
  lapsed: "No order in 30+ days",
  gift_no_order: "Gift claimed, never ordered",
};

export const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "accent"> = {
  DRAFT: "neutral",
  SENDING: "accent",
  SENT: "good",
  FAILED: "bad",
};
