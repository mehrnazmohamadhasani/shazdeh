import { redirect } from "next/navigation";
import { AdminPage } from "@/components/admin/ui";
import { TeamManager } from "@/components/admin/ordering/team-manager";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Team") };
}

export default async function TeamPage() {
  const user = await requireAdmin();
  if (user.role !== "ADMIN") redirect("/admin");
  const { t } = await getAdminI18n();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true, role: true } });
  return (
    <AdminPage title={t("Team")} description={t("Who can sign in. Staff accounts only see the orders board.")}>
      <TeamManager users={users} selfId={user.id} />
    </AdminPage>
  );
}
