import { describe, expect, it } from "vitest";
import type { LaxAccountConfig } from "../config";
import { startAccountLogin } from "./start-account-login";

const config = {
  publicOrigin: "https://account.test",
  oidcIssuer: "https://auth.test",
  oidcClientId: "lax-account-web",
} as LaxAccountConfig;

describe("startAccountLogin", () => {
  it("signs in normally by default, reusing an existing issuer session", () => {
    const { authorizeUrl, pending } = startAccountLogin({ config, returnTo: "/account" });
    expect(authorizeUrl.searchParams.has("prompt")).toBe(false);
    expect(authorizeUrl.searchParams.has("max_age")).toBe(false);
    expect(pending.reauth).toBeUndefined();
  });

  it("forces a fresh sign-in within five minutes for step-up, and remembers it", () => {
    const { authorizeUrl, pending } = startAccountLogin({
      config,
      returnTo: "/account/security",
      reauth: { subject: "user-a" },
    });
    expect(authorizeUrl.searchParams.get("prompt")).toBe("login");
    expect(authorizeUrl.searchParams.get("max_age")).toBe("300");
    expect(pending).toMatchObject({
      returnTo: "/account/security",
      reauth: true,
      reauthSubject: "user-a",
    });
  });

  it("passes why a fresh sign-in is asked for, only with a step-up", () => {
    const withReason = startAccountLogin({
      config,
      returnTo: "/account/security",
      reauth: { subject: "user-a", reason: "remove_sign_in_method" },
    });
    expect(withReason.authorizeUrl.searchParams.get("reauth_reason")).toBe("remove_sign_in_method");
    const without = startAccountLogin({
      config,
      returnTo: "/account/security",
      reauth: { subject: "user-a" },
    });
    expect(without.authorizeUrl.searchParams.has("reauth_reason")).toBe(false);
  });
});
