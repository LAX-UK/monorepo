import type { SendOtpOptions, SmsSender } from "@auction/auth";

/**
 * Local stand-in for SMS delivery, selected only in development and test (see
 * `select-phone-verification.ts`). Nothing is sent and nothing is logged: a one-time code in a
 * log file is a code anyone with log access can use. Every number is verified with the fixed
 * code below, which is not a secret because this provider never runs anywhere else.
 */
export const DEVELOPMENT_PHONE_CODE = "123456";

const OTP_TTL_MS = 5 * 60 * 1000;

/** In-memory pending verifications, mirroring the Twilio Verify lifecycle. */
const pendingByPhone = new Map<string, { expiresAt: number }>();

export class ConsolePhoneVerificationService implements SmsSender {
  isConfigured(): boolean {
    return true;
  }

  async sendOtp(phoneE164: string, _opts?: SendOtpOptions): Promise<{ sid: string }> {
    pendingByPhone.set(phoneE164, { expiresAt: Date.now() + OTP_TTL_MS });
    return { sid: `console-${Date.now()}` };
  }

  async checkOtp(phoneE164: string, code: string): Promise<{ valid: boolean }> {
    const pending = pendingByPhone.get(phoneE164);
    if (!pending) return { valid: false };
    if (Date.now() > pending.expiresAt) {
      pendingByPhone.delete(phoneE164);
      return { valid: false };
    }
    const valid = code.trim() === DEVELOPMENT_PHONE_CODE;
    if (valid) pendingByPhone.delete(phoneE164);
    return { valid };
  }

  /** Test helper: clear pending verifications. */
  static resetForTests(): void {
    pendingByPhone.clear();
  }
}
