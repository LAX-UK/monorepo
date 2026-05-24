import { describe, expect, it } from "vitest";
import {
  VERIFF_RESUBMISSION_LIMIT_REASON_CODE,
  buildKycUserFeedback,
  mergeKycDecisionPayload,
  readKycSessionUrl,
  readVeriffReasonCode,
  shouldReuseKycSessionUrl,
} from "./kyc-user-feedback.js";

describe("buildKycUserFeedback", () => {
  it("returns resubmit feedback with Veriff reason", () => {
    const feedback = buildKycUserFeedback({
      userStatus: "pending",
      latestSessionStatus: "requires_input",
      requiresKyc: true,
      decisionPayload: {
        verification: {
          status: "resubmission_requested",
          reason: "Face not clearly visible",
          reasonCode: 202,
        },
      },
    });
    expect(feedback.headline).toBe("More information needed");
    expect(feedback.detail).toContain("Face not clearly visible");
    expect(feedback.action).toBe("continue");
    expect(feedback.needsResubmit).toBe(true);
  });

  it("maps declined rejection with fallback guidance", () => {
    const feedback = buildKycUserFeedback({
      userStatus: "rejected",
      latestSessionStatus: "canceled",
      requiresKyc: true,
      decisionPayload: {
        verification: { status: "declined", reasonCode: 105 },
      },
    });
    expect(feedback.headline).toBe("Verification unsuccessful");
    expect(feedback.action).toBe("retry");
  });

  it("maps expired sessions", () => {
    const feedback = buildKycUserFeedback({
      userStatus: "unverified",
      latestSessionStatus: "canceled",
      requiresKyc: false,
      decisionPayload: {
        verification: { status: "expired", reasonCode: 9104 },
      },
    });
    expect(feedback.headline).toBe("Verification expired");
    expect(feedback.action).toBe("start");
  });

  it("maps abandoned sessions", () => {
    const feedback = buildKycUserFeedback({
      userStatus: "unverified",
      latestSessionStatus: "created",
      requiresKyc: false,
      decisionPayload: {
        verification: { status: "abandoned" },
      },
    });
    expect(feedback.headline).toBe("Verification not completed");
    expect(feedback.action).toBe("continue");
  });

  it("maps review/submitted with wait action", () => {
    const feedback = buildKycUserFeedback({
      userStatus: "pending",
      latestSessionStatus: "processing",
      requiresKyc: false,
      decisionPayload: {
        verification: { status: "review" },
      },
    });
    expect(feedback.action).toBe("wait");
    expect(feedback.headline).toContain("review");
  });

  it("uses reason code guidance when reason text is absent", () => {
    const feedback = buildKycUserFeedback({
      userStatus: "pending",
      latestSessionStatus: "requires_input",
      requiresKyc: true,
      decisionPayload: {
        verification: { status: "resubmission_requested", reasonCode: 539 },
      },
    });
    expect(feedback.detail).toContain("resubmission limit");
    expect(feedback.action).toBe("start");
    expect(feedback.needsResubmit).toBe(false);
  });
});

describe("shouldReuseKycSessionUrl", () => {
  it("reuses requires_input sessions with stored URL", () => {
    expect(
      shouldReuseKycSessionUrl({
        latestSessionStatus: "requires_input",
        decisionPayload: {
          sessionUrl: "https://magic.veriff.me/v/abc",
          verification: { status: "resubmission_requested", reasonCode: 201 },
        },
      }),
    ).toBe(true);
  });

  it("skips reuse when resubmission limit reason code is 539", () => {
    expect(
      shouldReuseKycSessionUrl({
        latestSessionStatus: "requires_input",
        decisionPayload: {
          sessionUrl: "https://magic.veriff.me/v/abc",
          verification: { status: "resubmission_requested", reasonCode: 539 },
        },
      }),
    ).toBe(false);
    expect(VERIFF_RESUBMISSION_LIMIT_REASON_CODE).toBe(539);
  });

  it("reads reason code from decision payload", () => {
    expect(
      readVeriffReasonCode({
        verification: { reasonCode: 539 },
      }),
    ).toBe(539);
  });
});

describe("mergeKycDecisionPayload", () => {
  it("preserves sessionUrl across webhook updates", () => {
    const merged = mergeKycDecisionPayload(
      { sessionUrl: "https://magic.veriff.me/v/abc" },
      {
        status: "success",
        verification: { id: "abc", status: "resubmission_requested" },
      },
    );
    expect(readKycSessionUrl(merged)).toBe("https://magic.veriff.me/v/abc");
    expect(merged.verification).toBeDefined();
  });
});
