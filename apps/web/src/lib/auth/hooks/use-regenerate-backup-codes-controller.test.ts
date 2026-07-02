import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const regenerateBackupCodesService = vi.fn();
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

vi.mock("@/lib/auth/services/regenerate-backup-codes.service", () => ({
  regenerateBackupCodesService: (...args: unknown[]) => regenerateBackupCodesService(...args),
}));

vi.mock("@/lib/auth/use-refetch-app-session", () => ({
  useRefetchAppSession: () => refetchSession,
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn() },
}));

import { useRegenerateBackupCodesController } from "./use-regenerate-backup-codes-controller";

describe("useRegenerateBackupCodesController", () => {
  beforeEach(() => {
    mockHasPassword = true;
    mockLoading = false;
    regenerateBackupCodesService.mockReset();
    refetchSession.mockClear();
  });

  it("regenerates backup codes without a password for OAuth-only users", async () => {
    mockHasPassword = false;
    regenerateBackupCodesService.mockResolvedValue({
      ok: true,
      backupCodes: ["abc123"],
    });
    const onNewCodes = vi.fn();

    const { result } = renderHook(() => useRegenerateBackupCodesController(onNewCodes));
    await act(async () => {
      await result.current.submit();
    });

    expect(regenerateBackupCodesService).toHaveBeenCalledWith(undefined);
    expect(onNewCodes).toHaveBeenCalledWith(["abc123"]);
  });

  it("does not submit while account state is still loading", async () => {
    mockLoading = true;
    mockHasPassword = true;

    const { result } = renderHook(() => useRegenerateBackupCodesController(vi.fn()));
    await act(async () => {
      await result.current.submit();
    });

    expect(regenerateBackupCodesService).not.toHaveBeenCalled();
  });
});
