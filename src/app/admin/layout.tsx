import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminSidebar, AdminMobileBar } from "@/components/admin/sidebar";

export const metadata: Metadata = {
  title: { default: "Atelier · SHĀZDEH", template: "%s · Atelier" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

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
