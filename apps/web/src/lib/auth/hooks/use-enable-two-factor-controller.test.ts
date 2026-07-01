import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEnableTwoFactorController } from "./use-enable-two-factor-controller";

const enableTwoFactorService = vi.fn();
const verifyTotpService = vi.fn();
const notifyTwoFactorEnabledEmail = vi.fn();
const refetchSession = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth/services/enable-two-factor.service", () => ({
  enableTwoFactorService: (...args: unknown[]) => enableTwoFactorService(...args),
}));

vi.mock("@/lib/auth/services/verify-totp.service", () => ({
  verifyTotpService: (...args: unknown[]) => verifyTotpService(...args),
}));

vi.mock("@/lib/auth/security-notify.client", () => ({
  notifyTwoFactorEnabledEmail: (...args: unknown[]) => notifyTwoFactorEnabledEmail(...args),
}));

vi.mock("@/lib/auth/use-refetch-app-session", () => ({
  useRefetchAppSession: () => refetchSession,
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { error: vi.fn() },
}));

describe("useEnableTwoFactorController", () => {
  beforeEach(() => {
    enableTwoFactorService.mockReset();
    verifyTotpService.mockReset();
    notifyTwoFactorEnabledEmail.mockReset();
    refetchSession.mockClear();
  });

  it("does not notify after the password step; only notifies once TOTP is confirmed", async () => {
    enableTwoFactorService.mockResolvedValue({
      ok: true,
      totpURI: "otpauth://totp/LAX:a@b.com",
      backupCodes: ["a1b2c3"],
    });
    verifyTotpService.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useEnableTwoFactorController());

    act(() => {
      result.current.pwdForm.setValue("password", "secret12");
    });
    await act(async () => {
      await result.current.startEnable();
    });

    // Password step only creates an unverified TOTP secret — 2FA isn't on yet,
    // so no "enabled" email should have gone out.
    expect(result.current.step).toBe("qr");
    expect(notifyTwoFactorEnabledEmail).not.toHaveBeenCalled();

    act(() => {
      result.current.confirmForm.setValue("code", "123456");
    });
    await act(async () => {
      await result.current.verifyEnable();
    });

    // Only now has Better Auth actually flipped user.twoFactorEnabled.
    expect(result.current.step).toBe("backup");
    expect(notifyTwoFactorEnabledEmail).toHaveBeenCalledTimes(1);
  });

  it("does not notify when the TOTP confirmation fails", async () => {
    verifyTotpService.mockResolvedValue({
      ok: false,
      code: "totp_invalid",
      message: "That code is not valid. Try again.",
    });

    const { result } = renderHook(() => useEnableTwoFactorController());

    act(() => {
      result.current.confirmForm.setValue("code", "000000");
    });
    await act(async () => {
      await result.current.verifyEnable();
    });

    expect(notifyTwoFactorEnabledEmail).not.toHaveBeenCalled();
    expect(result.current.step).toBe("password");
  });

  it("does not notify when the password step fails", async () => {
    enableTwoFactorService.mockResolvedValue({
      ok: false,
      code: "two_factor_enable_failed",
      message: "We could not start two-factor setup. Check your password and try again.",
    });

    const { result } = renderHook(() => useEnableTwoFactorController());

    act(() => {
      result.current.pwdForm.setValue("password", "wrong-password");
    });
    await act(async () => {
      await result.current.startEnable();
    });

    expect(notifyTwoFactorEnabledEmail).not.toHaveBeenCalled();
    expect(result.current.step).toBe("password");
  });
});
