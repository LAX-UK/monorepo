import type { IEmailService } from "@auction/email";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";

/** One deal whose hold on a party's evidence needs a person to look at it. */
export type RetentionHoldAttention = {
  reference: string;
  kind: "no_end" | "stale";
};

/** Tells the people who decide on compliance that holds need a look. */
export interface IRetentionHoldAlerts {
  needAttention(holds: readonly RetentionHoldAttention[]): Promise<void>;
}

const REASON: Record<RetentionHoldAttention["kind"], string> = {
  no_end: "ended, but no end date is recorded, so the hold has no end",
  stale: "still open, and has not changed stage for longer than the retention period",
};

/** The Monday of the week, so the same problem is raised once a week, not once a day. */
function weekKey(now: Date): string {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

const MAX_LINES = 20;

export type RetentionHoldAlertDeps = {
  emailService: Pick<IEmailService, "enqueue">;
  complianceRecipients: Pick<IComplianceRecipientReader, "listRecipients">;
  /** Used when no compliance recipient is configured, so the alert is never lost. */
  adminEmailAddress?: string | undefined;
  supportContactEmail: string;
  now?: () => Date;
};

/** Emails the compliance recipients, at most once a week for the same holds. */
export class RetentionHoldAlerts implements IRetentionHoldAlerts {
  constructor(private readonly deps: RetentionHoldAlertDeps) {}

  async needAttention(holds: readonly RetentionHoldAttention[]): Promise<void> {
    if (holds.length === 0) return;
    const lines = holds
      .slice(0, MAX_LINES)
      .map((hold) => `${hold.reference}: ${REASON[hold.kind]}`);
    const week = weekKey(this.deps.now?.() ?? new Date());
    const vars = {
      lines,
      count: holds.length,
      supportContactEmail: this.deps.supportContactEmail,
    };
    const recipients = await this.deps.complianceRecipients.listRecipients();
    if (recipients.length === 0) {
      if (!this.deps.adminEmailAddress) return;
      await this.deps.emailService.enqueue({
        template: "kyc-retention-hold-notice",
        to: this.deps.adminEmailAddress,
        recipientResolution: "snapshot",
        vars: { ...vars, recipientFirstName: "Compliance" },
        category: "transactional",
        idempotencyKey: `kyc-retention-hold-notice:${week}:admin`,
      });
      return;
    }
    for (const recipient of recipients) {
      await this.deps.emailService.enqueue({
        template: "kyc-retention-hold-notice",
        to: recipient.email,
        userId: recipient.id,
        vars: { ...vars, recipientFirstName: recipient.firstName },
        category: "transactional",
        idempotencyKey: `kyc-retention-hold-notice:${week}:${recipient.id}`,
      });
    }
  }
}
