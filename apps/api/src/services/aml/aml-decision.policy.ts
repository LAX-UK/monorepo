import type { AmlDecision, AmlScreeningResult } from "./aml-types.js";
import type { IAmlDecisionPolicy } from "./ports.js";

/**
 * Pure, deterministic AML decision policy.
 *
 * Maps a normalized screening result to one of three outcomes:
 *  - `block`   confirmed sanctions match — settlement must be halted and the
 *              MLRO must act before anything proceeds (CDD Section 5).
 *  - `review`  any possible match, or a confirmed non-sanctions match (e.g. PEP
 *              requiring EDD, adverse media) — requires MLRO/compliance review
 *              before settlement.
 *  - `clear`   no match / dismissed false positive.
 *
 * No I/O: this is a strategy object so the rules are unit-testable in isolation
 * and Open/Closed against new categories.
 */
export class DefaultAmlDecisionPolicy implements IAmlDecisionPolicy {
  evaluate(result: AmlScreeningResult): AmlDecision {
    const reasons: string[] = [];
    const categories = new Set(result.categories);
    const hasSanctions = categories.has("sanction");

    if (result.matchStatus === "confirmed_match") {
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

    if (result.matchStatus === "possible_match") {
      reasons.push("possible_match");
      for (const category of categories) {
        reasons.push(`possible_${category}_match`);
      }
      return { outcome: "review", reasons };
    }

    // Defensive: provider says "no_match" but still returned hits — never silently clear.
    if (result.totalHits > 0) {
      reasons.push("hits_present_without_match_status");
      return { outcome: "review", reasons };
    }

    return { outcome: "clear", reasons: ["no_match"] };
  }
}
