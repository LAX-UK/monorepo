import { describe, expect, it, vi } from "vitest";
import { AUTH_TIMINGS } from "./auth-timings.js";
import { buildEmailAndPasswordBlock, buildJwtAndOidcPlugins } from "./server-plugins.js";

describe("buildEmailAndPasswordBlock", () => {
  it("wires resetPasswordTokenExpiresIn from AUTH_TIMINGS", () => {
    const block = buildEmailAndPasswordBlock({});
    expect(block.resetPasswordTokenExpiresIn).toBe(AUTH_TIMINGS.resetPasswordExpiresSec);
  });

  it("enqueues warning email when revokeAllSessions fails on password reset", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const block = buildEmailAndPasswordBlock({
      email: { enqueue },
      webOrigin: "https://lax.bid",
      revokeAllSessions: vi.fn().mockRejectedValue(new Error("db down")),
    });

    await expect(
      block.onPasswordReset({ user: { id: "u1", email: "e@e.com", name: "N" } }),
    ).resolves.toBeUndefined();

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "password-changed-sessions-not-revoked",
        to: "e@e.com",
        vars: expect.objectContaining({
          sessionsSettingsUrl: "https://lax.bid/dashboard/settings/sessions",
        }),
      }),
    );
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ template: "password-changed" }));
  });
});

describe("buildJwtAndOidcPlugins", () => {
  it("enables passwordless 2FA management for OAuth-only users", () => {
    const plugins = buildJwtAndOidcPlugins({
      db: {} as never,
      issuer: "https://auth.lax.bid",
      jwtAudience: "lax-api",
    });

    const twoFactorPlugin = plugins.find((plugin) => {
      const options = (plugin as { options?: { allowPasswordless?: boolean; issuer?: string } })
        .options;
      return options?.issuer === "LAX";
    });

    expect(twoFactorPlugin).toBeDefined();
    expect((twoFactorPlugin as { options?: { allowPasswordless?: boolean } }).options).toEqual(
      expect.objectContaining({ issuer: "LAX", allowPasswordless: true }),
    );
  });
});
