import { describe, expect, it } from "vitest";
import { focusTargetForLoginStep, nextLoginStep } from "./login-state.js";

describe("hosted login state", () => {
  it("moves email-first sign-in through credentials and magic-link-sent", () => {
    expect(nextLoginStep("email", "continue-email")).toBe("credentials");
    expect(nextLoginStep("credentials", "change-email")).toBe("email");
    expect(nextLoginStep("credentials", "magic-link-sent")).toBe("magic-link-sent");
    expect(nextLoginStep("magic-link-sent", "change-email")).toBe("email");
  });

  it("preserves keyboard focus targets per step", () => {
    expect(focusTargetForLoginStep("email")).toBe("email");
    expect(focusTargetForLoginStep("credentials")).toBe("password");
    expect(focusTargetForLoginStep("magic-link-sent")).toBe("magic-link-resend");
  });
});
