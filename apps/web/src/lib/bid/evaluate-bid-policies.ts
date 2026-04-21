import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./policies/types";

export function evaluateBidPolicies(
  policies: readonly BidPolicy[],
  ctx: BidPolicyContext,
): BidPolicyDecision {
  for (const p of policies) {
    const d = p.evaluate(ctx);
    if (d.kind === "block") return d;
  }
  return { kind: "allow" };
}
