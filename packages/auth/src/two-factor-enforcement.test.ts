import { describe, expect, it, vi } from "vitest";
import {
  buildTwoFactorChallengeUrl,
  buildTwoFactorEnforcementAfterHook,
  enforceTwoFactorOnNewSession,
  extractNextFromCallbackUrl,
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

describe("extractNextFromCallbackUrl", () => {
  it("extracts a safe relative next from an absolute callback URL", () => {
    expect(
      extractNextFromCallbackUrl("https://lax.bid/auth/activate/set-password?next=%2Flots%2Fabc"),
    ).toBe("/lots/abc");
  });

  it("extracts from a relative callback URL", () => {
    expect(extractNextFromCallbackUrl("/auth/activate/set-password?next=%2Fdashboard")).toBe(
      "/dashboard",
    );
  });

  it("rejects unsafe next values", () => {
    expect(extractNextFromCallbackUrl("https://lax.bid/cb?next=https%3A%2F%2Fevil.com")).toBeNull();
    expect(extractNextFromCallbackUrl("https://lax.bid/cb?next=%2F%2Fevil.com")).toBeNull();
  });

  it("returns null without a callback or next", () => {
    expect(extractNextFromCallbackUrl(null)).toBeNull();
    expect(extractNextFromCallbackUrl("https://lax.bid/auth/activate/set-password")).toBeNull();
  });
});

describe("buildTwoFactorChallengeUrl", () => {
  it("builds the bare challenge URL on the Identity issuer", () => {
    expect(buildTwoFactorChallengeUrl("https://auth.lax.bid")).toBe(
      "https://auth.lax.bid/two-factor",
    );
  });

  it("preserves a safe next from the callback URL", () => {
    expect(
      buildTwoFactorChallengeUrl("https://auth.lax.bid/", "https://lax.bid/cb?next=%2Flots%2F1"),
    ).toBe(
      "https://auth.lax.bid/two-factor?next=%2Flots%2F1&callbackURL=https%3A%2F%2Flax.bid%2Fcb%3Fnext%3D%252Flots%252F1",
    );
  });
});

describe("buildTwoFactorEnforcementAfterHook", () => {
  it("matches non-exempt paths only", () => {
    const hook = buildTwoFactorEnforcementAfterHook({ authOrigin: "https://auth.lax.bid" });
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
    challengeUrl: "https://auth.lax.bid/two-factor",
    isTrustedDevice: vi.fn().mockResolvedValue(false),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    deleteCookie: vi.fn(),
    createPendingChallenge: vi.fn().mockResolvedValue(undefined),
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
    expect(deps.createPendingChallenge).not.toHaveBeenCalled();
  });

  it("non-2FA user: keeps the session, no redirect", async () => {
    const deps = baseDeps();
    await enforceTwoFactorOnNewSession(deps);
    expect(deps.deleteSession).not.toHaveBeenCalled();
    expect(deps.deleteCookie).not.toHaveBeenCalled();
    expect(deps.redirect).not.toHaveBeenCalled();
  });

  it("2FA user on a trusted device: keeps the session, no challenge", async () => {
    const deps = baseDeps({
      user: { id: "u1", email: "a@b.com", name: "A", twoFactorEnabled: true },
      isTrustedDevice: vi.fn().mockResolvedValue(true),
    });
    await enforceTwoFactorOnNewSession(deps);
    expect(deps.deleteSession).not.toHaveBeenCalled();
    expect(deps.createPendingChallenge).not.toHaveBeenCalled();
    expect(deps.redirect).not.toHaveBeenCalled();
  });

  it("2FA user: revokes session, creates pending challenge, redirects to the TOTP page", async () => {
    const deps = baseDeps({
      user: { id: "u1", email: "a@b.com", name: "A", twoFactorEnabled: true },
    });
    await expect(enforceTwoFactorOnNewSession(deps)).rejects.toThrow(
      "redirect:https://auth.lax.bid/two-factor",
    );
    expect(deps.deleteSession).toHaveBeenCalledWith("tok");
    expect(deps.deleteCookie).toHaveBeenCalledTimes(1);
    expect(deps.createPendingChallenge).toHaveBeenCalledTimes(1);
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

  it("still redirects when pending challenge creation fails (degrades to /login bounce)", async () => {
    const deps = baseDeps({
      user: { id: "u1", email: "a@b.com", name: "A", twoFactorEnabled: true },
      createPendingChallenge: vi.fn().mockRejectedValue(new Error("db down")),
    });
    await expect(enforceTwoFactorOnNewSession(deps)).rejects.toThrow(
      "redirect:https://auth.lax.bid/two-factor",
    );
    expect(deps.deleteSession).toHaveBeenCalledWith("tok");
  });
});
