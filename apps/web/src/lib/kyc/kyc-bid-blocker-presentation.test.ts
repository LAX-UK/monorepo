import { describe, expect, it } from "vitest";
import { resolveKycBidBlockerPresentation } from "./kyc-bid-blocker-presentation";

const href = "/onboarding/identity?next=%2Flot%2Fone";

describe("resolveKycBidBlockerPresentation", () => {
  it.each([
    {
      name: "starts a new verification",
      feedback: null,
      actionKind: "link",
      label: "Start identity verification",
      tone: "warning",
    },
    {
      name: "continues an existing session",
      feedback: { action: "continue" as const, needsResubmit: false },
      actionKind: "link",
      label: "Continue verification",
      tone: "warning",
    },
    {
      name: "shows an in-review status without a fake CTA",
      feedback: { action: "wait" as const, needsResubmit: false },
      actionKind: "status",
      label: "In review",
      tone: "info",
    },
    {
      name: "retries a rejected verification",
      feedback: { action: "retry" as const, needsResubmit: false },
      actionKind: "link",
      label: "Try verification again",
      tone: "danger",
    },
    {
      name: "prioritizes resubmission feedback",
      feedback: { action: "none" as const, needsResubmit: true },
      actionKind: "link",
      label: "Continue verification",
      tone: "warning",
    },
    {
      name: "shows unavailable status when there is no action",
      feedback: { action: "none" as const, needsResubmit: false },
      actionKind: "status",
      label: "Action unavailable",
      tone: "warning",
    },
  ])("$name", ({ feedback, actionKind, label, tone }) => {
    const presentation = resolveKycBidBlockerPresentation({
      href,
      strict: true,
      feedback,
    });

    expect(presentation).toMatchObject({
      tone,
      action: { kind: actionKind, label },
    });
    expect(presentation.preview).toMatch(/one-time bid.*auto-bid/i);
    if (presentation.action?.kind === "link") expect(presentation.action.href).toBe(href);
  });

  it("falls back to useful retry copy when feedback detail is missing", () => {
    const presentation = resolveKycBidBlockerPresentation({
      href,
      strict: true,
      feedback: {
        action: "retry",
        needsResubmit: false,
        headline: "",
        detail: null,
      },
    });

    expect(presentation.title).toBe("Identity verification was not approved");
    expect(presentation.detail).toMatch(/submit your details again/i);
  });
});
