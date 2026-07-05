import { evaluateAmlScreeningResult } from "@auction/domain";
import type { AmlScreeningResult } from "./aml-types.js";
import type { AmlDecision } from "./aml-types.js";
import type { IAmlDecisionPolicy } from "./ports.js";

/** Strategy wrapper delegating to pure domain rules in `@auction/domain`. */
export class DefaultAmlDecisionPolicy implements IAmlDecisionPolicy {
  evaluate(result: AmlScreeningResult): AmlDecision {
    return evaluateAmlScreeningResult({
      matchStatus: result.matchStatus,
      categories: result.categories,
      totalHits: result.totalHits,
    });
  }
}
