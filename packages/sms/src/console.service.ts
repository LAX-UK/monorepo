import type { IPhoneVerificationService, SendOtpOptions } from "./service.js";

/** In-memory OTP store for local/dev — mirrors Twilio Verify lifecycle. */
const pendingByPhone = new Map<string, { code: string; expiresAt: number }>();

const OTP_TTL_MS = 5 * 60 * 1000;

function randomSixDigitCode(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

export class ConsolePhoneVerificationService implements IPhoneVerificationService {
  isConfigured(): boolean {
    return true;
  }

  async sendOtp(phoneE164: string, _opts?: SendOtpOptions): Promise<{ sid: string }> {
    const code = randomSixDigitCode();
    pendingByPhone.set(phoneE164, { code, expiresAt: Date.now() + OTP_TTL_MS });
    console.info(`[ConsolePhoneVerification] OTP for ${phoneE164}: ${code}`);
    return { sid: `console-${Date.now()}` };
  }

  async checkOtp(phoneE164: string, code: string): Promise<{ valid: boolean }> {
    const pending = pendingByPhone.get(phoneE164);
    if (!pending) return { valid: false };
    if (Date.now() > pending.expiresAt) {
      pendingByPhone.delete(phoneE164);
      return { valid: false };
    }
    const valid = pending.code === code.trim();
    if (valid) {
      pendingByPhone.delete(phoneE164);
    }
    return { valid };
  }

  /** Test helper — clear pending OTPs. */
  static resetForTests(): void {
    pendingByPhone.clear();
  }
}
