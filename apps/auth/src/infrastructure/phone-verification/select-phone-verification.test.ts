import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsolePhoneVerificationService, DEVELOPMENT_PHONE_CODE } from "./console.service.js";
import { selectPhoneVerification } from "./select-phone-verification.js";
import { TwilioVerifyService } from "./twilio-verify.service.js";
import { UnconfiguredPhoneVerificationService } from "./unconfigured.service.js";

const NO_TWILIO = { ENABLE_PHONE_VERIFICATION: false } as const;
const TWILIO = {
  ENABLE_PHONE_VERIFICATION: true,
  TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000000",
  TWILIO_VERIFY_SERVICE_SID: "VA00000000000000000000000000000000",
  TWILIO_AUTH_TOKEN: "twilio-token", // gitleaks:allow
} as const;

afterEach(() => vi.restoreAllMocks());

describe("selectPhoneVerification", () => {
  it.each(["development", "test"] as const)("uses the local stand-in in %s", (NODE_ENV) => {
    const sms = selectPhoneVerification({ NODE_ENV, ...NO_TWILIO });
    expect(sms).toBeInstanceOf(ConsolePhoneVerificationService);
    expect(sms.isConfigured()).toBe(true);
  });

  it("reports not configured in production without Twilio", async () => {
    const sms = selectPhoneVerification({ NODE_ENV: "production", ...NO_TWILIO });
    expect(sms).toBeInstanceOf(UnconfiguredPhoneVerificationService);
    expect(sms.isConfigured()).toBe(false);
    await expect(sms.sendOtp("+14155550100")).rejects.toThrow("phone_verification_not_configured");
    await expect(sms.checkOtp("+14155550100", "123456")).rejects.toThrow(
      "phone_verification_not_configured",
    );
  });

  it("does not use the stand-in in production when Twilio is switched on but incomplete", () => {
    const sms = selectPhoneVerification({
      NODE_ENV: "production",
      ENABLE_PHONE_VERIFICATION: true,
    });
    expect(sms.isConfigured()).toBe(false);
  });

  it.each(["development", "test", "production"] as const)(
    "uses Twilio in %s when set up",
    (NODE_ENV) => {
      expect(selectPhoneVerification({ NODE_ENV, ...TWILIO })).toBeInstanceOf(TwilioVerifyService);
    },
  );
});

describe("ConsolePhoneVerificationService", () => {
  it("never writes a one-time code to any log", async () => {
    ConsolePhoneVerificationService.resetForTests();
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
    const sms = new ConsolePhoneVerificationService();
    await sms.sendOtp("+14155550100");
    await sms.checkOtp("+14155550100", DEVELOPMENT_PHONE_CODE);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("verifies the development code once and rejects anything else", async () => {
    ConsolePhoneVerificationService.resetForTests();
    const sms = new ConsolePhoneVerificationService();
    expect((await sms.checkOtp("+14155550100", DEVELOPMENT_PHONE_CODE)).valid).toBe(false);
    await sms.sendOtp("+14155550100");
    expect((await sms.checkOtp("+14155550100", "000000")).valid).toBe(false);
    expect((await sms.checkOtp("+14155550100", DEVELOPMENT_PHONE_CODE)).valid).toBe(true);
    expect((await sms.checkOtp("+14155550100", DEVELOPMENT_PHONE_CODE)).valid).toBe(false);
  });
});
