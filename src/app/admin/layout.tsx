import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminSidebar, AdminMobileBar } from "@/components/admin/sidebar";

export const metadata: Metadata = {
  title: { default: "Atelier · SHĀZDEH", template: "%s · Atelier" },
  robots: { index: false, follow: false },
};

// The Atelier is dark: match the browser / installed-app chrome to it.
export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
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
    <div
      data-theme="dark"
      className="min-h-screen flex bg-black-iron text-warm-white"
    >
      <AdminSidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminMobileBar user={user} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
