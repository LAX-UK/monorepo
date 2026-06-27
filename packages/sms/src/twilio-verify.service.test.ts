import twilio from "twilio";
import { describe, expect, it, vi } from "vitest";
import { ConsolePhoneVerificationService } from "./console.service.js";
import {
  InvalidPhoneNumberError,
  PhoneVerificationNotConfiguredError,
  PhoneVerificationRateLimitedError,
} from "./errors.js";
import { TwilioVerifyService } from "./twilio-verify.service.js";

const { RestException } = twilio;

function twilioError(
  statusCode: number,
  code: number,
  message: string,
): InstanceType<typeof RestException> {
  return new RestException({
    statusCode,
    body: { code, message, more_info: `https://www.twilio.com/docs/errors/${code}` },
  });
}

function mockTwilioClient(handlers: {
  createVerification?: () => Promise<{ sid: string }>;
  createVerificationCheck?: () => Promise<{ valid: boolean; status: string }>;
}) {
  return {
    verify: {
      v2: {
        services: (_sid: string) => ({
          verifications: {
            create: handlers.createVerification ?? (async () => ({ sid: "VE123" })),
          },
          verificationChecks: {
            create:
              handlers.createVerificationCheck ??
              (async () => ({ valid: true, status: "approved" })),
          },
        }),
      },
    },
  } as never;
}

describe("TwilioVerifyService", () => {
  it("isConfigured is false when client is missing", () => {
    const svc = new TwilioVerifyService({});
    expect(svc.isConfigured()).toBe(false);
  });

  it("sendOtp returns sid on success", async () => {
    const svc = new TwilioVerifyService(
      {},
      {
        client: mockTwilioClient({ createVerification: async () => ({ sid: "VEabc" }) }),
        serviceSid: "VAtest",
      },
    );
    const result = await svc.sendOtp("+14155550100");
    expect(result.sid).toBe("VEabc");
  });

  it("sendOtp throws InvalidPhoneNumberError on 400 invalid number", async () => {
    const svc = new TwilioVerifyService(
      {},
      {
        client: mockTwilioClient({
          createVerification: async () => {
            throw twilioError(400, 60200, "Invalid parameter: To");
          },
        }),
        serviceSid: "VAtest",
      },
    );
    await expect(svc.sendOtp("+invalid")).rejects.toBeInstanceOf(InvalidPhoneNumberError);
  });

  it("sendOtp throws RateLimitedError on 429", async () => {
    const svc = new TwilioVerifyService(
      {},
      {
        client: mockTwilioClient({
          createVerification: async () => {
            throw twilioError(429, 20429, "Too many requests");
          },
        }),
        serviceSid: "VAtest",
      },
    );
    await expect(svc.sendOtp("+14155550100")).rejects.toBeInstanceOf(
      PhoneVerificationRateLimitedError,
    );
  });

  it("checkOtp returns valid true when approved", async () => {
    const svc = new TwilioVerifyService(
      {},
      {
        client: mockTwilioClient({
          createVerificationCheck: async () => ({ valid: true, status: "approved" }),
        }),
        serviceSid: "VAtest",
      },
    );
    const result = await svc.checkOtp("+14155550100", "123456");
    expect(result.valid).toBe(true);
  });

  it("checkOtp returns valid false on 404", async () => {
    const svc = new TwilioVerifyService(
      {},
      {
        client: mockTwilioClient({
          createVerificationCheck: async () => {
            throw twilioError(404, 20404, "Resource not found");
          },
        }),
        serviceSid: "VAtest",
      },
    );
    const result = await svc.checkOtp("+14155550100", "000000");
    expect(result.valid).toBe(false);
  });

  it("throws NotConfigured when not wired", async () => {
    const svc = new TwilioVerifyService({});
    await expect(svc.sendOtp("+14155550100")).rejects.toBeInstanceOf(
      PhoneVerificationNotConfiguredError,
    );
  });
});

describe("ConsolePhoneVerificationService", () => {
  it("send and check round-trip", async () => {
    ConsolePhoneVerificationService.resetForTests();
    const svc = new ConsolePhoneVerificationService();
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await svc.sendOtp("+14155550100");
    const logged = logSpy.mock.calls[0]?.[0] as string;
    const code = logged.match(/: (\d{6})$/)?.[1];
    expect(code).toBeTruthy();
    if (!code) throw new Error("expected OTP code in console log");

    const bad = await svc.checkOtp("+14155550100", "000000");
    expect(bad.valid).toBe(false);

    const good = await svc.checkOtp("+14155550100", code);
    expect(good.valid).toBe(true);

    logSpy.mockRestore();
  });
});
