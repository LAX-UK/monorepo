import { describe, expect, it } from "vitest";
import {
  resolveIdentityOnboardingPresentation,
  resolveIdentitySkipLabel,
} from "./identity-onboarding-presentation";

const summary = {
  status: "unverified",
  latestSessionStatus: null,
  feedback: {
    headline: "Not verified",
    detail: null,
    action: "start",
    needsResubmit: false,
  },
};

describe("resolveIdentityOnboardingPresentation", () => {
  it("uses Verify later for skippable sources and hides skip on hard gates", () => {
    expect(resolveIdentitySkipLabel("sign_in")).toBe("Verify later");
    expect(resolveIdentitySkipLabel("post_verify")).toBe("Verify later");
    expect(resolveIdentitySkipLabel("bid_gate")).toBeNull();
  });

  it("uses contextual hard-gate copy for restricted actions", () => {
    expect(
      resolveIdentityOnboardingPresentation(summary as never, "bid_gate", false),
    ).toMatchObject({
      title: "Verify to continue",
      showPreparation: true,
      showProgress: false,
    });
  });

  it("uses a focused, non-step presentation for returning sign-ins", () => {
    expect(resolveIdentityOnboardingPresentation(summary as never, "sign_in", false)).toMatchObject(
      {
        title: "Verify your identity",
        showProgress: false,
        showPreparation: true,
      },
    );
  });

  it("uses lot-specific Figma copy only when the full flow provides a lot", () => {
    expect(
      resolveIdentityOnboardingPresentation(summary as never, "post_verify", true),
    ).toMatchObject({
      title: "One step from bidding on",
      showProgress: true,
    });
    expect(
      resolveIdentityOnboardingPresentation(summary as never, "post_verify", false).title,
    ).toBe("Verify your identity");
  });

  it("does not ask a pending user to prepare or restart", () => {
    const pending = {
      ...summary,
      status: "pending",
      feedback: { ...summary.feedback, action: "wait", detail: "Review underway" },
    } as never;
    expect(resolveIdentityOnboardingPresentation(pending, "sign_in", false)).toMatchObject({
      title: "Verification in progress",
      detail: "Review underway",
      showPreparation: false,
      showProgress: false,
    });
  });

  it("explains retry and resume states without generic onboarding copy", () => {
    const retry = {
      ...summary,
      status: "rejected",
      feedback: {
        ...summary.feedback,
        headline: "New photo needed",
        detail: "Please submit a clearer photo.",
        action: "retry",
        needsResubmit: true,
      },
    } as never;
    expect(resolveIdentityOnboardingPresentation(retry, "sign_in", false)).toMatchObject({
      title: "Let’s verify your identity again",
      message: "New photo needed",
    });

    const resume = {
      ...summary,
      latestSessionStatus: "created",
      feedback: { ...summary.feedback, action: "continue" },
    } as never;
    expect(resolveIdentityOnboardingPresentation(resume, "sign_in", false).title).toBe(
      "Continue your identity verification",
    );
  });
});
