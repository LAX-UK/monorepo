import { describe, expect, it, vi } from "vitest";
import {
  buildMagicLinkVerifyAfterHooks,
  runMagicLinkVerifyAfter,
} from "./magic-link-verify-hooks.js";

describe("buildMagicLinkVerifyAfterHooks", () => {
  it("matches only magic-link verify path", () => {
    const hook = buildMagicLinkVerifyAfterHooks({ webOrigin: "https://lax.bid" });
    expect(hook.matcher({ path: "/magic-link/verify" })).toBe(true);
    expect(hook.matcher({ path: "/sign-in/magic-link" })).toBe(false);
    expect(hook.matcher({ path: "/sign-in/email" })).toBe(false);
  });
});

function baseDeps(overrides: Partial<Parameters<typeof runMagicLinkVerifyAfter>[0]> = {}) {
  const redirect = vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }) as unknown as (url: string) => never;
  return {
    user: { id: "u1", email: "a@b.com", name: "A", twoFactorEnabled: false },
    sessionToken: "tok",
    loginUrl: "https://lax.bid/login?twofa_required=1",
    onEmailVerified: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    deleteCookie: vi.fn(),
    redirect,
    ...overrides,
  };
}

describe("runMagicLinkVerifyAfter", () => {
  it("no-ops without a user or session token", async () => {
    const deps = baseDeps({ user: undefined });
    await runMagicLinkVerifyAfter(deps);
    expect(deps.onEmailVerified).not.toHaveBeenCalled();
    expect(deps.deleteSession).not.toHaveBeenCalled();
  });

  it("non-2FA user: fires onEmailVerified, keeps the session, no redirect", async () => {
    const deps = baseDeps();
    await runMagicLinkVerifyAfter(deps);
    expect(deps.onEmailVerified).toHaveBeenCalledWith({ id: "u1", email: "a@b.com", name: "A" });
    expect(deps.deleteSession).not.toHaveBeenCalled();
    expect(deps.deleteCookie).not.toHaveBeenCalled();
    expect(deps.redirect).not.toHaveBeenCalled();
  });

  it("2FA user: fires onEmailVerified, revokes session, clears cookie, redirects", async () => {
    const deps = baseDeps({
      user: { id: "u1", email: "a@b.com", name: "A", twoFactorEnabled: true },
    });
    await expect(runMagicLinkVerifyAfter(deps)).rejects.toThrow(
      "redirect:https://lax.bid/login?twofa_required=1",
    );
    expect(deps.onEmailVerified).toHaveBeenCalledTimes(1);
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
    await expect(runMagicLinkVerifyAfter(deps)).rejects.toThrow("redirect:");
    expect(deleteSession).toHaveBeenCalledTimes(2);
    expect(deps.deleteCookie).toHaveBeenCalledTimes(1);
  });
});
