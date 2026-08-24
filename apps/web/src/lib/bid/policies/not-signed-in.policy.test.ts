import { describe, expect, it } from "vitest";
import { notSignedInPolicy } from "./not-signed-in.policy";
import { policyContext } from "./policy-test-context";

describe("notSignedInPolicy", () => {
  it("allows signed-in users", () => {
    expect(notSignedInPolicy.evaluate(policyContext()).kind).toBe("allow");
  });

  it("blocks guests with a sign-in link", () => {
    const decision = notSignedInPolicy.evaluate(policyContext({ user: null }));
    expect(decision.kind).toBe("block");
    if (decision.kind !== "block") return;
    expect(decision.viewId).toBe("not-signed-in");
    expect(decision.presentation.tone).toBe("info");
    expect(decision.presentation.title).toBe("Sign in to bid");
    expect(decision.presentation.action).toMatchObject({
      kind: "link",
      href: "/login?next=%2Flot%2Ftest-lot%2Flot1",
    });
  });
});
