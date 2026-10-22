import { AdminPage } from "@/components/admin/ui";
import { CustomersList } from "@/components/admin/ordering/customers-list";
import { getAdminI18n } from "@/lib/admin-i18n/server";
import { loadCustomerRows } from "@/lib/ordering/customers";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Customers") };
}

/** Everyone we can reach: guests who ordered and people who claimed a QR gift, one row per mobile. */
export default async function CustomersPage() {
  const { t } = await getAdminI18n();
  const rows = await loadCustomerRows();
  return (
    <AdminPage
      title={t("Customers")}
      description={t("Everyone who ordered from the website (or by WhatsApp and phone) and everyone who claimed a QR gift — one row per mobile.")}
    >
      <CustomersList rows={rows} />
    </AdminPage>
  );
}
