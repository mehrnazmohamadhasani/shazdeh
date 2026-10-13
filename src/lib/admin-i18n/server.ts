import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, createAdminI18n, parseAdminLocale } from ".";

/** The admin language this browser chose (English until switched). */
export async function getAdminLocale() {
  return parseAdminLocale((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
}

/** `t`, `money`, `date`… for server components and `generateMetadata`. */
export async function getAdminI18n() {
  return createAdminI18n(await getAdminLocale());
}
