import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-code";
import { signUpService } from "@/lib/auth/services/sign-up.service";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("signUpService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps email_already_registered to the closed auth error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: "This email is already registered. Sign in or reset your password.",
          code: "email_already_registered",
        }),
      }),
    );

    const result = await signUpService({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "taken@example.com",
      password: "supersecret12!",
      persona: "individual",
      acceptTerms: true,
      phone: { country: "GB", number: "" },
    });

    expect(result).toEqual({
      ok: false,
      code: "email_already_registered",
      message:
        "This email is already registered. Sign in or reset your password to access your account.",
    });
  });

  it("maps 429 to rate_limited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: "Too many requests" }),
      }),
    );

    const result = await signUpService({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "supersecret12!",
      persona: "individual",
      acceptTerms: true,
      phone: { country: "GB", number: "" },
    });

    expect(result).toEqual({
      ok: false,
      code: "rate_limited",
      message: AUTH_ERROR_MESSAGES.rate_limited,
    });
  });
});
