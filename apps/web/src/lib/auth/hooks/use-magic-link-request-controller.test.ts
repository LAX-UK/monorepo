import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMagicLinkRequestController } from "./use-magic-link-request-controller";

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
  }),
}));

let mockSiteKey: string | undefined;
vi.mock("@/lib/auth/turnstile-site-key", () => ({
  turnstileSiteKey: () => mockSiteKey,
}));

describe("useMagicLinkRequestController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSiteKey = "site-key";
    mocks.run.mockResolvedValue({ ok: true });
  });

  it("requires a token before enabling submission", () => {
    const { result } = renderHook(() => useMagicLinkRequestController());
    expect(result.current.turnstileReady).toBe(false);

    act(() => result.current.onTurnstileToken("token"));

    expect(result.current.turnstileReady).toBe(true);
  });

  it("resets the widget and clears a spent token after failure", async () => {
    const reset = vi.fn();
    mocks.run.mockResolvedValue({
      ok: false,
      code: "captcha_invalid",
      message: "Security check failed.",
    });
    const { result } = renderHook(() => useMagicLinkRequestController());

    act(() => {
      result.current.onTurnstileReady({ reset });
      result.current.onTurnstileToken("spent-token");
      result.current.form.setValue("email", "user@example.com");
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    expect(reset).toHaveBeenCalledOnce();
    expect(result.current.turnstileReady).toBe(false);
  });
});
