import { describe, expect, it, vi } from "vitest";
import { IdentityIssuerVerificationEmailResender } from "./identity-issuer-verification-email.resender.js";

describe("IdentityIssuerVerificationEmailResender", () => {
  it("requests verification with the web callback context", async () => {
    const sendVerificationEmail = vi.fn(async () => {});
    const resender = new IdentityIssuerVerificationEmailResender(
      {
        signUpEmail: vi.fn(),
        sendVerificationEmail,
        requestPasswordReset: vi.fn(),
        requestMagicLink: vi.fn(),
      },
      "https://app.example.com",
    );

    await expect(
      resender.resend({
        email: "ada@example.com",
        persona: "buyer",
        inviteToken: "invite-1",
      }),
    ).resolves.toEqual({ ok: true });
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      email: "ada@example.com",
      callbackURL: "https://app.example.com/verify-email?email=ada%40example.com&invite=invite-1",
    });
  });

  it("maps issuer failures to an unsuccessful resend", async () => {
    const resender = new IdentityIssuerVerificationEmailResender(
      {
        signUpEmail: vi.fn(),
        sendVerificationEmail: vi.fn(async () => {
          throw new Error("unavailable");
        }),
        requestPasswordReset: vi.fn(),
        requestMagicLink: vi.fn(),
      },
      "https://app.example.com",
    );

    await expect(resender.resend({ email: "ada@example.com" })).resolves.toEqual({ ok: false });
  });
});
