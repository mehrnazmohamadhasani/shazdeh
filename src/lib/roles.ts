/*
 * Which admin screens the limited roles may open. Shared by the proxy
 * (token role), the admin layout (role re-read from the database) and the
 * sidebar, so the three always agree. ADMIN and EDITOR see everything
 * their own pages allow.
 */

export const LIMITED_ROLE_PATHS: Record<string, string[]> = {
  // Kitchen tablets: the order board only.
  STAFF: ["/admin/orders"],
  // The person who buys and counts: invoices, stock and suppliers, and
  // platform receipts (to upload and save — not the sales totals or fees).
  // The assistant answers and acts within the same limits (its tools check the role too).
  PURCHASER: ["/admin/ops/invoices", "/admin/ops/stock", "/admin/ops/ingredients", "/admin/ops/suppliers", "/admin/ops/sales/receipts", "/admin/ops/assistant"],
};

/** Where a role lands after signing in, or when it opens a screen it may not see. */
export function roleHome(role: string): string {
  return LIMITED_ROLE_PATHS[role]?.[0] ?? "/admin";
}

export function roleMayOpen(role: string, pathname: string): boolean {
  const paths = LIMITED_ROLE_PATHS[role];
  return !paths || paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
