import "server-only";
import { reportError } from "@/lib/report-error";
import { AiNotConfiguredError } from "../ai";
import { assertAiBudget, recordAiUsage } from "../ai-usage";
import { OpsError } from "../documents";
import { dubaiToday } from "../today";
import { loadCatalog, NameError, type Catalog } from "./catalog";
import { isWriteTool, mayUse, openAiTools, toolArgs, type ToolName } from "./definitions";
import { propose } from "./actions";
import { moneyForModel, replyLanguage } from "./model-format";
import { dayInfo, payables, recentPurchases, recipeInfo, sales, stockLevel } from "./read-tools";
import type { ActionCard, ChatTurn } from "./types";

/*
 * One turn of the assistant: the person's words (typed, or a checked
 * transcript of a voice note) → the model, which may call the tools its
 * role allows → a short answer, plus a card for every change it proposed.
 * The model never writes anything itself: write tools only create
 * proposals for the person to confirm on screen.
 *
 * OpenAI Responses API with function calling (same key as reading):
 *   OPENAI_ASSISTANT_MODEL   optional, default OPENAI_MODEL or gpt-5-mini
 */

type User = { id: string; email: string; role: string };
const MAX_ROUNDS = 6;
/** Earlier turns the model is shown (the screen keeps more). */
export const HISTORY_TURNS = 12;

function instructions(user: User, todayDay: string, locale: "en" | "fa", language: string) {
  const yesterday = new Date(Date.parse(`${todayDay}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return `You are the kitchen assistant of SHĀZDEH, a Persian restaurant and cloud kitchen in Dubai (money in AED). The person using you is ${
    user.role === "PURCHASER"
      ? "the purchaser: they buy and count stock. They can't see or change sales, costs, profit or recipes, and can't open those screens; for those, say the owner or a manager can do it"
      : user.role === "ADMIN"
        ? "the owner"
        : "a manager (their recipe changes are saved as drafts for the owner to approve)"
  }, usually on a phone in a busy kitchen.

Language: the person's latest message is in ${language}, so answer in ${language}, whatever language earlier messages or names are in.${
    language === "English" ? ' Exception: Persian written in Latin letters (Finglish, e.g. "list forushe emrooz", "chand kilo berenj darim?") is Persian; answer that in Persian.' : ""
  } (Their screen is in ${locale === "fa" ? "Persian" : "English"}.) Keep answers short: one to three plain sentences, no tables, no markdown. When asked for a list, give the list itself, one item per line ("Rice — 12 kg"), filtered to what was asked; don't offer to show it later.

Facts: get every number from a tool. Never make up, estimate or recalculate a figure yourself; repeat it as the tool gives it. When a tool gives null, say it is unknown. Values worked out from the last purchase price are estimates; say "estimated". Money fields end in Aed and are already in AED; write money as "AED 12.50" (in Persian or Arabic: "12.50 درهم"). Amounts are in g, ml or pcs; say 1000 g or more in kg and 1000 ml or more in litres.

Changes: you can only suggest them, with the record_*, adjust_stock, stock_count, write_recipe, change_recipe and fix_invoice_price tools. Each call shows the person a card with the numbers before and after, which they confirm or cancel. Don't repeat the card's numbers: say in one short sentence what you suggested and ask them to check the card and confirm. Never say a change is done. Don't call the same change twice in a row. Cards exist only for these changes: never offer a card, a screen, a file or anything else for answers; just answer.

Names: pass names as the person said them, in any language or spelling; the tools match them. If a tool answers "ambiguous" or "not_found", ask which one they mean and offer the choices; don't guess. If they didn't say an amount or unit, ask; never assume one. "Half a kilo" is 0.5 kg; "a bunch" or "a box" has no weight, so ask how much it weighs.

Recipes: a whole new recipe for a dish (often dictated: "recipe for Ghormeh Sabzi: 120 g lamb, 80 g herbs…") goes in one write_recipe call with every line; if they said the amounts for several portions, pass portions. Every line needs an amount and unit; ask for any that are missing rather than leaving them out. If some names come back unmatched, ask about those only, then call write_recipe again with all the lines. A dish with no recipe yet always takes write_recipe, even when they say "add".

Dates: today is ${todayDay} and yesterday was ${yesterday} (Dubai). Pass days as YYYY-MM-DD.

Voice: messages may be transcripts of speech, with misheard words. If a name or number seems odd, check with the person before suggesting a change.

Out of scope: to add a new purchase invoice, they take a photo with the camera button on this screen (or "Add" on Today); you can't type one in. If they ask for something your tools can't do, or that their role doesn't allow, say so in one sentence.`;
}

type ResponseBody = {
  id: string;
  output?: (
    | { type: "message"; content?: { type: string; text?: string; refusal?: string }[] }
    | { type: "function_call"; call_id: string; name: string; arguments: string }
    | { type: string }
  )[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

async function callModel(body: object, key: string) {
  await assertAiBudget();
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as ResponseBody;
}

type Ctx = { user: User; via: "chat" | "voice"; sourceDocumentId: string | null; today: string; catalog?: Catalog; cards: ActionCard[] };

/** Runs one tool call and returns what the model is told (JSON). */
async function runTool(name: string, rawArgs: string, ctx: Ctx): Promise<unknown> {
  if (!mayUse(ctx.user.role, name)) return { error: "not_allowed", message: "This person's role can't use that." };
  let args: unknown;
  try {
    args = JSON.parse(rawArgs);
  } catch {
    return { error: "bad_arguments" };
  }
  const parsed = toolArgs[name as ToolName].safeParse(args);
  if (!parsed.success) return { error: "bad_arguments", detail: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) };
  try {
    ctx.catalog ??= await loadCatalog();
    const tool = name as ToolName;
    if (isWriteTool(tool)) {
      const card = await propose(tool, parsed.data, { user: ctx.user, via: ctx.via, sourceDocumentId: ctx.sourceDocumentId, catalog: ctx.catalog, today: ctx.today });
      ctx.cards.push(card);
      return {
        proposed: true,
        sensitive: card.sensitive,
        preview: card.preview,
        next: card.sensitive
          ? "Shown as a card. This one needs two taps to confirm; ask the person to check the numbers and confirm."
          : "Shown as a card; ask the person to check it and confirm.",
      };
    }
    const a = parsed.data;
    switch (tool) {
      case "stock_level":
        return await stockLevel(toolArgs.stock_level.parse(a), ctx.catalog);
      case "recent_purchases":
        return await recentPurchases(toolArgs.recent_purchases.parse(a), ctx.catalog, ctx.today);
      case "recipe_info":
        return await recipeInfo(toolArgs.recipe_info.parse(a), ctx.catalog);
      case "today_summary":
        return await dayInfo(toolArgs.today_summary.parse(a), ctx.today);
      case "sales_summary":
        return await sales(toolArgs.sales_summary.parse(a));
      case "payables":
        return await payables();
    }
  } catch (e) {
    if (e instanceof NameError) return e.toJSON();
    if (e instanceof OpsError) return { error: "refused", message: e.message, ...e.extra };
    reportError(e, { where: `assistant tool ${name}` });
    return { error: "failed", message: "That didn't work; tell the person to try again or use the screen." };
  }
  return { error: "unknown_tool" };
}

export async function runAssistant(opts: {
  user: User;
  history: ChatTurn[];
  text: string;
  via: "chat" | "voice";
  sourceDocumentId: string | null;
  locale: "en" | "fa";
}): Promise<{ reply: string; cards: ActionCard[] }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new AiNotConfiguredError();
  const model = process.env.OPENAI_ASSISTANT_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
  const ctx: Ctx = { user: opts.user, via: opts.via, sourceDocumentId: opts.sourceDocumentId, today: dubaiToday(), cards: [] };
  const base = { model, instructions: instructions(opts.user, ctx.today, opts.locale, replyLanguage(opts.text)), tools: openAiTools(opts.user.role), reasoning: { effort: "low" } };

  let input: unknown[] = [
    ...opts.history.slice(-HISTORY_TURNS).map((t) => ({ role: t.role, content: t.text })),
    { role: "user", content: opts.text },
  ];
  let previous: string | undefined;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const body = await callModel({ ...base, input, ...(previous ? { previous_response_id: previous } : {}) }, key);
    await recordAiUsage({ kind: "assistant", model, inputTokens: body.usage?.input_tokens ?? null, outputTokens: body.usage?.output_tokens ?? null, documentId: opts.sourceDocumentId });
    const calls = (body.output ?? []).filter((o): o is { type: "function_call"; call_id: string; name: string; arguments: string } => o.type === "function_call");
    if (calls.length === 0) {
      const text = (body.output ?? [])
        .flatMap((o) => (o.type === "message" && "content" in o ? (o.content ?? []) : []))
        .map((c) => c.text ?? c.refusal ?? "")
        .join("")
        .trim();
      return { reply: text, cards: ctx.cards };
    }
    const outputs = [];
    for (const call of calls) {
      outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(moneyForModel(await runTool(call.name, call.arguments, ctx))) });
    }
    previous = body.id;
    input = outputs;
  }
  return { reply: "", cards: ctx.cards };
}
