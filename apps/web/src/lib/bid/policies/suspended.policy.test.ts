import { describe, expect, it } from "vitest";
import { policyContext } from "./policy-test-context";
import { suspendedPolicy } from "./suspended.policy";

describe("suspendedPolicy", () => {
  it("allows unsuspended users", () => {
    expect(suspendedPolicy.evaluate(policyContext()).kind).toBe("allow");
  });

  it("blocks suspended users with a support link", () => {
    const decision = suspendedPolicy.evaluate(
      policyContext({
        user: { id: "u1", email: "a@b.c", name: "A", role: "client", suspended: true },
      }),
    );
    expect(decision.kind).toBe("block");
    if (decision.kind !== "block") return;
    expect(decision.viewId).toBe("suspended");
    expect(decision.presentation.tone).toBe("danger");
    expect(decision.presentation.title).toBe("Account suspended");
    expect(decision.presentation.action).toMatchObject({ kind: "link", href: "/contact" });
  });
});
