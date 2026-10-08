import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TeamManager } from "@/components/admin/ordering/team-manager";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await requireAdmin();
  if (user.role !== "ADMIN") redirect("/admin");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true, role: true } });
  return (
    <div className="container-shazdeh space-y-10 py-10 md:py-14">
      <AdminPageHeader
        eyebrow="Atelier"
        title="Team"
        description="Give kitchen tablets a Staff login: they see the orders board and nothing else."
      />
      <TeamManager users={users} selfId={user.id} />
    </div>
  );
}
