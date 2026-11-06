import { z } from "zod";
import { CMS_ROLES, ok, parseJson, requireAuth, serverError } from "@/lib/api";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { normalizeMobile } from "@/lib/ordering/phone";
import { eraseCustomer, unsubscribeCustomer } from "@/lib/ordering/customer-privacy";

const schema = z.object({
  action: z.enum(["unsubscribe", "erase"]),
  phone: z.string().max(32),
});

/**
 * A customer's request about their data, carried out by staff:
 * "unsubscribe" stops offers (admins and editors); "erase" deletes their
 * personal data and can't be undone (admins only).
 */
export async function POST(req: Request) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  const { action } = parsed.data;
  if (action === "erase" && auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only an admin can delete a customer's data." }, { status: 403 });
  }
  const phone = normalizeMobile(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "Invalid mobile number." }, { status: 400 });
  try {
    const result = action === "erase" ? await eraseCustomer(phone, auth.user.email) : await unsubscribeCustomer(phone, auth.user.email);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    revalidatePath("/admin/customers");
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
