import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import {
  InvalidPhoneNumberError,
  PhoneVerificationRateLimitedError,
} from "./phone-number-errors.js";
import { buildPhoneNumberPlugin, buildPhoneNumberRateLimitPlugin } from "./phone-number-plugin.js";
import type { PhoneNumberStore } from "./ports/phone-number-store.js";
import type { SmsSender } from "./ports/sms-sender.js";

function fakePhoneNumberStore(overrides: Partial<PhoneNumberStore> = {}): PhoneNumberStore {
  return {
    purgeExpiredVerifications: vi.fn(async () => undefined),
    findPhoneNumber: vi.fn(async () => null),
    resetPhoneVerifiedIfNumberChanged: vi.fn(async () => undefined),
    ...overrides,
  };
}

function fakePhoneService(overrides: Partial<SmsSender> = {}): SmsSender {
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
    const phoneNumberStore = fakePhoneNumberStore();
    const plugin = buildPhoneNumberPlugin({
      phoneNumberStore,
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
    expect(phoneNumberStore.purgeExpiredVerifications).toHaveBeenCalled();
  });

  it("maps InvalidPhoneNumberError to BAD_REQUEST on send", async () => {
    const phoneVerification = fakePhoneService({
      sendOtp: vi.fn(async () => {
        throw new InvalidPhoneNumberError("+1bad");
      }),
    });
    const plugin = buildPhoneNumberPlugin({
      phoneNumberStore: fakePhoneNumberStore(),
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
      phoneNumberStore: fakePhoneNumberStore(),
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
      phoneNumberStore: fakePhoneNumberStore(),
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

describe("PhoneNumberStore.resetPhoneVerifiedIfNumberChanged", () => {
  it("no-ops when phone unchanged", async () => {
    const resetPhoneVerifiedIfNumberChanged = vi.fn(async () => undefined);
    const store = fakePhoneNumberStore({ resetPhoneVerifiedIfNumberChanged });

    await store.resetPhoneVerifiedIfNumberChanged("u1", "+14155550100", "+14155550100");
    expect(resetPhoneVerifiedIfNumberChanged).toHaveBeenCalledWith(
      "u1",
      "+14155550100",
      "+14155550100",
    );
  });
});
