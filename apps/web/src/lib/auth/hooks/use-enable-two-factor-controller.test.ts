import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enableTwoFactorService = vi.fn();
const verifyTotpService = vi.fn();
const notifyTwoFactorEnabledEmail = vi.fn();
const refetchSession = vi.fn().mockResolvedValue(undefined);

let mockHasPassword = true;
let mockLoading = true;
let mockError: string | null = null;
const mockRefresh = vi.fn();

vi.mock("@/lib/auth/hooks/use-connected-accounts", () => ({
  useConnectedAccounts: () => ({
    state: {
      hasPassword: mockHasPassword,
      google: mockHasPassword ? null : { id: "1" },
      apple: null,
      totalMethods: 1,
      accounts: [],
    },
    loading: mockLoading,
    refreshing: false,
    error: mockError,
    refresh: mockRefresh,
    canUnlink: () => false,
    linkSocial: vi.fn(),
    unlinkAccount: vi.fn(),
    setupPassword: vi.fn(),
  }),
}));

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

import { useEnableTwoFactorController } from "./use-enable-two-factor-controller";

describe("useEnableTwoFactorController", () => {
  beforeEach(() => {
    mockHasPassword = true;
    mockLoading = false;
    mockError = null;
    mockRefresh.mockReset();
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

    expect(result.current.step).toBe("qr");
    expect(notifyTwoFactorEnabledEmail).not.toHaveBeenCalled();

    act(() => {
      result.current.confirmForm.setValue("code", "123456");
    });
    await act(async () => {
      await result.current.verifyEnable();
    });

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

  it("starts on the intro step and enables 2FA without a password for OAuth-only users", async () => {
    mockHasPassword = false;
    enableTwoFactorService.mockResolvedValue({
      ok: true,
      totpURI: "otpauth://totp/LAX:a@b.com",
      backupCodes: ["a1b2c3"],
    });

    const { result } = renderHook(() => useEnableTwoFactorController());

    expect(result.current.step).toBe("intro");
    expect(result.current.hasPassword).toBe(false);

    await act(async () => {
      await result.current.startPasswordlessEnable();
    });

    expect(enableTwoFactorService).toHaveBeenCalledWith(undefined);
    expect(result.current.step).toBe("qr");
  });

  it("re-aligns to the password step once account loading completes for password users", async () => {
    mockHasPassword = true;
    mockLoading = true;

    const { result, rerender } = renderHook(() => useEnableTwoFactorController());

    expect(result.current.step).toBe("intro");
    expect(result.current.accountsLoading).toBe(true);

    mockLoading = false;
    rerender();

    await waitFor(() => {
      expect(result.current.step).toBe("password");
    });
  });

  it("flags first-load account failures and exposes refresh", () => {
    mockLoading = false;
    mockError = "Could not load connected accounts.";

    const { result } = renderHook(() => useEnableTwoFactorController());

    expect(result.current.accountsFirstLoadFailed).toBe(true);
    expect(result.current.accountsError).toBe("Could not load connected accounts.");
    expect(result.current.refreshAccounts).toBe(mockRefresh);
  });
});
