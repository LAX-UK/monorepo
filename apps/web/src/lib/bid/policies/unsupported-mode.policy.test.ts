import { describe, expect, it } from "vitest";
import { policyContext } from "./policy-test-context";
import { unsupportedModePolicy } from "./unsupported-mode.policy";

describe("unsupportedModePolicy", () => {
  it("allows English catalogue lots", () => {
    expect(unsupportedModePolicy.evaluate(policyContext()).kind).toBe("allow");
  });

  it("blocks unsupported auction modes with a contact link", () => {
    const decision = unsupportedModePolicy.evaluate(
      policyContext({ unsupportedAuctionMode: true }),
    );
    expect(decision.kind).toBe("block");
    if (decision.kind !== "block") return;
    expect(decision.viewId).toBe("unsupported-auction-mode");
    expect(decision.presentation.tone).toBe("neutral");
    expect(decision.presentation.title).toBe("Online bidding unavailable");
    expect(decision.presentation.action).toMatchObject({ kind: "link", href: "/contact" });
  });
});
