/**
 * Current `pg` treats sslmode=require|prefer|verify-ca as verify-full and
 * emits a process warning. Next.js surfaces that warning as a dev overlay.
 * Keep the strict check explicit so the warning never fires.
 */
export function pgConnectionString(connectionString: string): string {
  return connectionString.replace(
    /([?&])sslmode=(?:prefer|require|verify-ca)(?=&|$)/g,
    "$1sslmode=verify-full",
  );
}
