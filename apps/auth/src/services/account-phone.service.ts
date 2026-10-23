import {
  type EmailSender,
  InvalidPhoneNumberError,
  PhoneVerificationRateLimitedError,
  type SmsSender,
  maskPhoneE164,
} from "@auction/auth";
import type { ReauthRequired } from "./account-contact.service.js";
import {
  IdentityOperationError,
  type IdentityOperationsService,
} from "./identity-operations.service.js";
import { RecentSessionGuard } from "./recent-session-guard.js";

export type AccountPhoneFailure =
  | "invalid_phone"
  | "invalid_code"
  | "phone_taken"
  | "rate_limited"
  | "unavailable";

export type AccountPhonePorts = {
  operations: Pick<IdentityOperationsService, "readSubject" | "listSessions" | "setVerifiedPhone">;
  /** The SMS provider the Better Auth phone plugin sends through (Twilio Verify, or the console in development). */
  sms: SmsSender;
  email: Pick<EmailSender, "enqueue">;
  /** Called when the person's email cannot be told about the change; the change still stands. */
  onNoticeFailure?: (error: unknown) => void;
};

type PhoneResult<T> = ({ ok: true } & T) | { ok: false; kind: AccountPhoneFailure };

/**
 * Adding or changing the phone number on a LAX identity, from LAX Account.
 *
 * It sends and checks the code through the same SMS provider the Better Auth phone plugin
 * uses, but not through the plugin's HTTP endpoints: those authenticate with the issuer's
 * browser cookie, which LAX Account (a confidential client acting on a person's behalf) does
 * not hold. The number is contact information only (a person cannot sign in with it), and both
 * sending a code and saving the number need a recent sign-in.
 */
export class AccountPhoneService {
  private readonly sessions: RecentSessionGuard;

  constructor(
    private readonly ports: AccountPhonePorts,
    now: () => Date = () => new Date(),
  ) {
    this.sessions = new RecentSessionGuard(ports.operations, now);
  }

  async sendCode(
    subjectId: string,
    currentSessionId: string,
    phone: string,
    context: { ipAddress?: string | undefined } = {},
  ): Promise<ReauthRequired | PhoneResult<object>> {
    if (!(await this.sessions.findRecent(subjectId, currentSessionId))) {
      return { ok: false, reason: "reauth_required" };
    }
    if (!this.ports.sms.isConfigured()) return { ok: false, kind: "unavailable" };
    try {
      await this.ports.sms.sendOtp(phone, { ipAddress: context.ipAddress });
      return { ok: true };
    } catch (error) {
      if (error instanceof InvalidPhoneNumberError) return { ok: false, kind: "invalid_phone" };
      if (error instanceof PhoneVerificationRateLimitedError) {
        return { ok: false, kind: "rate_limited" };
      }
      throw error;
    }
  }

  async verify(
    subjectId: string,
    currentSessionId: string,
    phone: string,
    code: string,
  ): Promise<ReauthRequired | PhoneResult<{ phone: string }>> {
    if (!(await this.sessions.findRecent(subjectId, currentSessionId))) {
      return { ok: false, reason: "reauth_required" };
    }
    if (!this.ports.sms.isConfigured()) return { ok: false, kind: "unavailable" };
    try {
      const { valid } = await this.ports.sms.checkOtp(phone, code);
      if (!valid) return { ok: false, kind: "invalid_code" };
    } catch (error) {
      if (error instanceof PhoneVerificationRateLimitedError) {
        return { ok: false, kind: "rate_limited" };
      }
      if (error instanceof InvalidPhoneNumberError) return { ok: false, kind: "invalid_phone" };
      throw error;
    }
    try {
      await this.ports.operations.setVerifiedPhone(subjectId, phone);
    } catch (error) {
      if (error instanceof IdentityOperationError && error.code === "phone_taken") {
        return { ok: false, kind: "phone_taken" };
      }
      throw error;
    }
    await this.noticeToEmail(subjectId, phone);
    return { ok: true, phone };
  }

  /** Tells the account's email that a number was verified, as the phone plugin does. */
  private async noticeToEmail(subjectId: string, phone: string): Promise<void> {
    try {
      const subject = await this.ports.operations.readSubject(subjectId);
      if (!subject) return;
      await this.ports.email.enqueue({
        template: "new-device-login",
        to: subject.email,
        userId: subjectId,
        category: "auth",
        vars: {
          userName: subject.name,
          whenDisplay: new Date().toUTCString(),
          deviceSummary: `Phone number verified: ${maskPhoneE164(phone)}`,
        },
      });
    } catch (error) {
      this.ports.onNoticeFailure?.(error);
    }
  }
}
