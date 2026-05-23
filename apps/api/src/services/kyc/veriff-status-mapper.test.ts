import { describe, expect, it } from "vitest";
import { mapVeriffDecisionToApplyInput } from "./veriff-status-mapper.js";

describe("mapVeriffDecisionToApplyInput", () => {
  it("maps expired sessions to unverified user status", () => {
    const input = mapVeriffDecisionToApplyInput({ id: "s1", status: "expired" }, {});
    expect(input.verificationStatus).toBe("canceled");
    expect(input.userKycUpdate.setStatus).toBe("unverified");
  });

  it("maps review to processing", () => {
    const input = mapVeriffDecisionToApplyInput({ id: "s1", status: "review" }, {});
    expect(input.verificationStatus).toBe("processing");
    expect(input.userKycUpdate.setStatus).toBe("pending");
  });
});
