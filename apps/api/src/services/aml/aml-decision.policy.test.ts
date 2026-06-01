import { describe, expect, it } from "vitest";
import { DefaultAmlDecisionPolicy } from "./aml-decision.policy.js";
import type { AmlScreeningResult, AmlWatchlistCategory } from "./aml-types.js";

function result(
  partial: Partial<AmlScreeningResult> & Pick<AmlScreeningResult, "matchStatus">,
): AmlScreeningResult {
  const categories: AmlWatchlistCategory[] = partial.categories ?? [];
  return {
    provider: "veriff",
    providerSessionId: "sess_1",
    monitorStatus: "not_monitored",
    totalHits: partial.totalHits ?? categories.length,
    hits: partial.hits ?? [],
    categories,
    rawPayload: {},
    screenedAt: new Date("2026-01-01T00:00:00Z"),
    ...partial,
  };
}

describe("DefaultAmlDecisionPolicy", () => {
  const policy = new DefaultAmlDecisionPolicy();

  it("clears when there is no match and no hits", () => {
    const decision = policy.evaluate(result({ matchStatus: "no_match", totalHits: 0 }));
    expect(decision.outcome).toBe("clear");
    expect(decision.reasons).toContain("no_match");
  });

  it("clears dismissed false positives", () => {
    const decision = policy.evaluate(result({ matchStatus: "false_positive", totalHits: 0 }));
    expect(decision.outcome).toBe("clear");
  });

  it("blocks confirmed sanctions matches", () => {
    const decision = policy.evaluate(
      result({ matchStatus: "confirmed_match", categories: ["sanction"], totalHits: 1 }),
    );
    expect(decision.outcome).toBe("block");
    expect(decision.reasons).toContain("confirmed_sanctions_match");
  });

  it("blocks when a confirmed match includes sanctions among other categories", () => {
    const decision = policy.evaluate(
      result({
        matchStatus: "confirmed_match",
        categories: ["pep", "sanction"],
        totalHits: 2,
      }),
    );
    expect(decision.outcome).toBe("block");
  });

  it("reviews confirmed non-sanctions (PEP) matches", () => {
    const decision = policy.evaluate(
      result({ matchStatus: "confirmed_match", categories: ["pep"], totalHits: 1 }),
    );
    expect(decision.outcome).toBe("review");
    expect(decision.reasons).toContain("confirmed_pep_match");
  });

  it("reviews possible matches regardless of category", () => {
    const decision = policy.evaluate(
      result({ matchStatus: "possible_match", categories: ["adverse_media"], totalHits: 3 }),
    );
    expect(decision.outcome).toBe("review");
    expect(decision.reasons).toContain("possible_match");
    expect(decision.reasons).toContain("possible_adverse_media_match");
  });

  it("reviews defensively when hits are present but status is no_match", () => {
    const decision = policy.evaluate(result({ matchStatus: "no_match", totalHits: 2 }));
    expect(decision.outcome).toBe("review");
    expect(decision.reasons).toContain("hits_present_without_match_status");
  });
});
