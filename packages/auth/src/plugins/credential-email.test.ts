import { describe, expect, it, vi } from "vitest";
import {
  EMAIL_SEND_FAILED_CODE,
  EMAIL_SEND_FAILED_MESSAGE,
  credentialEmailKey,
  sendCredentialEmail,
} from "./credential-email.js";
import { buildEmailAndPasswordBlock } from "./email-password.js";
import { buildEmailVerificationBlock } from "./email-verification.js";

const USER = { id: "u1", email: "person@example.com", name: "Person" };
const TOKEN = "plain-one-time-token";

describe("credentialEmailKey", () => {
  it("is stable per template and token, and differs between either", () => {
    expect(credentialEmailKey("verify-email", TOKEN)).toBe(
      credentialEmailKey("verify-email", TOKEN),
    );
    expect(credentialEmailKey("verify-email", TOKEN)).not.toBe(
      credentialEmailKey("reset-password", TOKEN),
    );
    expect(credentialEmailKey("verify-email", TOKEN)).not.toBe(
      credentialEmailKey("verify-email", "another-token"),
    );
  });

  it("does not contain the token", () => {
    expect(credentialEmailKey("verify-email", TOKEN)).not.toContain(TOKEN);
  });
});

describe("sendCredentialEmail", () => {
  it("hands the message over with its key and the auth category", async () => {
    const send = vi.fn().mockResolvedValue(undefined);

    await sendCredentialEmail(
      { send },
      { template: "verify-email", to: USER.email, userId: USER.id, token: TOKEN, vars: {} },
    );

    expect(send).toHaveBeenCalledWith({
      template: "verify-email",
      to: USER.email,
      userId: USER.id,
      vars: {},
      category: "auth",
      idempotencyKey: credentialEmailKey("verify-email", TOKEN),
    });
    expect(JSON.stringify(send.mock.calls[0]?.[0]?.idempotencyKey)).not.toContain(TOKEN);
  });

  it("fails the request with a visible error and no cause when nothing could be queued", async () => {
    const send = vi.fn().mockRejectedValue(new Error(`link https://x/?token=${TOKEN}`));

    const error = await sendCredentialEmail(
      { send },
      { template: "verify-email", to: USER.email, token: TOKEN, vars: {} },
    ).catch((e: unknown) => e);

    expect(error).toMatchObject({
      status: "SERVICE_UNAVAILABLE",
      body: { code: EMAIL_SEND_FAILED_CODE, message: EMAIL_SEND_FAILED_MESSAGE },
    });
    expect(JSON.stringify(error)).not.toContain(TOKEN);
    expect((error as Error).cause).toBeUndefined();
  });
});

describe("the three credential emails", () => {
  it("sends the verification email through the durable sender and fails when it cannot", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const block = buildEmailVerificationBlock({ credentialEmail: { send } });

    await block.sendVerificationEmail({ user: USER, url: "https://a/v", token: TOKEN });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "verify-email",
        idempotencyKey: credentialEmailKey("verify-email", TOKEN),
        vars: { verificationUrl: "https://a/v", userName: "Person" },
      }),
    );
    send.mockRejectedValue(new Error("down"));
    await expect(
      block.sendVerificationEmail({ user: USER, url: "https://a/v", token: TOKEN }),
    ).rejects.toMatchObject({ body: { code: EMAIL_SEND_FAILED_CODE } });
  });

  it("sends the reset email through the durable sender and fails when it cannot", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const block = buildEmailAndPasswordBlock({
      credentialEmail: { send },
      sessionsSettingsUrl: "https://lax.bid/sessions",
    });

    await block.sendResetPassword({ user: USER, url: "https://a/r", token: TOKEN });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "reset-password",
        idempotencyKey: credentialEmailKey("reset-password", TOKEN),
      }),
    );
    send.mockRejectedValue(new Error("down"));
    await expect(
      block.sendResetPassword({ user: USER, url: "https://a/r", token: TOKEN }),
    ).rejects.toMatchObject({ body: { code: EMAIL_SEND_FAILED_CODE } });
  });
});
