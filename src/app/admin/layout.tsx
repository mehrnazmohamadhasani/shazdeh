import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminSidebar, AdminMobileBar } from "@/components/admin/sidebar";
import { OrderAlarm } from "@/components/admin/orders/order-alarm";
import { AdminI18nProvider } from "@/components/admin/i18n";
import { vapidPublicKey } from "@/lib/notifications/push";
import { getAdminLocale } from "@/lib/admin-i18n/server";
import { roleHome, roleMayOpen } from "@/lib/roles";

export async function generateMetadata(): Promise<Metadata> {
  const fa = (await getAdminLocale()) === "fa";
  return {
    title: fa
      ? { default: "پنل مدیریت · SHĀZDEH", template: "%s · پنل SHĀZDEH" }
      : { default: "Admin · SHĀZDEH", template: "%s · SHĀZDEH Admin" },
    robots: { index: false, follow: false },
  };
}

// Match the browser / installed-app chrome to the light admin.
export const viewport: Viewport = {
  themeColor: "#fdf6ec",
  colorScheme: "light",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, locale] = await Promise.all([requireAdmin(), getAdminLocale()]);
  // The proxy checks the token's role; this re-checks the current role
  // from the database so a demotion applies on the next page load.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!roleMayOpen(user.role, pathname)) {
    redirect(roleHome(user.role));
  }

  return (
    <AdminI18nProvider locale={locale}>
      <div
        lang={locale}
        dir={locale === "fa" ? "rtl" : "ltr"}
        className="admin-root flex min-h-screen bg-warm-white text-black-iron"
      >
        <AdminSidebar user={user} />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminMobileBar user={user} />
          <OrderAlarm vapidPublicKey={vapidPublicKey()} />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </AdminI18nProvider>
  );
}
