import { describe, expect, it, vi } from "vitest";
import {
  buildTwoFactorChallengeUrl,
  buildTwoFactorEnforcementAfterHook,
  enforceTwoFactorOnNewSession,
  extractNextFromCallbackUrl,
  isTwoFactorExemptPath,
  resolveCallbackUrl,
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

  it("does not exempt a Google or Apple sign-in: the code is asked for after the provider too", () => {
    expect(isTwoFactorExemptPath("/sign-in/social")).toBe(false);
    expect(isTwoFactorExemptPath("/callback/google")).toBe(false);
    expect(isTwoFactorExemptPath("/callback/apple")).toBe(false);
    expect(isTwoFactorExemptPath("/callback/:id")).toBe(false);
  });

  it("exempts the OIDC provider's own endpoints, which create no sign-in session", () => {
    expect(isTwoFactorExemptPath("/oauth2/authorize")).toBe(true);
    expect(isTwoFactorExemptPath("/oauth2/token")).toBe(true);
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
    expect(extractNextFromCallbackUrl("/auth/activate/set-password?next=%2Fhome")).toBe("/home");
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

describe("buildTwoFactorChallengeUrl destination", () => {
  it("repeats the client hint and authorize request of the callback so the challenge page can resume", () => {
    const callback =
      "https://auth.lax.bid/api/auth/oauth2/authorize?client_id=lax-shop-web&response_type=code&state=abc";
    const url = new URL(buildTwoFactorChallengeUrl("https://auth.lax.bid", callback));
    expect(url.pathname).toBe("/two-factor");
    expect(url.searchParams.get("client_id")).toBe("lax-shop-web");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("abc");
    expect(url.searchParams.get("callbackURL")).toBe(callback);
  });

  it("does not lift arbitrary callback parameters", () => {
    const url = new URL(
      buildTwoFactorChallengeUrl("https://auth.lax.bid", "https://lax.bid/cb?secret=1&client_id=x"),
    );
    expect(url.searchParams.get("secret")).toBeNull();
  });
});

describe("resolveCallbackUrl", () => {
  it("uses the query's callback URL for a magic link or an email verification", () => {
    expect(resolveCallbackUrl({ callbackURL: "https://lax.bid/cb" }, null)).toBe(
      "https://lax.bid/cb",
    );
    expect(
      resolveCallbackUrl({ callbackURL: "https://lax.bid/cb" }, { callbackURL: "https://other/" }),
    ).toBe("https://lax.bid/cb");
  });

  it("falls back to the provider round trip's state for a Google or Apple callback", () => {
    expect(
      resolveCallbackUrl(
        { code: "abc", state: "xyz" },
        { callbackURL: "https://auth.lax.bid/login?client_id=lax-shop-web" },
      ),
    ).toBe("https://auth.lax.bid/login?client_id=lax-shop-web");
  });

  it("is null when neither knows where the person was heading", () => {
    expect(resolveCallbackUrl(undefined, null)).toBeNull();
    expect(resolveCallbackUrl({}, {})).toBeNull();
    expect(resolveCallbackUrl({ callbackURL: 3 }, { callbackURL: 4 })).toBeNull();
  });
});

describe("a Google or Apple session for a person with two-step on", () => {
  it("is revoked and sent to the code page, with the product's own destination kept", async () => {
    const callbackURL = "https://auth.lax.bid/login?client_id=lax-shop-web&next=%2Fbasket";
    const deps = baseDeps({
      user: { id: "u1", email: "a@b.com", name: "A", twoFactorEnabled: true },
      challengeUrl: buildTwoFactorChallengeUrl("https://auth.lax.bid", callbackURL),
    });
    await expect(enforceTwoFactorOnNewSession(deps)).rejects.toThrow(
      /^redirect:https:\/\/auth\.lax\.bid\/two-factor\?next=%2Fbasket&callbackURL=/,
    );
    expect(deps.deleteSession).toHaveBeenCalledWith("tok");
    expect(deps.createPendingChallenge).toHaveBeenCalledTimes(1);
  });

  it("is kept when the person has no two-step to answer", async () => {
    const deps = baseDeps();
    await enforceTwoFactorOnNewSession(deps);
    expect(deps.deleteSession).not.toHaveBeenCalled();
  });
});

describe("buildTwoFactorEnforcementAfterHook", () => {
  it("matches non-exempt paths only", () => {
    const hook = buildTwoFactorEnforcementAfterHook({ authOrigin: "https://auth.lax.bid" });
    expect(hook.matcher({ path: "/magic-link/verify" })).toBe(true);
    expect(hook.matcher({ path: "/verify-email" })).toBe(true);
    expect(hook.matcher({ path: "/sign-in/email" })).toBe(false);
    expect(hook.matcher({ path: "/two-factor/verify-totp" })).toBe(false);
    expect(hook.matcher({ path: "/callback/google" })).toBe(true);
    expect(hook.matcher({ path: "/callback/:id" })).toBe(true);
    expect(hook.matcher({ path: "/sign-in/social" })).toBe(true);
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
