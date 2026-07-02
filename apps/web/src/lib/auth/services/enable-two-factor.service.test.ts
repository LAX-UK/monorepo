import { describe, expect, it, vi } from "vitest";

const { enable, notifyTwoFactorEnabledEmail } = vi.hoisted(() => ({
  enable: vi.fn(),
  notifyTwoFactorEnabledEmail: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { twoFactor: { enable } },
}));

vi.mock("@/lib/auth/security-notify.client", () => ({
  notifyTwoFactorEnabledEmail,
}));

import { enableTwoFactorService } from "@/lib/auth/services/enable-two-factor.service";

describe("enableTwoFactorService", () => {
  it("returns the TOTP URI and backup codes without sending the 'enabled' email", async () => {
    // 2FA is not actually on yet after this step — Better Auth only flips
    // user.twoFactorEnabled once the TOTP code is confirmed. The email must
    // only fire from the confirm step (see use-enable-two-factor-controller).
    enable.mockResolvedValue({
      data: { totpURI: "otpauth://totp/LAX:a@b.com", backupCodes: ["a1b2c3", "d4e5f6"] },
    });

    const r = await enableTwoFactorService("secret12");

    expect(r).toEqual({
      ok: true,
      totpURI: "otpauth://totp/LAX:a@b.com",
      backupCodes: ["a1b2c3", "d4e5f6"],
    });
    expect(notifyTwoFactorEnabledEmail).not.toHaveBeenCalled();
  });

  it("maps an error response to a failure result without sending the email", async () => {
    enable.mockResolvedValue({ error: { message: "Invalid password", code: "INVALID_PASSWORD" } });

    const r = await enableTwoFactorService("wrong-password");

    expect(r.ok).toBe(false);
    expect(notifyTwoFactorEnabledEmail).not.toHaveBeenCalled();
  });

  it("treats a missing totpURI/backupCodes payload as two_factor_unexpected_response", async () => {
    enable.mockResolvedValue({ data: {} });

    const r = await enableTwoFactorService("secret12");

    expect(r).toEqual({
      ok: false,
      code: "two_factor_unexpected_response",
      message: expect.any(String),
    });
    expect(notifyTwoFactorEnabledEmail).not.toHaveBeenCalled();
  });

  it("calls enable without a password for OAuth-only users", async () => {
    enable.mockResolvedValue({
      data: { totpURI: "otpauth://totp/LAX:a@b.com", backupCodes: ["a1b2c3"] },
    });

    await enableTwoFactorService();

    expect(enable).toHaveBeenCalledWith({});
  });
});
