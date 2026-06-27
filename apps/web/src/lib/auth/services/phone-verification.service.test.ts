import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-code";
import {
  removePhoneNumberService,
  sendPhoneOtpService,
  signInWithPhoneService,
  verifyPhoneOtpService,
} from "@/lib/auth/services/phone-verification.service";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendOtp = vi.fn();
const verify = vi.fn();
const updateUser = vi.fn();
const signInPhoneNumber = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    phoneNumber: {
      sendOtp: (...args: unknown[]) => sendOtp(...args),
      verify: (...args: unknown[]) => verify(...args),
    },
    updateUser: (...args: unknown[]) => updateUser(...args),
    signIn: {
      phoneNumber: (...args: unknown[]) => signInPhoneNumber(...args),
    },
  },
}));

describe("phone-verification.service", () => {
  beforeEach(() => {
    sendOtp.mockReset();
    verify.mockReset();
    updateUser.mockReset();
    signInPhoneNumber.mockReset();
  });

  it("sendPhoneOtpService succeeds when auth client returns no error", async () => {
    sendOtp.mockResolvedValue({ data: {} });
    await expect(sendPhoneOtpService("+14155550100")).resolves.toEqual({ ok: true });
    expect(sendOtp).toHaveBeenCalledWith({ phoneNumber: "+14155550100" });
  });

  it("sendPhoneOtpService maps rate limit errors", async () => {
    sendOtp.mockResolvedValue({ error: { message: "Too many verification attempts" } });
    const r = await sendPhoneOtpService("+14155550100");
    expect(r).toEqual({
      ok: false,
      code: "rate_limited",
      message: AUTH_ERROR_MESSAGES.rate_limited,
    });
  });

  it("verifyPhoneOtpService passes updatePhoneNumber flag", async () => {
    verify.mockResolvedValue({ data: {} });
    await expect(
      verifyPhoneOtpService({
        phoneE164: "+14155550100",
        code: "123456",
        updatePhoneNumber: true,
      }),
    ).resolves.toEqual({ ok: true });
    expect(verify).toHaveBeenCalledWith({
      phoneNumber: "+14155550100",
      code: "123456",
      disableSession: true,
      updatePhoneNumber: true,
    });
  });

  it("removePhoneNumberService clears phoneNumber via updateUser", async () => {
    updateUser.mockResolvedValue({ data: {} });
    await expect(removePhoneNumberService()).resolves.toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({ phoneNumber: null });
  });

  it("signInWithPhoneService returns requiresTwoFactor when redirect flag set", async () => {
    signInPhoneNumber.mockResolvedValue({
      data: { twoFactorRedirect: true, twoFactorMethods: ["totp"] },
    });
    const r = await signInWithPhoneService({
      phoneE164: "+14155550100",
      password: "secret12",
    });
    expect(r).toEqual({
      ok: true,
      requiresTwoFactor: true,
      twoFactorMethods: ["totp"],
    });
  });

  it("signInWithPhoneService maps invalid credentials", async () => {
    signInPhoneNumber.mockResolvedValue({
      error: {
        message: "Invalid phone number or password",
        code: "INVALID_PHONE_NUMBER_OR_PASSWORD",
      },
    });
    const r = await signInWithPhoneService({
      phoneE164: "+14155550100",
      password: "wrong",
    });
    expect(r).toEqual({
      ok: false,
      code: "invalid_credentials",
      message: AUTH_ERROR_MESSAGES.invalid_credentials,
    });
  });
});
