import type { LineSuggestion } from "./match";
import { normalizeName } from "./units";

/*
 * How the automatic picks fared once a person saved the document: each
 * ingredient the AI (or another supplier's memory) filled in was kept or
 * changed, and each clean name the AI gave a new item was kept or not.
 * Recorded per document, summed on Kitchen settings, so it shows whether
 * matching is getting better. Corrections also teach the supplier memory,
 * which the next reading uses.
 */

export type MatchOutcome = {
  picks: number;
  kept: number;
  changed: { printed: string; suggested: string | null; saved: string | null }[];
  named: number;
  namedKept: number;
};

export function matchOutcome(
  printed: string[],
  suggestions: Pick<LineSuggestion, "ingredientId" | "ingredientName" | "matchedBy" | "newNameFa">[],
  saved: { rawName: string; ingredient: { name: string } | null }[],
  savedIds: (string | null)[],
): MatchOutcome {
  const out: MatchOutcome = { picks: 0, kept: 0, changed: [], named: 0, namedKept: 0 };
  const used = new Set<number>();
  printed.forEach((p, i) => {
    const sug = suggestions[i];
    if (!sug || (!sug.matchedBy && !sug.newNameFa)) return;
    // The same line on the saved document (lines can be added, removed or reordered on review).
    const j = saved.findIndex((s, k) => !used.has(k) && normalizeName(s.rawName) === normalizeName(p));
    if (j < 0) return;
    used.add(j);
    const name = saved[j].ingredient?.name ?? null;
    if (sug.matchedBy && sug.ingredientId) {
      out.picks++;
      if (savedIds[j] === sug.ingredientId) out.kept++;
      else out.changed.push({ printed: p, suggested: sug.ingredientName ?? null, saved: name });
    } else if (sug.newNameFa) {
      out.named++;
      if (name && sug.ingredientName && name.trim().toLowerCase() === sug.ingredientName.trim().toLowerCase()) out.namedKept++;
    }
  });
  return out;
}

/** Totals of many documents' outcomes. */
export function sumOutcomes(rows: Partial<MatchOutcome>[]) {
  return rows.reduce<{ picks: number; kept: number; named: number; namedKept: number }>(
    (s, r) => ({ picks: s.picks + (r.picks ?? 0), kept: s.kept + (r.kept ?? 0), named: s.named + (r.named ?? 0), namedKept: s.namedKept + (r.namedKept ?? 0) }),
    { picks: 0, kept: 0, named: 0, namedKept: 0 },
  );
}
