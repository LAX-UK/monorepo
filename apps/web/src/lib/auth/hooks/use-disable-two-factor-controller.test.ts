import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const disableTwoFactorService = vi.fn();
const refetchSession = vi.fn().mockResolvedValue(undefined);

let mockHasPassword = true;
let mockLoading = false;

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
    error: null,
    refresh: vi.fn(),
    canUnlink: () => false,
    linkSocial: vi.fn(),
    unlinkAccount: vi.fn(),
    setupPassword: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/services/disable-two-factor.service", () => ({
  disableTwoFactorService: (...args: unknown[]) => disableTwoFactorService(...args),
}));

vi.mock("@/lib/auth/use-refetch-app-session", () => ({
  useRefetchAppSession: () => refetchSession,
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn() },
}));

import { useDisableTwoFactorController } from "./use-disable-two-factor-controller";

describe("useDisableTwoFactorController", () => {
  beforeEach(() => {
    mockHasPassword = true;
    mockLoading = false;
    disableTwoFactorService.mockReset();
    refetchSession.mockClear();
  });

  it("disables 2FA without a password for OAuth-only users", async () => {
    mockHasPassword = false;
    disableTwoFactorService.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useDisableTwoFactorController());
    await act(async () => {
      await result.current.submit();
    });

    expect(disableTwoFactorService).toHaveBeenCalledWith(undefined);
  });

  it("does not submit while account state is still loading", async () => {
    mockLoading = true;
    mockHasPassword = true;

    const { result } = renderHook(() => useDisableTwoFactorController());
    await act(async () => {
      await result.current.submit();
    });

    expect(disableTwoFactorService).not.toHaveBeenCalled();
  });
});
