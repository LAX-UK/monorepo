import { describe, expect, it } from "vitest";
import { shouldResetTurnstileAfterFailedSubmit } from "./turnstile-after-submit";

describe("shouldResetTurnstileAfterFailedSubmit", () => {
  it("resets for captcha and unknown failures", () => {
    expect(shouldResetTurnstileAfterFailedSubmit("captcha_invalid")).toBe(true);
    expect(shouldResetTurnstileAfterFailedSubmit(null)).toBe(true);
  });

  it("skips reset for rate limit and registration validation", () => {
    expect(shouldResetTurnstileAfterFailedSubmit("rate_limited")).toBe(false);
    expect(shouldResetTurnstileAfterFailedSubmit("registration_validation")).toBe(false);
  });
});
