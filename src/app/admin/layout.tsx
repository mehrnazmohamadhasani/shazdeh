import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminSidebar, AdminMobileBar } from "@/components/admin/sidebar";
import { OrderAlarm } from "@/components/admin/orders/order-alarm";
import { vapidPublicKey } from "@/lib/notifications/push";

export const metadata: Metadata = {
  title: { default: "Admin · SHĀZDEH", template: "%s · SHĀZDEH Admin" },
  robots: { index: false, follow: false },
};

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
  const user = await requireAdmin();
  // The proxy checks the token's role; this re-checks the current role
  // from the database so a demotion applies on the next page load.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (user.role === "STAFF" && !pathname.startsWith("/admin/orders")) {
    redirect("/admin/orders");
  }

  return (
    <div className="flex min-h-screen bg-warm-white text-black-iron">
      <AdminSidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminMobileBar user={user} />
        <OrderAlarm vapidPublicKey={vapidPublicKey()} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
