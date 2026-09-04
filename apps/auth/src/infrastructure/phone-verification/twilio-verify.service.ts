import { createHash } from "node:crypto";
import {
  InvalidPhoneNumberError,
  PhoneVerificationRateLimitedError,
  type SendOtpOptions,
  type SmsSender,
} from "@auction/auth";
import twilio, { type Twilio } from "twilio";
import {
  type TwilioVerifyEnv,
  createTwilioClient,
  isTwilioVerifyConfigured,
} from "./twilio-verify-client.js";

const { RestException } = twilio;

export class PhoneVerificationNotConfiguredError extends Error {
  constructor() {
    super("phone_verification_not_configured");
    this.name = "PhoneVerificationNotConfiguredError";
  }
}

function hashIpForRateLimit(ip: string): string {
  return createHash("sha256").update(ip.trim()).digest("hex").slice(0, 32);
}

function isInvalidNumberError(error: InstanceType<typeof RestException>): boolean {
  if (error.status >= 400 && error.status < 500 && error.status !== 429) {
    const code = error.code;
    // Twilio invalid 'To' / landline / unreachable number codes (non-exhaustive).
    if (code === 60200 || code === 60203 || code === 60205 || code === 21211 || code === 21614) {
      return true;
    }
    const msg = error.message.toLowerCase();
    return msg.includes("invalid") && (msg.includes("phone") || msg.includes("number"));
  }
  return false;
}

export type TwilioVerifyServiceDeps = {
  client: Twilio;
  serviceSid: string;
};

export class TwilioVerifyService implements SmsSender {
  private readonly client: Twilio | null;
  private readonly serviceSid: string | null;

  constructor(env: TwilioVerifyEnv, deps?: TwilioVerifyServiceDeps) {
    if (deps) {
      this.client = deps.client;
      this.serviceSid = deps.serviceSid;
      return;
    }
    this.client = createTwilioClient(env);
    this.serviceSid = env.TWILIO_VERIFY_SERVICE_SID?.trim() ?? null;
  }

  static fromEnv(env: TwilioVerifyEnv): TwilioVerifyService {
    return new TwilioVerifyService(env);
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.serviceSid);
  }

  async sendOtp(phoneE164: string, opts?: SendOtpOptions): Promise<{ sid: string }> {
    if (!this.client || !this.serviceSid) {
      throw new PhoneVerificationNotConfiguredError();
    }

    try {
      const createParams: {
        to: string;
        channel: "sms";
        rateLimits?: Record<string, string>;
      } = {
        to: phoneE164,
        channel: "sms",
      };

      const ip = opts?.ipAddress?.trim();
      if (ip) {
        createParams.rateLimits = { end_user_ip_address: hashIpForRateLimit(ip) };
      }

      const verification = await this.client.verify.v2
        .services(this.serviceSid)
        .verifications.create(createParams);

      const sid = verification.sid;
      if (!sid) {
        throw new Error("twilio_verify_send_missing_sid");
      }
      return { sid };
    } catch (error) {
      if (error instanceof RestException) {
        if (error.status === 429 || error.code === 20429) {
          throw new PhoneVerificationRateLimitedError();
        }
        if (isInvalidNumberError(error)) {
          throw new InvalidPhoneNumberError(phoneE164);
        }
      }
      throw error;
    }
  }

  async checkOtp(phoneE164: string, code: string): Promise<{ valid: boolean }> {
    if (!this.client || !this.serviceSid) {
      throw new PhoneVerificationNotConfiguredError();
    }

    try {
      const check = await this.client.verify.v2
        .services(this.serviceSid)
        .verificationChecks.create({ to: phoneE164, code: code.trim() });

      return { valid: check.valid === true || check.status === "approved" };
    } catch (error) {
      if (error instanceof RestException) {
        if (error.status === 429 || error.code === 20429) {
          throw new PhoneVerificationRateLimitedError();
        }
        if (isInvalidNumberError(error)) {
          return { valid: false };
        }
        // Wrong code returns pending status in response body, not always an error.
        if (error.status === 404) {
          return { valid: false };
        }
      }
      throw error;
    }
  }
}

export { isTwilioVerifyConfigured };
