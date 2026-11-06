import { NextResponse } from "next/server";
import { z } from "zod";
import { CMS_ROLES, ok, parseJson, requireAuth, revalidateSite, serverError } from "@/lib/api";
import { AiNotConfiguredError } from "@/lib/ops/ai";
import { AiBudgetError } from "@/lib/ops/ai-usage";
import { fillMissingArabic, translateDishes } from "@/lib/ordering/menu-arabic";

// Several AI calls when the whole menu is filled at once.
export const maxDuration = 300;

const text = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => v || null);
const schema = z.union([
  z.object({ dish: z.object({ name: z.string().trim().min(1).max(120), description: text(1500), ingredients: text(1500), allergens: text(500) }) }),
  z.object({ missing: z.literal(true) }),
]);

/**
 * AI drafts of the Arabic dish details. { dish } returns the draft for
 * the form (nothing saved); { missing: true } fills and saves every dish
 * that has no Arabic yet.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(CMS_ROLES);
  if (auth.response) return auth.response;
  const parsed = await parseJson(req, schema);
  if (!parsed.ok) return parsed.response;
  try {
    if ("dish" in parsed.data) {
      const [arabic] = await translateDishes([parsed.data.dish as { name: string; description: string | null; ingredients: string | null; allergens: string | null }]);
      return ok(arabic);
    }
    const result = await fillMissingArabic();
    if (result.filled > 0) revalidateSite();
    return ok(result);
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return NextResponse.json({ error: "AI isn't set up on the server." }, { status: 503 });
    if (e instanceof AiBudgetError) return NextResponse.json({ error: e.message }, { status: 429 });
    return serverError(e, { expose: true });
  }
}
