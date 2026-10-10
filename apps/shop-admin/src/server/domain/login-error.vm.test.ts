import { describe, expect, it } from "vitest";
import { shopAdminLoginErrorView } from "./login-error.vm.js";

describe("shopAdminLoginErrorView", () => {
  it("offers retry and switch account for mfa_required", () => {
    const view = shopAdminLoginErrorView("mfa_required");
    expect(view.showRetrySignIn).toBe(true);
    expect(view.showUseDifferentAccount).toBe(true);
  });

  it("offers retry for missing_code", () => {
    const view = shopAdminLoginErrorView("missing_code");
    expect(view.showRetrySignIn).toBe(true);
  });
});
