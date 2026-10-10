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

  it("explains each staff login failure with its own copy and reference", () => {
    for (const reason of [
      "identity_unavailable",
      "token_exchange_failed",
      "invalid_id_token",
      "session_unavailable",
    ]) {
      const view = shopAdminLoginErrorView(reason);
      expect(view.code).toBe(reason);
      expect(view.message).not.toBe(shopAdminLoginErrorView("auth_failed").message);
    }
  });

  it("does not echo unknown reason values back to the page", () => {
    expect(shopAdminLoginErrorView("<script>").code).toBe("unknown");
  });
});
