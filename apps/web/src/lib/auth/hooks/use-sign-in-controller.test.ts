import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSignInController } from "./use-sign-in-controller";

const { beginBidOidcLogin, push, refresh } = vi.hoisted(() => ({
  beginBidOidcLogin: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/analytics/events", () => ({
  trackLogin: vi.fn(),
}));

vi.mock("@/lib/auth/use-refetch-app-session", () => ({
  useRefetchAppSession: () => vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/auth-broadcast", () => ({
  postAuthBroadcast: vi.fn(),
}));

vi.mock("@/lib/auth/turnstile-site-key", () => ({
  turnstileSiteKey: () => undefined,
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { error: vi.fn() },
}));

vi.mock("@/lib/auth/begin-bid-oidc-login.client", () => {
  return { beginBidOidcLogin };
});

const run = vi.fn();

vi.mock("@/lib/auth/use-auth-submit", () => ({
  useAuthSubmit: () => ({
    run,
    loading: false,
    bannerError: null,
    lastErrorCode: null,
  }),
}));

const requestMagicLinkService = vi.fn();

vi.mock("@/lib/auth/services/request-magic-link.client", () => ({
  requestMagicLinkService: (...args: unknown[]) => requestMagicLinkService(...args),
}));

describe("useSignInController", () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    run.mockReset();
    beginBidOidcLogin.mockReset();
    requestMagicLinkService.mockReset();
    requestMagicLinkService.mockResolvedValue({ ok: true });
  });

  it("redirects to two-factor when required", async () => {
    run.mockResolvedValueOnce({ ok: true, requiresTwoFactor: true });
    const { result } = renderHook(() => useSignInController("/dashboard"));

    await act(async () => {
      result.current.form.setValue("email", "ada@example.com");
      result.current.form.setValue("password", "supersecret1!");
      await result.current.onSubmit();
    });

    expect(push).toHaveBeenCalledWith(expect.stringContaining("/login/two-factor"));
    expect(beginBidOidcLogin).not.toHaveBeenCalled();
  });

  it("starts the top-level Bid OIDC flow after Identity sign-in", async () => {
    run.mockResolvedValueOnce({ ok: true, requiresTwoFactor: false });
    const { result } = renderHook(() => useSignInController("/dashboard"));

    await act(async () => {
      result.current.form.setValue("email", "ada@example.com");
      result.current.form.setValue("password", "supersecret1!");
      await result.current.onSubmit();
    });

    expect(beginBidOidcLogin).toHaveBeenCalledWith("/dashboard");
    expect(push).not.toHaveBeenCalled();
    expect(result.current.bannerError).toBeNull();
  });

  it("advances to credentials step on valid email (email-first)", () => {
    const { result } = renderHook(() =>
      useSignInController("/dashboard", { emailFirst: true, initialStep: "email" }),
    );

    act(() => {
      result.current.form.setValue("email", "ada@example.com");
      result.current.goToCredentials();
    });

    expect(result.current.step).toBe("credentials");
  });

  it("requestMagicLink calls service, sets linkSent, and threads safe next", async () => {
    const { result } = renderHook(() =>
      useSignInController("/dashboard", { emailFirst: true, initialStep: "credentials" }),
    );

    await act(async () => {
      result.current.form.setValue("email", "ada@example.com");
      await result.current.requestMagicLink();
    });

    expect(requestMagicLinkService).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com",
        next: "/dashboard",
      }),
    );
    expect(result.current.linkSent).toBe(true);
  });

  it("changeEmail returns to email step", () => {
    const { result } = renderHook(() =>
      useSignInController("/dashboard", { emailFirst: true, initialStep: "credentials" }),
    );

    act(() => {
      result.current.changeEmail();
    });

    expect(result.current.step).toBe("email");
    expect(result.current.linkSent).toBe(false);
  });
});
