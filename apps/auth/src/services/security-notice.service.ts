import {
  type EmailSender,
  type SecurityNoticeEvent,
  type SecurityNoticePublisher,
  maskPhoneE164,
} from "@auction/auth";
import { ACCOUNT_DELETION_GRACE_DAYS, formatDeviceLabel } from "@auction/identity-contracts";
import { formatLondonDate, formatLondonTime } from "./format-london-time.js";
import type { IIdentitySubjectRepository } from "./identity-operations.ports.js";
import {
  type KnownDeviceStore,
  NEW_DEVICE_NOTICES_PER_DAY,
  NEW_DEVICE_NOTICE_WINDOW_MS,
  fingerprintDevice,
  isNewDevice,
} from "./known-device.js";
import { type SecurityEffectLogger, describeError } from "./settle-security-effect.js";

export type SecurityNoticeDeps = {
  /** Read straight from the repository, not the operations service, which itself sends notices. */
  subjects: Pick<IIdentitySubjectRepository, "findById">;
  email: EmailSender;
  devices: KnownDeviceStore;
  /** LAX Account's security page: where "this wasn't me" sends the reader. */
  secureAccountUrl: string;
  /** LAX Account's "Delete your account" page, where a deletion request is cancelled. */
  cancelDeletionUrl: string;
  log: SecurityEffectLogger;
};

/**
 * Turns "something happened to this account" into the email the person should receive. The
 * message states what happened, when (Europe/London) and on which browser, and always carries
 * the link to secure the account.
 *
 * Mail goes to the shared email outbox over HTTP, so it cannot join the database transaction of
 * the change it reports. The change has already committed when this runs, and `notify` never
 * throws: a notice that cannot be queued is logged and must not undo or block what it reports.
 */
export class SecurityNoticeService implements SecurityNoticePublisher {
  constructor(
    private readonly deps: SecurityNoticeDeps,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async notify(event: SecurityNoticeEvent): Promise<void> {
    try {
      await this.send(event);
    } catch (error) {
      this.deps.log.error(
        { ...describeError(error), kind: event.kind, userId: event.userId },
        "security_notice_failed",
      );
    }
  }

  private async send(event: SecurityNoticeEvent): Promise<void> {
    const subject = await this.deps.subjects.findById(event.userId);
    if (!subject) return;
    const base = {
      userName: subject.name,
      whenDisplay: formatLondonTime(event.at),
      deviceLabel: event.userAgent ? formatDeviceLabel(event.userAgent) : null,
      secureAccountUrl: this.deps.secureAccountUrl,
    };
    const enqueue = (
      template: Parameters<EmailSender["enqueue"]>[0]["template"],
      to: string,
      vars: Record<string, unknown>,
    ) =>
      this.deps.email.enqueue({
        template,
        to,
        userId: event.userId,
        category: "auth",
        vars: { ...base, ...vars },
      });

    switch (event.kind) {
      case "password_changed":
        await enqueue("password-changed", subject.email, {});
        return;
      case "two_factor_enabled":
        await enqueue("2fa-enabled", subject.email, {});
        return;
      case "two_factor_disabled":
        await enqueue("2fa-disabled", subject.email, {});
        return;
      case "two_factor_reset_by_support":
        await enqueue("2fa-reset-by-support", subject.email, {});
        return;
      case "backup_codes_regenerated":
        await enqueue("backup-codes-regenerated", subject.email, {});
        return;
      case "account_deletion_requested":
        await enqueue("account-deletion-requested", subject.email, {
          effectiveDateDisplay: formatLondonDate(event.effectiveAt),
          graceDays: ACCOUNT_DELETION_GRACE_DAYS,
          cancelDeletionUrl: this.deps.cancelDeletionUrl,
        });
        return;
      case "account_deletion_cancelled":
        await enqueue("account-deletion-cancelled", subject.email, {});
        return;
      case "phone_verified":
        await enqueue("phone-verified", subject.email, { maskedPhone: maskPhoneE164(event.phone) });
        return;
      case "email_changed": {
        const addresses = { previousEmail: event.previousEmail, newEmail: event.newEmail };
        // Both inboxes hear about it: the old one is the one that can still stop a takeover.
        const results = await Promise.allSettled([
          enqueue("email-changed", event.previousEmail, { ...addresses, recipient: "previous" }),
          enqueue("email-changed", event.newEmail, { ...addresses, recipient: "new" }),
        ]);
        const failed = results.find((result) => result.status === "rejected");
        if (failed) throw failed.reason;
        return;
      }
      case "sign_in":
        await this.notifyIfNewDevice(event, () => enqueue("new-device-login", subject.email, {}));
        return;
    }
  }

  private async notifyIfNewDevice(
    event: Extract<SecurityNoticeEvent, { kind: "sign_in" }>,
    send: () => Promise<unknown>,
  ): Promise<void> {
    const fingerprint = fingerprintDevice(event);
    const seen = await this.deps.devices.touch({ userId: event.userId, fingerprint, at: event.at });
    if (!isNewDevice(seen, event.at)) return;
    const since = new Date(this.now().getTime() - NEW_DEVICE_NOTICE_WINDOW_MS);
    const sent = await this.deps.devices.countNoticesSince(event.userId, since);
    if (sent >= NEW_DEVICE_NOTICES_PER_DAY) return;
    await send();
    await this.deps.devices.markNotified({ userId: event.userId, fingerprint, at: event.at });
  }
}
