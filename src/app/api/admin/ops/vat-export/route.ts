import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { CMS_ROLES, requireAuth } from "@/lib/api";
import { opsError } from "@/lib/ops/http";
import { purchaseVatWorkbook } from "@/lib/ops/vat-export";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Purchase VAT for the accountant: GET ?from=YYYY-MM-DD&to=YYYY-MM-DD → .xlsx */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to) || from > to) {
    return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
  }
  try {
    const file = await purchaseVatWorkbook(from, to);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="shazdeh-purchase-vat-${from}-to-${to}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return opsError(e);
  }
}
