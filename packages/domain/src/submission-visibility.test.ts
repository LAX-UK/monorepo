import { describe, expect, it } from "vitest";
import {
  canSeeConsignedLot,
  canSeeSubmission,
  consignedLotScope,
  submissionSenderScope,
} from "./submission-visibility.js";

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

describe("consigned lots", () => {
  it("narrows lots only for members who see just their own submissions", () => {
    expect(consignedLotScope({ role: "consignor" })).toBe("own");
    for (const role of ["owner", "admin", "finance", "viewer"] as const) {
      expect(consignedLotScope({ role })).toBe("all");
    }
    expect(consignedLotScope(null)).toBe("all");
  });

  it("shows a consignor the lots from their own submissions, and an owner every lot", () => {
    const see = (scope: "all" | "own", sender: string | null | undefined) =>
      canSeeConsignedLot({ scope, submittedByUserId: sender, viewerUserId: "me" });
    expect(see("own", "me")).toBe(true);
    expect(see("own", "colleague")).toBe(false);
    expect(see("own", undefined)).toBe(false);
    expect(see("all", "colleague")).toBe(true);
    expect(see("all", undefined)).toBe(true);
  });
});
