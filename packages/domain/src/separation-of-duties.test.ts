import { describe, expect, it } from "vitest";
import { complianceDecisionRefusal, payoutReversalRefusal } from "./separation-of-duties.js";

describe("complianceDecisionRefusal", () => {
  const participants = {
    subjectUserId: "client",
    raisedByUserId: "raiser",
    triagedByUserId: "triager",
  };

  it("lets a second compliance person decide", () => {
    expect(complianceDecisionRefusal("decider", participants)).toBeNull();
  });

  it("refuses the client the case is about", () => {
    expect(complianceDecisionRefusal("client", participants)).toBe("own_case");
  });

  it("refuses whoever raised the case", () => {
    expect(complianceDecisionRefusal("raiser", participants)).toBe("raised_case");
  });

  it("refuses whoever reviewed the case first", () => {
    expect(complianceDecisionRefusal("triager", participants)).toBe("triaged_case");
  });

  it("does not treat a system-raised case as raised by the decider", () => {
    expect(
      complianceDecisionRefusal("decider", { ...participants, raisedByUserId: null }),
    ).toBeNull();
  });
});

describe("payoutReversalRefusal", () => {
  it("lets an administrator reverse a payout someone else processed", () => {
    expect(
      payoutReversalRefusal({
        actorUserId: "admin",
        actorMayReverse: true,
        processedByUserIds: ["finance"],
      }),
    ).toBeNull();
  });

  it("refuses anyone without the reversal permission", () => {
    expect(
      payoutReversalRefusal({
        actorUserId: "finance-2",
        actorMayReverse: false,
        processedByUserIds: [],
      }),
    ).toBe("not_permitted");
  });

  it("refuses the person who processed the payout, even an administrator", () => {
    expect(
      payoutReversalRefusal({
        actorUserId: "admin",
        actorMayReverse: true,
        processedByUserIds: ["finance", "admin"],
      }),
    ).toBe("processed_payout");
  });
});
