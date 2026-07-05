export type AmlDecisionOutcome = "block" | "review" | "clear";

export type AmlScreeningMatchStatus =
  | "confirmed_match"
  | "possible_match"
  | "no_match"
  | "false_positive";

export type AmlScreeningDecisionInput = {
  matchStatus: AmlScreeningMatchStatus;
  categories: readonly string[];
  totalHits: number;
};

export type AmlDecision = {
  outcome: AmlDecisionOutcome;
  reasons: string[];
};

/** Pure AML screening → settlement decision (no I/O). */
export function evaluateAmlScreeningResult(input: AmlScreeningDecisionInput): AmlDecision {
  const reasons: string[] = [];
  const categories = new Set(input.categories);
  const hasSanctions = categories.has("sanction");

  if (input.matchStatus === "confirmed_match") {
    if (hasSanctions) {
      reasons.push("confirmed_sanctions_match");
      return { outcome: "block", reasons };
    }
    for (const category of categories) {
      reasons.push(`confirmed_${category}_match`);
    }
    if (reasons.length === 0) reasons.push("confirmed_match");
    return { outcome: "review", reasons };
  }

  if (input.matchStatus === "possible_match") {
    reasons.push("possible_match");
    for (const category of categories) {
      reasons.push(`possible_${category}_match`);
    }
    return { outcome: "review", reasons };
  }

  if (input.totalHits > 0) {
    reasons.push("hits_present_without_match_status");
    return { outcome: "review", reasons };
  }

  return { outcome: "clear", reasons: ["no_match"] };
}
