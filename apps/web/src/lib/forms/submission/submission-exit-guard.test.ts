import { describe, expect, it } from "vitest";
import { submissionExitGuardActive } from "./submission-exit-guard";

describe("submissionExitGuardActive", () => {
  it("is active only on the review step when submit-ready and not yet submitted", () => {
    expect(
      submissionExitGuardActive({
        isReviewStep: true,
        canSubmit: true,
        submittedThisSession: false,
      }),
    ).toBe(true);
  });

  it("is inactive before the review step", () => {
    expect(
      submissionExitGuardActive({
        isReviewStep: false,
        canSubmit: true,
        submittedThisSession: false,
      }),
    ).toBe(false);
  });

  it("is inactive when required fields are incomplete", () => {
    expect(
      submissionExitGuardActive({
        isReviewStep: true,
        canSubmit: false,
        submittedThisSession: false,
      }),
    ).toBe(false);
  });

  it("is inactive after submit in the current session", () => {
    expect(
      submissionExitGuardActive({
        isReviewStep: true,
        canSubmit: true,
        submittedThisSession: true,
      }),
    ).toBe(false);
  });
});
