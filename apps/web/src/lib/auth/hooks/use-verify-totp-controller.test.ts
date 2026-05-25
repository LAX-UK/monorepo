import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVerifyTotpController } from "./use-verify-totp-controller";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/auth/use-refetch-app-session", () => ({
  useRefetchAppSession: () => vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/fetch-session-user.client", () => ({
  fetchSessionUserAfterAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth/services/verify-totp.service", () => ({
  verifyTotpService: vi.fn().mockRejectedValue(new Error("network")),
}));

vi.mock("@/lib/analytics/events", () => ({
  trackLogin: vi.fn(),
}));

vi.mock("@/lib/auth/auth-broadcast", () => ({
  postAuthBroadcast: vi.fn(),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { error: vi.fn() },
}));

describe("useVerifyTotpController", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("clears busy after verifyTotpService throws", async () => {
    const { result } = renderHook(() => useVerifyTotpController("/dashboard"));

    await act(async () => {
      await result.current.submitTotp("123456");
    });

    expect(result.current.busy).toBe(false);
    expect(result.current.bannerError).toBe("Network error. Try again.");
  });
});
