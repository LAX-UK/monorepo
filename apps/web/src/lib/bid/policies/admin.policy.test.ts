import { describe, expect, it } from "vitest";
import { adminPolicy } from "./admin.policy";
import { policyContext } from "./policy-test-context";

describe("adminPolicy", () => {
  it("allows clients", () => {
    expect(adminPolicy.evaluate(policyContext()).kind).toBe("allow");
  });

  it("blocks staff with an admin link", () => {
    const decision = adminPolicy.evaluate(
      policyContext({
        user: { id: "staff", email: "s@x.y", name: "Staff", role: "staff" },
      }),
    );
    expect(decision.kind).toBe("block");
    if (decision.kind !== "block") return;
    expect(decision.viewId).toBe("staff-no-bid");
    expect(decision.presentation.tone).toBe("info");
    expect(decision.presentation.title).toBe("Staff account");
    expect(decision.presentation.action).toMatchObject({ kind: "link", href: "/admin" });
  });
});
