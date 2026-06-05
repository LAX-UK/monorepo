import { POST_AUTH_SESSION_LOAD_ERROR } from "@/lib/auth/fetch-session-user-with-retry.client";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSignInController } from "./use-sign-in-controller";

const push = vi.fn();
const refresh = vi.fn();

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

const fetchSessionUserWithRetry = vi.fn();

vi.mock("@/lib/auth/fetch-session-user-with-retry.client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/fetch-session-user-with-retry.client")>();
  return {
    ...actual,
    fetchSessionUserWithRetry: (...args: unknown[]) => fetchSessionUserWithRetry(...args),
  };
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

describe("useSignInController", () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    run.mockReset();
    fetchSessionUserWithRetry.mockReset();
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
    expect(fetchSessionUserWithRetry).not.toHaveBeenCalled();
  });

  it("shows error instead of redirecting when session load fails after sign-in", async () => {
    run.mockResolvedValueOnce({ ok: true, requiresTwoFactor: false });
    fetchSessionUserWithRetry.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useSignInController("/dashboard"));

    await act(async () => {
      result.current.form.setValue("email", "ada@example.com");
      result.current.form.setValue("password", "supersecret1!");
      await result.current.onSubmit();
    });

    expect(result.current.bannerError).toBe(POST_AUTH_SESSION_LOAD_ERROR);
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects with resolved user after successful session load", async () => {
    run.mockResolvedValueOnce({ ok: true, requiresTwoFactor: false });
    fetchSessionUserWithRetry.mockResolvedValueOnce({
      id: "u1",
      email: "ada@example.com",
      role: "client",
      emailVerified: true,
      suspended: false,
    });
    const { result } = renderHook(() => useSignInController("/dashboard"));

    await act(async () => {
      result.current.form.setValue("email", "ada@example.com");
      result.current.form.setValue("password", "supersecret1!");
      await result.current.onSubmit();
    });

    expect(push).toHaveBeenCalledWith(expect.stringContaining("/dashboard"));
    expect(result.current.bannerError).toBeNull();
  });
});
