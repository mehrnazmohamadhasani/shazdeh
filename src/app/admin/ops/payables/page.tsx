import { redirect } from "next/navigation";

/** Payables now live on the Invoices screen ("Not paid"); old links and bookmarks land there. */
export default function PayablesPage() {
  redirect("/admin/ops/invoices?show=unpaid");
}
