import { describe, expect, it, vi } from "vitest";
import {
  buildTwoFactorEnforcementAfterHook,
  enforceTwoFactorOnNewSession,
  isTwoFactorExemptPath,
} from "./two-factor-enforcement.js";

describe("isTwoFactorExemptPath", () => {
  it("exempts credential sign-in paths (gated natively by Better Auth)", () => {
    expect(isTwoFactorExemptPath("/sign-in/email")).toBe(true);
    expect(isTwoFactorExemptPath("/sign-in/username")).toBe(true);
    expect(isTwoFactorExemptPath("/sign-in/phone-number")).toBe(true);
  });

  it("exempts two-factor endpoints (post-TOTP session)", () => {
    expect(isTwoFactorExemptPath("/two-factor/verify-totp")).toBe(true);
    expect(isTwoFactorExemptPath("/two-factor/verify-backup-code")).toBe(true);
  });

  it("exempts OAuth/social surfaces by policy", () => {
    expect(isTwoFactorExemptPath("/sign-in/social")).toBe(true);
    expect(isTwoFactorExemptPath("/callback/google")).toBe(true);
    expect(isTwoFactorExemptPath("/callback/apple")).toBe(true);
    expect(isTwoFactorExemptPath("/oauth2/callback/x")).toBe(true);
  });

  it("does not exempt passwordless session-creating paths", () => {
    expect(isTwoFactorExemptPath("/magic-link/verify")).toBe(false);
    expect(isTwoFactorExemptPath("/verify-email")).toBe(false);
  });

  it("does not exempt unrelated prefixed paths", () => {
    expect(isTwoFactorExemptPath("/sign-in/email-otp")).toBe(false);
  });
});

describe("buildTwoFactorEnforcementAfterHook", () => {
  it("matches non-exempt paths only", () => {
    const hook = buildTwoFactorEnforcementAfterHook({ webOrigin: "https://lax.bid" });
    expect(hook.matcher({ path: "/magic-link/verify" })).toBe(true);
    expect(hook.matcher({ path: "/verify-email" })).toBe(true);
    expect(hook.matcher({ path: "/sign-in/email" })).toBe(false);
    expect(hook.matcher({ path: "/two-factor/verify-totp" })).toBe(false);
    expect(hook.matcher({ path: "/callback/google" })).toBe(false);
    expect(hook.matcher({})).toBe(true);
  });
});

function baseDeps(overrides: Partial<Parameters<typeof enforceTwoFactorOnNewSession>[0]> = {}) {
  const redirect = vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }) as unknown as (url: string) => never;
  return {
    user: { id: "u1", email: "a@b.com", name: "A", twoFactorEnabled: false },
    sessionToken: "tok",
    loginUrl: "https://lax.bid/login?twofa_required=1",
    deleteSession: vi.fn().mockResolvedValue(undefined),
    deleteCookie: vi.fn(),
    redirect,
    ...overrides,
  };
}

describe("enforceTwoFactorOnNewSession", () => {
  it("no-ops without a user or session token", async () => {
    const deps = baseDeps({ user: undefined });
    await enforceTwoFactorOnNewSession(deps);
    expect(deps.deleteSession).not.toHaveBeenCalled();
    expect(deps.deleteCookie).not.toHaveBeenCalled();
  });

  it("non-2FA user: keeps the session, no redirect", async () => {
    const deps = baseDeps();
    await enforceTwoFactorOnNewSession(deps);
    expect(deps.deleteSession).not.toHaveBeenCalled();
    expect(deps.deleteCookie).not.toHaveBeenCalled();
    expect(deps.redirect).not.toHaveBeenCalled();
  });

  it("2FA user: revokes session, clears cookie, redirects", async () => {
    const deps = baseDeps({
      user: { id: "u1", email: "a@b.com", name: "A", twoFactorEnabled: true },
    });
    await expect(enforceTwoFactorOnNewSession(deps)).rejects.toThrow(
      "redirect:https://lax.bid/login?twofa_required=1",
    );
    expect(deps.deleteSession).toHaveBeenCalledWith("tok");
    expect(deps.deleteCookie).toHaveBeenCalledTimes(1);
  });

  it("2FA user: retries revoke once on failure but still redirects", async () => {
    const deleteSession = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const deps = baseDeps({
      user: { id: "u1", email: "a@b.com", name: "A", twoFactorEnabled: true },
      deleteSession,
    });
    await expect(enforceTwoFactorOnNewSession(deps)).rejects.toThrow("redirect:");
    expect(deleteSession).toHaveBeenCalledTimes(2);
    expect(deps.deleteCookie).toHaveBeenCalledTimes(1);
  });
});
