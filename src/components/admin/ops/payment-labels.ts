/** Payment receipt types and their labels — shared by the Payment box and server pages. */
export type ReceiptKind = "card" | "bank" | "card_to_card";
export const RECEIPT_LABEL: Record<ReceiptKind, string> = { card: "Card receipt", bank: "Bank receipt", card_to_card: "Card-to-card" };
