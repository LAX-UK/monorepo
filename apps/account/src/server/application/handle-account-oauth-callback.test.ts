import { describe, expect, it } from "vitest";
import { resolveAccountOAuthCallback } from "./handle-account-oauth-callback.js";

describe("resolveAccountOAuthCallback", () => {
  it("maps OAuth errors", () => {
    const outcome = resolveAccountOAuthCallback(
      { code: null, state: "s", oauthError: "access_denied", errorDescription: null },
      { pendingRaw: undefined, hadLoginRetry: false },
    );
    expect(outcome).toMatchObject({ kind: "login_error", reason: "access_denied" });
  });

  it("requires pending cookie for exchange", () => {
    const outcome = resolveAccountOAuthCallback(
      { code: "c", state: "s", oauthError: null, errorDescription: null },
      { pendingRaw: undefined, hadLoginRetry: true },
    );
    expect(outcome.kind).toBe("missing_pending");
  });
});
