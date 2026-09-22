import { describe, expect, it } from "vitest";
import { isCaptchaRequiredPayload, shouldRenderTurnstile, submitEnabled } from "./turnstile.js";

describe("hosted Turnstile gating", () => {
  it("renders the challenge only after captcha_required when a site key exists", () => {
    expect(isCaptchaRequiredPayload({ code: "captcha_required" })).toBe(true);
    expect(shouldRenderTurnstile({ captchaRequired: true, siteKey: "site-key" })).toBe(true);
    expect(shouldRenderTurnstile({ captchaRequired: true, siteKey: null })).toBe(false);
    expect(shouldRenderTurnstile({ captchaRequired: false, siteKey: "site-key" })).toBe(false);
  });

  it("disables submit after captcha_required until a token is present", () => {
    expect(submitEnabled({ captchaRequired: false, token: "" })).toBe(true);
    expect(submitEnabled({ captchaRequired: true, token: "" })).toBe(false);
    expect(submitEnabled({ captchaRequired: true, token: "tok" })).toBe(true);
  });
});
