import { describe, expect, it } from "vitest";
import {
  mapVeriffDecisionToApplyInput,
  mapVeriffEventToUserStatus,
  mapVeriffEventToVerificationStatus,
} from "./veriff-status-mapper.js";

describe("mapVeriffDecisionToApplyInput", () => {
  it("maps expired sessions to unverified user status", () => {
    const input = mapVeriffDecisionToApplyInput({ id: "s1", status: "expired" }, {});
    expect(input.verificationStatus).toBe("canceled");
    expect(input.userKycUpdate.setStatus).toBe("unverified");
  });

  it("falls back to decision code when status is unknown", () => {
    const input = mapVeriffDecisionToApplyInput({ id: "s1", status: "unknown", code: 9121 }, {});
    expect(input.verificationStatus).toBe("canceled");
    expect(input.userKycUpdate.setStatus).toBe("unverified");
    expect(input.isApproved).toBe(false);
  });

  it("maps code 9001 to approved when status is empty", () => {
    const input = mapVeriffDecisionToApplyInput({ id: "s1", status: "", code: 9001 }, {});
    expect(input.verificationStatus).toBe("verified");
    expect(input.userKycUpdate.setStatus).toBe("approved");
    expect(input.isApproved).toBe(true);
  });

  it("maps review to processing", () => {
    const input = mapVeriffDecisionToApplyInput({ id: "s1", status: "review" }, {});
    expect(input.verificationStatus).toBe("processing");
    expect(input.userKycUpdate.setStatus).toBe("pending");
  });
});

describe("mapVeriffEventToVerificationStatus", () => {
  it("maps started to created and submitted to processing", () => {
    expect(mapVeriffEventToVerificationStatus("started")).toBe("created");
    expect(mapVeriffEventToVerificationStatus("submitted")).toBe("processing");
    expect(mapVeriffEventToVerificationStatus("unknown")).toBeNull();
  });
});

describe("mapVeriffEventToUserStatus", () => {
  it("sets pending only on submitted, not started", () => {
    expect(mapVeriffEventToUserStatus("started")).toBeNull();
    expect(mapVeriffEventToUserStatus("submitted")).toBe("pending");
    expect(mapVeriffEventToUserStatus("unknown")).toBeNull();
  });
});
