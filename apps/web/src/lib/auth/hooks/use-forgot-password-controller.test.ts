import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useForgotPasswordController } from "./use-forgot-password-controller";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/use-auth-submit", () => ({
  useAuthSubmit: () => ({
    run: mocks.run,
    loading: false,
    bannerError: null,
    lastErrorCode: null,
  }),
}));

let mockSiteKey: string | undefined;
vi.mock("@/lib/auth/turnstile-site-key", () => ({
  turnstileSiteKey: () => mockSiteKey,
}));

describe("useForgotPasswordController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSiteKey = undefined;
    mocks.run.mockResolvedValue({ ok: true });
  });

  it("turnstileReady is false until token when site key is set", () => {
    mockSiteKey = "site-key";
    const { result } = renderHook(() => useForgotPasswordController());
    expect(result.current.turnstileReady).toBe(false);
    act(() => {
      result.current.onTurnstileToken("token");
    });
    expect(result.current.turnstileReady).toBe(true);
  });

  it("clears token after failed submit so a fresh captcha is required", async () => {
    mockSiteKey = "site-key";
    mocks.run.mockResolvedValue({
      ok: false,
      code: "captcha_invalid",
      message: "Security check failed.",
    });
    const { result } = renderHook(() => useForgotPasswordController());

    act(() => {
      result.current.onTurnstileToken("spent-token");
    });
    expect(result.current.turnstileReady).toBe(true);

    await act(async () => {
      result.current.form.setValue("email", "user@example.com");
      await result.current.onSubmit();
    });

    expect(result.current.turnstileReady).toBe(false);
  });
});
