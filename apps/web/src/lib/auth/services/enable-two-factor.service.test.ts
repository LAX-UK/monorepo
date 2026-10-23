import { describe, expect, it, vi } from "vitest";

const { enable } = vi.hoisted(() => ({ enable: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({
  authClient: { twoFactor: { enable } },
}));

import { enableTwoFactorService } from "@/lib/auth/services/enable-two-factor.service";

describe("enableTwoFactorService", () => {
  it("returns the TOTP URI and backup codes", async () => {
    // 2FA is not on yet after this step: Better Auth only flips user.twoFactorEnabled once the
    // TOTP code is confirmed.
    enable.mockResolvedValue({
      data: { totpURI: "otpauth://totp/LAX:a@b.com", backupCodes: ["a1b2c3", "d4e5f6"] },
    });

    const r = await enableTwoFactorService("secret12");

    expect(r).toEqual({
      ok: true,
      totpURI: "otpauth://totp/LAX:a@b.com",
      backupCodes: ["a1b2c3", "d4e5f6"],
    });
  });

  it("maps an error response to a failure result without sending the email", async () => {
    enable.mockResolvedValue({ error: { message: "Invalid password", code: "INVALID_PASSWORD" } });

    const r = await enableTwoFactorService("wrong-password");

    expect(r.ok).toBe(false);
  });

  it("treats a missing totpURI/backupCodes payload as two_factor_unexpected_response", async () => {
    enable.mockResolvedValue({ data: {} });

    const r = await enableTwoFactorService("secret12");

    expect(r).toEqual({
      ok: false,
      code: "two_factor_unexpected_response",
      message: expect.any(String),
    });
  });

  it("calls enable without a password for OAuth-only users", async () => {
    enable.mockResolvedValue({
      data: { totpURI: "otpauth://totp/LAX:a@b.com", backupCodes: ["a1b2c3"] },
    });

    await enableTwoFactorService();

    expect(enable).toHaveBeenCalledWith({});
  });
});
