import "server-only";
import { getSettings } from "@/lib/settings";
import { getOrderingSettings } from "@/lib/ordering/config";
import type { InvoiceSeller } from "@/lib/ordering/invoice";

/**
 * Who sells, as printed on invoices: the legal identity from Online
 * ordering settings, the contact details from Site settings. The address
 * is the one the owner chose to publish there (else "Dubai, UAE").
 */
export async function getInvoiceSeller(): Promise<InvoiceSeller> {
  const [site, ordering] = await Promise.all([getSettings(), getOrderingSettings()]);
  return {
    brandName: site.brandName || "SHĀZDEH",
    legalName: ordering.legalName,
    tradeLicenseNo: ordering.tradeLicenseNo,
    licensingAuthority: ordering.licensingAuthority,
    trn: ordering.trn,
    address: site.address,
    phone: site.phone,
    email: site.email,
    pricesIncludeVat: ordering.pricesIncludeVat,
  };
}
