import { redirect } from "next/navigation";
import { AssistantChat } from "@/components/admin/assistant/assistant-chat";
import { requireAdmin } from "@/lib/auth";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { recentActions } from "@/lib/ops/assistant/actions";
import { ASSISTANT_ROLES } from "@/lib/ops/assistant/types";
import { roleHome } from "@/lib/roles";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Assistant") };
}

/** The chat renders the page frame itself: its header buttons (conversations, new) act on the chat. */
export default async function AssistantPage() {
  const user = await requireAdmin();
  if (!(ASSISTANT_ROLES as readonly string[]).includes(user.role)) redirect(roleHome(user.role));
  const { t } = await getAdminI18n();
  const recent = await recentActions(user);
  return (
    <AssistantChat
      role={user.role}
      recent={recent}
      title={t("Assistant")}
      description={t("Ask about stock, costs and sales, or tell it what happened — by voice or by typing.")}
    />
  );
}
