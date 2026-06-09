import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActivateSetPasswordController } from "./use-activate-set-password-controller";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: vi.fn(() => new URLSearchParams("next=%2Fdashboard")),
}));

const setupPassword = vi.fn();
const useConnectedAccounts = vi.fn();

vi.mock("@/lib/auth/hooks/use-connected-accounts", () => ({
  useConnectedAccounts: () => useConnectedAccounts(),
}));

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => ({
    user: {
      email: "ada@example.com",
      role: "client",
      emailVerified: true,
      suspended: false,
    },
  }),
}));

describe("useActivateSetPasswordController", () => {
  beforeEach(() => {
    replace.mockClear();
    setupPassword.mockReset();
    useConnectedAccounts.mockReturnValue({
      state: { hasPassword: false },
      loading: false,
      setupPassword,
    });
  });

  it("does not skip set-password when only safe next is present", () => {
    renderHook(() => useActivateSetPasswordController());
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects when client detects an existing password (fallback)", () => {
    useConnectedAccounts.mockReturnValue({
      state: { hasPassword: true },
      loading: false,
      setupPassword,
    });
    renderHook(() => useActivateSetPasswordController());
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });
});
