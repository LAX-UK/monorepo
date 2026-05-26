import { authClient } from "@/lib/auth-client";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-code";
import {
  resendVerificationEmailFromPending,
  sendVerificationEmailFromBanner,
  sendVerificationEmailService,
} from "@/lib/auth/services/send-verification-email.service";
import { buildVerifyEmailCallbackUrl } from "@/lib/auth/verify-email-callback-url";
import { buildVerifyEmailResendCallbackUrl } from "@/lib/auth/verify-email-resend-callback.server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    sendVerificationEmail: vi.fn(),
  },
}));

vi.mock("@/lib/auth/verify-email-resend-callback.server", () => ({
  buildVerifyEmailResendCallbackUrl: vi.fn(
    async () => "http://web.test/verify-email?email=a%40b.com",
  ),
}));

vi.mock("@/lib/auth/verify-email-callback-url", () => ({
  buildVerifyEmailCallbackUrl: vi.fn(
    () => "http://web.test/verify-email?email=a%40b.com&next=%2Fdashboard",
  ),
}));

describe("sendVerificationEmailService", () => {
  beforeEach(() => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({ error: null });
  });

  it("returns ok when Better Auth succeeds", async () => {
    const result = await sendVerificationEmailService({
      email: "a@b.com",
      callbackURL: "http://web.test/verify-email",
    });

    expect(result).toEqual({ ok: true });
    expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
      email: "a@b.com",
      callbackURL: "http://web.test/verify-email",
    });
  });

  it("maps Better Auth errors to verification_email_failed", async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({
      error: { message: "Something went wrong", code: "UNKNOWN" },
    });

    const result = await sendVerificationEmailService({
      email: "a@b.com",
      callbackURL: "http://web.test/verify-email",
    });

    expect(result).toEqual({
      ok: false,
      code: "verification_email_failed",
      message: AUTH_ERROR_MESSAGES.verification_email_failed,
    });
  });

  it("maps rate limiting from Better Auth", async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({
      error: { message: "Too many requests", code: "TOO_MANY_REQUESTS" },
    });

    const result = await sendVerificationEmailService({
      email: "a@b.com",
      callbackURL: "http://web.test/verify-email",
    });

    expect(result).toEqual({
      ok: false,
      code: "rate_limited",
      message: AUTH_ERROR_MESSAGES.rate_limited,
    });
  });

  it("does not throw when the auth client rejects with a network failure", async () => {
    vi.mocked(authClient.sendVerificationEmail).mockRejectedValue(
      new TypeError("Failed to fetch (auth.lax.bid)"),
    );

    const result = await sendVerificationEmailService({
      email: "a@b.com",
      callbackURL: "http://web.test/verify-email",
    });

    expect(result).toEqual({
      ok: false,
      code: "verification_email_failed",
      message: AUTH_ERROR_MESSAGES.verification_email_failed,
    });
  });
});

describe("resendVerificationEmailFromPending", () => {
  beforeEach(() => {
    vi.mocked(buildVerifyEmailResendCallbackUrl).mockResolvedValue(
      "http://web.test/verify-email?email=a%40b.com",
    );
  });

  it("does not throw when the server action to build callback URL fails", async () => {
    vi.mocked(authClient.sendVerificationEmail).mockClear();
    vi.mocked(buildVerifyEmailResendCallbackUrl).mockRejectedValue(
      new Error("Server action failed"),
    );

    const result = await resendVerificationEmailFromPending({
      email: "a@b.com",
      webOrigin: "http://web.test",
    });

    expect(result).toEqual({
      ok: false,
      code: "verification_email_failed",
      message: AUTH_ERROR_MESSAGES.verification_email_failed,
    });
    expect(authClient.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("builds the pending callback URL then sends verification email", async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({ error: null });

    const result = await resendVerificationEmailFromPending({
      email: "a@b.com",
      next: "/dashboard",
      webOrigin: "http://web.test",
    });

    expect(buildVerifyEmailResendCallbackUrl).toHaveBeenCalledWith(
      "a@b.com",
      "/dashboard",
      "http://web.test",
    );
    expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
      email: "a@b.com",
      callbackURL: "http://web.test/verify-email?email=a%40b.com",
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("sendVerificationEmailFromBanner", () => {
  beforeEach(() => {
    vi.mocked(buildVerifyEmailCallbackUrl).mockReturnValue(
      "http://web.test/verify-email?email=a%40b.com&next=%2Fdashboard",
    );
  });

  it("does not throw when building the banner callback URL fails", async () => {
    vi.mocked(authClient.sendVerificationEmail).mockClear();
    vi.mocked(buildVerifyEmailCallbackUrl).mockImplementation(() => {
      throw new Error("buildVerifyEmailCallbackUrl is client-only");
    });

    const result = await sendVerificationEmailFromBanner({
      email: "a@b.com",
      next: "/dashboard",
    });

    expect(result).toEqual({
      ok: false,
      code: "verification_email_failed",
      message: AUTH_ERROR_MESSAGES.verification_email_failed,
    });
    expect(authClient.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("builds the banner callback URL then sends verification email", async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({ error: null });

    const result = await sendVerificationEmailFromBanner({
      email: "a@b.com",
      next: "/dashboard",
    });

    expect(buildVerifyEmailCallbackUrl).toHaveBeenCalledWith("a@b.com", "/dashboard");
    expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
      email: "a@b.com",
      callbackURL: "http://web.test/verify-email?email=a%40b.com&next=%2Fdashboard",
    });
    expect(result).toEqual({ ok: true });
  });
});
