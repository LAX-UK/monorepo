import { describe, expect, it, vi } from "vitest";
import { IdentityIssuerEmailSignupPersister } from "./identity-issuer-email-signup.persister.js";

describe("IdentityIssuerEmailSignupPersister", () => {
  it("passes an absolute verification callback on the web origin", async () => {
    const signUpEmail = vi.fn(async () => ({ userId: "u1" }));
    const persister = new IdentityIssuerEmailSignupPersister(
      {
        signUpEmail,
        sendVerificationEmail: vi.fn(),
        requestPasswordReset: vi.fn(),
        requestMagicLink: vi.fn(),
      },
      "https://app.example.com/",
    );

    await expect(
      persister.signUpEmail({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "hunter2hunter2",
      }),
    ).resolves.toEqual({ ok: true, userId: "u1" });
    expect(signUpEmail).toHaveBeenCalledWith({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "hunter2hunter2",
      callbackURL: "https://app.example.com/verify-email?email=ada%40example.com",
    });
  });
});
