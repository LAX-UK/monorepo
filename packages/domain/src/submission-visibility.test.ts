import { describe, expect, it } from "vitest";
import { canSeeSubmission, submissionSenderScope } from "./submission-visibility.js";

describe("submissionSenderScope", () => {
  it("lets owners and admins see every submission", () => {
    expect(submissionSenderScope({ role: "owner" })).toBe("all");
    expect(submissionSenderScope({ role: "admin" })).toBe("all");
  });

  it("shows a consignor only their own", () => {
    expect(submissionSenderScope({ role: "consignor" })).toBe("own");
  });

  it("shows finance and viewers every submission with a recorded sender", () => {
    expect(submissionSenderScope({ role: "finance" })).toBe("attributed");
    expect(submissionSenderScope({ role: "viewer" })).toBe("attributed");
  });

  it("keeps a buyer agent to their own, and a person's own account unrestricted", () => {
    expect(submissionSenderScope({ role: "buyer_agent" })).toBe("own");
    expect(submissionSenderScope(null)).toBe("all");
  });

  it("does not narrow LAX support viewing as an owner", () => {
    expect(submissionSenderScope({ role: "owner", isImpersonation: true })).toBe("all");
  });
});

describe("canSeeSubmission", () => {
  const me = "user-1";
  it("applies each scope", () => {
    const see = (scope: "all" | "attributed" | "own", sender: string | null) =>
      canSeeSubmission({ scope, submittedByUserId: sender, viewerUserId: me });
    expect(see("all", null)).toBe(true);
    expect(see("attributed", "someone")).toBe(true);
    expect(see("attributed", null)).toBe(false);
    expect(see("own", me)).toBe(true);
    expect(see("own", "someone")).toBe(false);
    expect(see("own", null)).toBe(false);
  });
});
