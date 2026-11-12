import { ACCOUNT_STEP_UP_REASON_PARAM } from "@auction/identity-contracts/account";
import { describe, expect, it } from "vitest";
import { buildReauthHref } from "./account-reauth";

describe("buildReauthHref", () => {
  it("asks for a fresh sign-in and says where to come back to", () => {
    const url = new URL(buildReauthHref("/account/security"), "https://account.test");
    expect(url.pathname).toBe("/api/auth/login");
    expect(url.searchParams.get("intent")).toBe("reauth");
    expect(url.searchParams.get("returnTo")).toBe("/account/security");
    expect(url.searchParams.has("reason")).toBe(false);
  });

  it("carries the reason when one is given", () => {
    const url = new URL(
      buildReauthHref("/account/security", "add_sign_in_method"),
      "https://account.test",
    );
    expect(url.searchParams.get("reason")).toBe("add_sign_in_method");
  });

  it("names the parameter the issuer reads", () => {
    expect(ACCOUNT_STEP_UP_REASON_PARAM).toBe("reauth_reason");
  });
});
