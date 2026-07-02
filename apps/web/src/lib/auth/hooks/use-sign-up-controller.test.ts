import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSignUpController } from "./use-sign-up-controller";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  run: vi.fn(),
  notifySignUpRegistrationError: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("@/lib/auth/notify-sign-up-error", () => ({
  notifySignUpRegistrationError: mocks.notifySignUpRegistrationError,
}));

vi.mock("@/lib/auth/use-auth-submit", () => ({
  useAuthSubmit: () => ({
    run: mocks.run,
    loading: false,
  }),
}));

vi.mock("@/lib/analytics/events", () => ({
  trackSignUp: vi.fn(),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    error: mocks.notifyError,
  },
}));

let mockSiteKey: string | undefined;
vi.mock("@/lib/auth/turnstile-site-key", () => ({
  turnstileSiteKey: () => mockSiteKey,
}));

describe("useSignUpController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSiteKey = undefined;
    mocks.run.mockResolvedValue({ ok: true });
  });

  it("redirect URL contains email after successful signup", async () => {
    const { result } = renderHook(() => useSignUpController({ initialStep: "details" }));

    await act(async () => {
      result.current.form.setValue("firstName", "Ada");
      result.current.form.setValue("lastName", "Lovelace");
      result.current.form.setValue("email", "ada@example.com");
      result.current.form.setValue("password", "supersecret1!");
      result.current.form.setValue("persona", "individual");
      result.current.form.setValue("acceptTerms", true);
      await result.current.onSubmit();
    });

    expect(mocks.push).toHaveBeenCalledWith(
      expect.stringMatching(/\/register\/verify-pending\?.*email=ada%40example\.com/),
    );
  });

  it("shows registration error toast when signup fails", async () => {
    mocks.run.mockResolvedValue({
      ok: false,
      code: "email_already_registered",
      message: "This email is already registered.",
    });

    const { result } = renderHook(() =>
      useSignUpController({
        initialStep: "details",
        loginHref: "/login",
        forgotPasswordHref: "/forgot-password",
      }),
    );

    await act(async () => {
      result.current.form.setValue("firstName", "Ada");
      result.current.form.setValue("lastName", "Lovelace");
      result.current.form.setValue("email", "taken@example.com");
      result.current.form.setValue("password", "supersecret1!");
      result.current.form.setValue("persona", "individual");
      result.current.form.setValue("acceptTerms", true);
      await result.current.onSubmit();
    });

    expect(mocks.notifySignUpRegistrationError).toHaveBeenCalledWith(
      "email_already_registered",
      "This email is already registered.",
      {
        loginHref: "/login",
        forgotPasswordHref: "/forgot-password",
        onNavigate: expect.any(Function),
      },
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows captcha toast when turnstile is required but missing", async () => {
    mockSiteKey = "site-key";
    const { result } = renderHook(() => useSignUpController({ initialStep: "details" }));

    await act(async () => {
      result.current.form.setValue("firstName", "Ada");
      result.current.form.setValue("lastName", "Lovelace");
      result.current.form.setValue("email", "ada@example.com");
      result.current.form.setValue("password", "supersecret1!");
      result.current.form.setValue("persona", "individual");
      result.current.form.setValue("acceptTerms", true);
      await result.current.onSubmit();
    });

    expect(mocks.notifyError).toHaveBeenCalledWith("Please complete the security check.", {
      id: "signup-captcha-required",
    });
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("turnstileReady is true when no site key is configured", () => {
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

  it("starts on persona step by default", () => {
    const { result } = renderHook(() => useSignUpController());
    expect(result.current.step).toBe("persona");
  });

  it("starts on details when initialStep is details", () => {
    const { result } = renderHook(() => useSignUpController({ initialStep: "details" }));
    expect(result.current.step).toBe("details");
  });

  it("goToDetails advances to details step", async () => {
    const { result } = renderHook(() => useSignUpController());

    await act(async () => {
      await result.current.goToDetails();
    });

    expect(result.current.step).toBe("details");
  });

  it("onSubmit on persona step advances to details without calling register", async () => {
    const { result } = renderHook(() => useSignUpController());

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(result.current.step).toBe("details");
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("backToPersona returns to persona step", async () => {
    const { result } = renderHook(() => useSignUpController({ initialStep: "details" }));

    act(() => {
      result.current.backToPersona();
    });

    expect(result.current.step).toBe("persona");
  });
});
