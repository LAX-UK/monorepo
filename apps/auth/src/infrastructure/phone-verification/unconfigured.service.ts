import type { SendOtpOptions, SmsSender } from "@auction/auth";
import { PhoneVerificationNotConfiguredError } from "./twilio-verify.service.js";

/**
 * The SMS provider when no real one is set up outside development. It reports itself as not
 * configured, so LAX Account hides the phone editor and the issuer refuses to send, rather than
 * pretending to deliver a code nobody receives.
 */
export class UnconfiguredPhoneVerificationService implements SmsSender {
  isConfigured(): boolean {
    return false;
  }

  async sendOtp(_phoneE164: string, _opts?: SendOtpOptions): Promise<{ sid: string }> {
    throw new PhoneVerificationNotConfiguredError();
  }

  async checkOtp(_phoneE164: string, _code: string): Promise<{ valid: boolean }> {
    throw new PhoneVerificationNotConfiguredError();
  }
}
