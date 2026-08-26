import { describe, expect, it } from "vitest";
import { resolveKycBidBlockerPresentation } from "./kyc-blocker.presenter";

const href = "/onboarding/identity?next=%2Flot%2Fx&source=bid_gate&lot=lot-1";

describe("resolveKycBidBlockerPresentation", () => {
  it("maps wait feedback to a status action", () => {
    const presentation = resolveKycBidBlockerPresentation({
      href,
      strict: false,
      feedback: { action: "wait", headline: "In review", needsResubmit: false },
    });
    expect(presentation.tone).toBe("info");
    expect(presentation.title).toBe("In review");
    expect(presentation.action).toMatchObject({ kind: "status", label: "In review" });
    expect(presentation.preview).toBeDefined();
  });

  it("maps continue / resubmit feedback to a link action", () => {
    const presentation = resolveKycBidBlockerPresentation({
      href,
      strict: false,
      feedback: { action: "continue", needsResubmit: true },
    });
    expect(presentation.tone).toBe("warning");
    expect(presentation.action).toMatchObject({
      kind: "link",
      href,
      label: "Continue verification",
    });
  });

  it("maps retry feedback to a danger link", () => {
    const presentation = resolveKycBidBlockerPresentation({
      href,
      strict: true,
      feedback: { action: "retry", needsResubmit: false },
    });
    expect(presentation.tone).toBe("danger");
    expect(presentation.action).toMatchObject({
      kind: "link",
      label: "Try verification again",
      shortLabel: "Retry",
    });
  });

  it("maps none feedback to an unavailable status", () => {
    const presentation = resolveKycBidBlockerPresentation({
      href,
      strict: false,
      feedback: { action: "none", needsResubmit: false },
    });
    expect(presentation.action).toMatchObject({ kind: "status", label: "Action unavailable" });
  });

  it("uses strict copy when no feedback is provided", () => {
    const presentation = resolveKycBidBlockerPresentation({ href, strict: true });
    expect(presentation.title).toBe("Identity verification required");
    expect(presentation.detail).toBe("Your identity must be approved before you can place bids.");
    expect(presentation.action).toMatchObject({
      kind: "link",
      href,
      shortLabel: "Verify",
    });
  });
});
