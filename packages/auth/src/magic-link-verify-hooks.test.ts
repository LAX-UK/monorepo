import { describe, expect, it, vi } from "vitest";
import {
  buildMagicLinkVerifyAfterHooks,
  runMagicLinkVerifyAfter,
} from "./magic-link-verify-hooks.js";

describe("buildMagicLinkVerifyAfterHooks", () => {
  it("matches only magic-link verify path", () => {
    const hook = buildMagicLinkVerifyAfterHooks({});
    expect(hook.matcher({ path: "/magic-link/verify" })).toBe(true);
    expect(hook.matcher({ path: "/sign-in/magic-link" })).toBe(false);
    expect(hook.matcher({ path: "/sign-in/email" })).toBe(false);
  });
});

function baseDeps(overrides: Partial<Parameters<typeof runMagicLinkVerifyAfter>[0]> = {}) {
  return {
    user: { id: "u1", email: "a@b.com", name: "A" },
    sessionToken: "tok",
    onEmailVerified: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("runMagicLinkVerifyAfter", () => {
  it("no-ops without a user or session token", async () => {
    const deps = baseDeps({ user: undefined });
    await runMagicLinkVerifyAfter(deps);
    expect(deps.onEmailVerified).not.toHaveBeenCalled();
  });

  it("fires onEmailVerified with the user identity", async () => {
    const deps = baseDeps();
    await runMagicLinkVerifyAfter(deps);
    expect(deps.onEmailVerified).toHaveBeenCalledWith({ id: "u1", email: "a@b.com", name: "A" });
  });

  it("swallows onEmailVerified failures (parity is best-effort)", async () => {
    const deps = baseDeps({
      onEmailVerified: vi.fn().mockRejectedValue(new Error("boom")),
    });
    await expect(runMagicLinkVerifyAfter(deps)).resolves.toBeUndefined();
  });
});
