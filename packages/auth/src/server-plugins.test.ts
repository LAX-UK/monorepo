import { describe, expect, it, vi } from "vitest";
import { AUTH_TIMINGS } from "./auth-timings.js";
import { buildEmailAndPasswordBlock } from "./server-plugins.js";

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
