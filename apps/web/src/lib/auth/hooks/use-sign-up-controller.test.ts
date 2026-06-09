import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSignUpController } from "./use-sign-up-controller";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/auth/use-auth-submit", () => ({
  useAuthSubmit: () => ({
    run: vi.fn().mockResolvedValue({ ok: true }),
    loading: false,
    bannerError: null,
    lastErrorCode: null,
  }),
}));

vi.mock("@/lib/analytics/events", () => ({
  trackSignUp: vi.fn(),
}));

let mockSiteKey: string | undefined;
vi.mock("@/lib/auth/turnstile-site-key", () => ({
  turnstileSiteKey: () => mockSiteKey,
}));

describe("useSignUpController", () => {
  it("redirect URL contains email after successful signup", async () => {
    const { result } = renderHook(() => useSignUpController());

    await act(async () => {
      result.current.form.setValue("firstName", "Ada");
      result.current.form.setValue("lastName", "Lovelace");
      result.current.form.setValue("email", "ada@example.com");
      result.current.form.setValue("password", "supersecret1!");
      result.current.form.setValue("persona", "individual");
      result.current.form.setValue("acceptTerms", true);
      await result.current.onSubmit();
    });

    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(/\/register\/verify-pending\?.*email=ada%40example\.com/),
    );
  });

  it("turnstileReady is true when no site key is configured", () => {
    mockSiteKey = undefined;
    const { result } = renderHook(() => useSignUpController());
    expect(result.current.turnstileReady).toBe(true);
  });

  it("turnstileReady is false until the widget yields a token, then true", () => {
    mockSiteKey = "site-key";
    const { result } = renderHook(() => useSignUpController());
    expect(result.current.turnstileReady).toBe(false);

    act(() => {
      result.current.onTurnstileToken("ts-token");
    });
    expect(result.current.turnstileReady).toBe(true);

    act(() => {
      result.current.onTurnstileExpire();
    });
    expect(result.current.turnstileReady).toBe(false);
  });
});
