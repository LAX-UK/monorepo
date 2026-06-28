import type { Database } from "@auction/db";
import type { IPhoneVerificationService } from "@auction/sms";
import { InvalidPhoneNumberError, PhoneVerificationRateLimitedError } from "@auction/sms";
import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import {
  buildPhoneNumberPlugin,
  buildPhoneNumberRateLimitPlugin,
  resetPhoneVerifiedIfNumberChanged,
} from "./phone-number-plugin.js";

function fakePhoneService(
  overrides: Partial<IPhoneVerificationService> = {},
): IPhoneVerificationService {
  return {
    isConfigured: () => true,
    sendOtp: vi.fn(async () => ({ sid: "VE123" })),
    checkOtp: vi.fn(async () => ({ valid: true })),
    ...overrides,
  };
}

describe("buildPhoneNumberPlugin", () => {
  it("delegates sendOTP to phoneVerification and ignores Better Auth code", async () => {
    const phoneVerification = fakePhoneService();
    const plugin = buildPhoneNumberPlugin({
      db: {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as unknown as Database,
      phoneVerification,
    });

    const sendOTP = plugin.options?.sendOTP;
    expect(sendOTP).toBeTypeOf("function");
    if (!sendOTP) throw new Error("sendOTP not defined");

    await sendOTP({ phoneNumber: "+14155550100", code: "000000" }, {
      request: { headers: new Headers({ "x-forwarded-for": "203.0.113.1" }) },
    } as never);

    expect(phoneVerification.sendOtp).toHaveBeenCalledWith("+14155550100", {
      ipAddress: "203.0.113.1",
    });
  });

  it("maps InvalidPhoneNumberError to BAD_REQUEST on send", async () => {
    const phoneVerification = fakePhoneService({
      sendOtp: vi.fn(async () => {
        throw new InvalidPhoneNumberError("+1bad");
      }),
    });
    const plugin = buildPhoneNumberPlugin({
      db: {} as Database,
      phoneVerification,
    });

    await expect(
      plugin.options?.sendOTP?.({ phoneNumber: "+1bad", code: "123456" }, {} as never),
    ).rejects.toBeInstanceOf(APIError);
  });

  it("maps PhoneVerificationRateLimitedError to TOO_MANY_REQUESTS on send", async () => {
    const phoneVerification = fakePhoneService({
      sendOtp: vi.fn(async () => {
        throw new PhoneVerificationRateLimitedError();
      }),
    });
    const plugin = buildPhoneNumberPlugin({
      db: {} as Database,
      phoneVerification,
    });

    await expect(
      plugin.options?.sendOTP?.({ phoneNumber: "+14155550100", code: "123456" }, {} as never),
    ).rejects.toMatchObject({ status: "TOO_MANY_REQUESTS" });
  });

  it("delegates verifyOTP to checkOtp and returns validity", async () => {
    const phoneVerification = fakePhoneService({
      checkOtp: vi.fn(async () => ({ valid: false })),
    });
    const plugin = buildPhoneNumberPlugin({
      db: {} as Database,
      phoneVerification,
    });

    const valid = await plugin.options?.verifyOTP?.({
      phoneNumber: "+14155550100",
      code: "123456",
    });
    expect(valid).toBe(false);
    expect(phoneVerification.checkOtp).toHaveBeenCalledWith("+14155550100", "123456");
  });
});

describe("buildPhoneNumberRateLimitPlugin", () => {
  it("throttles send-otp path", () => {
    const plugin = buildPhoneNumberRateLimitPlugin();
    const rule = plugin.rateLimit?.[0];
    expect(rule?.pathMatcher?.("/phone-number/send-otp")).toBe(true);
    expect(rule?.max).toBe(5);
    expect(rule?.window).toBe(60);
  });
});

describe("resetPhoneVerifiedIfNumberChanged", () => {
  it("no-ops when phone unchanged", async () => {
    const where = vi.fn().mockReturnValue({ set: vi.fn() });
    const db = {
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where }) }),
    } as unknown as Database;

    await resetPhoneVerifiedIfNumberChanged(db, "u1", "+14155550100", "+14155550100");
    expect(db.update).not.toHaveBeenCalled();
  });
});
