import { AUTH_ERROR_MESSAGES, mapBetterAuthClientFailure } from "@/lib/auth/auth-error-code";
import { signInService } from "@/lib/auth/services/sign-in.service";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  getAuthIssuerBaseUrl: () => "http://auth.test",
}));

describe("signInService", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns requiresTwoFactor when Better Auth sets twoFactorRedirect", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ twoFactorRedirect: true, twoFactorMethods: ["totp"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const r = await signInService({ email: "a@b.com", password: "secret12" });
    expect(r).toEqual({
      ok: true,
      requiresTwoFactor: true,
      twoFactorMethods: ["totp"],
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://auth.test/api/auth/sign-in/email",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("returns ok without requiresTwoFactor when sign-in completes", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const r = await signInService({ email: "a@b.com", password: "secret12" });
    expect(r).toEqual({ ok: true });
  });

  it("maps captcha_required from issuer gate", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ code: "captcha_required", error: "Captcha required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const r = await signInService({ email: "a@b.com", password: "secret12" });
    expect(r).toEqual({
      ok: false,
      code: "captcha_required",
      message: AUTH_ERROR_MESSAGES.captcha_required,
    });
  });

  it("maps 429 to rate_limited", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Too many requests", code: "rate_limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const r = await signInService({ email: "a@b.com", password: "secret12" });
    expect(r).toEqual({
      ok: false,
      code: "rate_limited",
      message: AUTH_ERROR_MESSAGES.rate_limited,
    });
  });

  it("maps unknown Better Auth codes to sign_in_failed with stable copy", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid", code: "BAD" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const r = await signInService({ email: "a@b.com", password: "secret12" });
    expect(r).toEqual({
      ok: false,
      code: "sign_in_failed",
      message: AUTH_ERROR_MESSAGES.sign_in_failed,
    });
  });

  it("maps email verification errors to email_not_verified", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ message: "Please verify your email", code: "EMAIL_NOT_VERIFIED" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const r = await signInService({ email: "a@b.com", password: "secret12" });
    expect(r).toEqual({
      ok: false,
      code: "email_not_verified",
      message: AUTH_ERROR_MESSAGES.email_not_verified,
    });
  });
});

describe("mapBetterAuthClientFailure", () => {
  it("detects invalid credentials from raw code", () => {
    expect(mapBetterAuthClientFailure({ rawCode: "INVALID_EMAIL_OR_PASSWORD" })).toBe(
      "invalid_credentials",
    );
  });
});
