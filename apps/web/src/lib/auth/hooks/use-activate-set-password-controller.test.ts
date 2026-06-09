import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActivateSetPasswordController } from "./use-activate-set-password-controller";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: vi.fn(() => new URLSearchParams("next=%2Fdashboard")),
}));

const setupPassword = vi.fn();

vi.mock("@/lib/auth/hooks/use-connected-accounts", () => ({
  useConnectedAccounts: () => ({
    state: { hasPassword: false },
    loading: false,
    setupPassword,
  }),
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
  });

  it("skips set-password when safe next is present (repeat magic-link login)", () => {
    renderHook(() => useActivateSetPasswordController());

    expect(replace).toHaveBeenCalledWith("/dashboard");
  });
});
