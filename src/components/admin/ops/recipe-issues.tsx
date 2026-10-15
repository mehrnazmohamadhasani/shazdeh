import type { CostIssue } from "@/lib/ops/recipe-cost";
import type { Translate } from "@/lib/admin-i18n";

/** Why a cost is an estimate, one short reason each (brief §7: show the difference). */
export function issueText(issue: CostIssue, t: Translate) {
  switch (issue.kind) {
    case "no_price":
      return t("No price yet: {name}", { name: issue.name });
    case "draft_prep":
      return t("Prep not approved: {name}", { name: issue.name });
    case "empty_prep":
      return t("Prep has no recipe: {name}", { name: issue.name });
    case "cycle":
      return t("Loops back to itself: {name}", { name: issue.name });
    case "draft":
      return t("Not approved yet");
    case "no_lines":
      return t("No ingredients yet");
  }
}
