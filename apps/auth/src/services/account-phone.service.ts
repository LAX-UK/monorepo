import {
  InvalidPhoneNumberError,
  PhoneVerificationRateLimitedError,
  type SecurityNoticePublisher,
  type SmsSender,
} from "@auction/auth";
import type { ReauthRequired } from "./account-contact.service.js";
import {
  IdentityOperationError,
  type IdentityOperationsService,
} from "./identity-operations.service.js";
import { RecentSessionGuard } from "./recent-session-guard.js";

export type AccountPhoneRemoveFailure = "no_phone";

export type AccountPhoneFailure =
  | "invalid_phone"
  | "invalid_code"
  | "phone_taken"
  | "rate_limited"
  | "unavailable";

export type AccountPhonePorts = {
  operations: Pick<IdentityOperationsService, "listSessions" | "setVerifiedPhone" | "clearPhone">;
  /** The SMS provider the Better Auth phone plugin sends through (Twilio Verify, or the console in development). */
  sms: SmsSender;
  /** Tells the account's email about the change; it never throws and never undoes the change. */
  notices: SecurityNoticePublisher;
};

type PhoneResult<T> = ({ ok: true } & T) | { ok: false; kind: AccountPhoneFailure };

/**
 * Adding, changing or removing the phone number on a LAX identity, from LAX Account.
 *
 * It sends and checks the code through the same SMS provider the Better Auth phone plugin
 * uses, but not through the plugin's HTTP endpoints: those authenticate with the issuer's
 * browser cookie, which LAX Account (a confidential client acting on a person's behalf) does
 * not hold. The number is contact information only: a person cannot sign in with it and it is not
 * a second factor (two-step verification is an authenticator app plus backup codes), so removing
 * it can never lock anyone out. Sending a code, saving the number and removing it all need a
 * recent sign-in.
 */
export class AccountPhoneService {
  private readonly sessions: RecentSessionGuard;

  constructor(
    private readonly ports: AccountPhonePorts,
    private readonly now: () => Date = () => new Date(),
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
    const current = await this.sessions.findRecent(subjectId, currentSessionId);
    if (!current) return { ok: false, reason: "reauth_required" };
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
    void this.ports.notices.notify({
      kind: "phone_verified",
      userId: subjectId,
      at: this.now(),
      phone,
      userAgent: current.userAgent,
    });
    return { ok: true, phone };
  }

  async remove(
    subjectId: string,
    currentSessionId: string,
  ): Promise<
    ReauthRequired | PhoneResult<object> | { ok: false; kind: AccountPhoneRemoveFailure }
  > {
    const current = await this.sessions.findRecent(subjectId, currentSessionId);
    if (!current) return { ok: false, reason: "reauth_required" };
    const removed = await this.ports.operations.clearPhone(subjectId);
    if (removed === null) return { ok: false, kind: "no_phone" };
    void this.ports.notices.notify({
      kind: "phone_removed",
      userId: subjectId,
      at: this.now(),
      phone: removed,
      userAgent: current.userAgent,
    });
    return { ok: true };
  }
}
