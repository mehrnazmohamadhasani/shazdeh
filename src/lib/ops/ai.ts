import "server-only";
import { EXTRACTION_PROMPT, extractionJsonSchema, extractionSchema, type Extraction } from "./extraction";
import { assertAiBudget, recordAiUsage } from "./ai-usage";

/*
 * Reads a document image (or PDF) into the canonical Extraction shape.
 * One provider today — OpenAI, via the Responses API with a strict JSON
 * schema — behind a single function so another model can be swapped in
 * by changing this file only.
 *
 *   OPENAI_API_KEY   required in production
 *   OPENAI_MODEL     optional, default gpt-5-mini
 *
 * Without a key, local development gets a fixed sample reading so the
 * screens can be built and tested without spending anything.
 */

export type ReadResult = {
  extraction: Extraction;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI reading is not set up: add OPENAI_API_KEY to the environment.");
  }
}

export async function readDocument(file: { data: Buffer; mimeType: string; name?: string | null }, documentId?: string): Promise<ReadResult> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    if (process.env.NODE_ENV === "production") throw new AiNotConfiguredError();
    return sampleReading();
  }
  const result = await readWithSchema(file, {
    instructions: EXTRACTION_PROMPT,
    prompt: "Read this document.",
    schemaName: "purchase_document",
    jsonSchema: extractionJsonSchema,
    usage: { kind: "invoice", documentId },
  });
  const parsed = extractionSchema.safeParse(result.json);
  if (!parsed.success) throw new Error(`The reading didn't match the expected shape: ${parsed.error.message.slice(0, 300)}`);
  return { extraction: parsed.data, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
}

/**
 * One image or PDF in, JSON matching `jsonSchema` out (strict structured
 * output). Shared by every kind of document the kitchen photographs.
 * Refuses once the month's AI limit is spent, and logs what each call cost.
 */
export async function readWithSchema(
  file: { data: Buffer; mimeType: string; name?: string | null },
  opts: { instructions: string; prompt: string; schemaName: string; jsonSchema: object; usage: { kind: "invoice" | "recipe" | "platform"; documentId?: string } },
): Promise<{ json: unknown; model: string; inputTokens: number | null; outputTokens: number | null }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new AiNotConfiguredError();
  await assertAiBudget();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
  const dataUrl = `data:${file.mimeType};base64,${file.data.toString("base64")}`;
  const attachment =
    file.mimeType === "application/pdf"
      ? { type: "input_file", filename: file.name || "document.pdf", file_data: dataUrl }
      : { type: "input_image", image_url: dataUrl, detail: "high" };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: opts.instructions,
      input: [{ role: "user", content: [{ type: "input_text", text: opts.prompt }, attachment] }],
      text: { format: { type: "json_schema", name: opts.schemaName, schema: opts.jsonSchema, strict: true } },
    }),
    signal: AbortSignal.timeout(110_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  // Billed even if the answer turns out unusable below.
  await recordAiUsage({
    kind: opts.usage.kind,
    model,
    inputTokens: body.usage?.input_tokens ?? null,
    outputTokens: body.usage?.output_tokens ?? null,
    documentId: opts.usage.documentId,
  });
  const parts = (body.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []);
  const refusal = parts.find((p) => p.type === "refusal");
  if (refusal) throw new Error(`The model declined to read this document: ${refusal.refusal ?? ""}`);
  const text = parts.find((p) => p.type === "output_text")?.text;
  if (!text) throw new Error("The model returned no reading.");
  return { json: JSON.parse(text), model, inputTokens: body.usage?.input_tokens ?? null, outputTokens: body.usage?.output_tokens ?? null };
}

/**
 * A text-only question with a strict JSON answer (no file), e.g. matching
 * invoice lines to stock. Same budget, usage log and model as readings.
 */
export async function askWithSchema(opts: {
  instructions: string;
  prompt: string;
  schemaName: string;
  jsonSchema: object;
  usage: { kind: "invoice" | "recipe" | "platform"; documentId?: string };
}): Promise<unknown> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new AiNotConfiguredError();
  await assertAiBudget();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: opts.instructions,
      input: [{ role: "user", content: [{ type: "input_text", text: opts.prompt }] }],
      text: { format: { type: "json_schema", name: opts.schemaName, schema: opts.jsonSchema, strict: true } },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    output?: { type: string; content?: { type: string; text?: string }[] }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  await recordAiUsage({
    kind: opts.usage.kind,
    model,
    inputTokens: body.usage?.input_tokens ?? null,
    outputTokens: body.usage?.output_tokens ?? null,
    documentId: opts.usage.documentId,
  });
  const text = (body.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []).find((p) => p.type === "output_text")?.text;
  if (!text) throw new Error("The model returned no answer.");
  return JSON.parse(text);
}

/** Development only: a realistic reading (Rasti Lari rice + Hexing pantry lines). */
async function sampleReading(): Promise<ReadResult> {
  await new Promise((r) => setTimeout(r, 800));
  return {
    model: "sample (no OPENAI_API_KEY)",
    inputTokens: null,
    outputTokens: null,
    extraction: {
      documentType: "supplier_invoice",
      handwritten: false,
      supplier: { name: "Rasti Lari General Trading", trn: "100234567800003", phone: null },
      invoiceNumber: "RL-20931",
      invoiceDate: "2026-10-09",
      paymentMode: "credit",
      currency: "AED",
      pricesIncludeVat: false,
      lines: [
        {
          description: "Fanoos Classic Sella 1121",
          itemCode: "FC1121",
          quantity: 5,
          unit: "CTN",
          packSize: "4 x 10 kg",
          unitPrice: 209.53,
          discount: null,
          vat: null,
          lineTotal: 1047.65,
          category: "food",
          stockUnit: "g",
          stockQuantity: 200000,
          confidence: 0.86,
          note: "Assumed 5 cartons of 4 x 10 kg.",
        },
        {
          description: "TOMATO PASTE 800G",
          itemCode: null,
          quantity: 2,
          unit: "Pcs",
          packSize: null,
          unitPrice: 9.5,
          discount: null,
          vat: null,
          lineTotal: 19,
          category: "food",
          stockUnit: "g",
          stockQuantity: 1600,
          confidence: 0.95,
          note: null,
        },
        {
          description: "Kashk",
          itemCode: null,
          quantity: 3,
          unit: "TIN",
          packSize: null,
          unitPrice: 4.5,
          discount: null,
          vat: null,
          lineTotal: 13.5,
          category: "food",
          stockUnit: null,
          stockQuantity: null,
          confidence: 0.6,
          note: "Tin size not printed.",
        },
      ],
      subtotal: 1080.15,
      discount: null,
      vat: 54.01,
      total: 1134.16,
      notes: null,
      confidence: 0.84,
    },
  };
}
