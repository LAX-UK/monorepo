import type { Database } from "@auction/db";
import { type PurchaseProblemCategory, purchaseProblemReference } from "@auction/domain";
import type { ITransactionalEmailOutbox } from "@auction/email";
import type { IUserRepository } from "@auction/persistence/interfaces";

/** What a buyer is told about a report they made, queued in the transaction that changes it. */
export interface IPurchaseProblemNotices {
  queueReported(tx: Database, notice: PurchaseProblemReportedNotice): Promise<void>;
  queueResolved(tx: Database, notice: PurchaseProblemResolvedNotice): Promise<void>;
}

type NoticeBase = {
  problemId: string;
  lotId: string;
  lotTitle: string;
  /** The person who reported it; null once their account is gone, and then nobody is written to. */
  reportedByUserId: string | null;
};

export type PurchaseProblemReportedNotice = NoticeBase & { category: PurchaseProblemCategory };
export type PurchaseProblemResolvedNotice = NoticeBase;

export type EmailPurchaseProblemNoticesDeps = {
  /** The user store for one transaction. */
  usersFor: (tx: Database) => Pick<IUserRepository, "findById">;
  email: ITransactionalEmailOutbox;
  webOrigin: string;
  /** Where the buyer writes to add something, quoting the reference. */
  contactEmail: string;
};

const CATEGORY_LABELS = {
  not_as_described: "Not as described",
  damaged: "Damaged",
  not_received: "Not received",
  invoice_or_payment: "Invoice or payment",
  other: "Other",
} as const satisfies Record<PurchaseProblemCategory, string>;

/**
 * Queues the buyer's emails through the email outbox, one per report and per kind, so a change
 * that is delivered again never tells them twice. Neither email carries what the buyer wrote or
 * what staff noted.
 */
export class EmailPurchaseProblemNotices implements IPurchaseProblemNotices {
  constructor(private readonly deps: EmailPurchaseProblemNoticesDeps) {}

  async queueReported(tx: Database, notice: PurchaseProblemReportedNotice): Promise<void> {
    const common = await this.commonVars(tx, notice);
    if (!common) return;
    await this.deps.email.enqueueInTransaction(tx, {
      template: "bid-purchase-problem-received",
      to: common.to,
      userId: common.userId,
      category: "transactional",
      idempotencyKey: `bid-purchase-problem-received:${notice.problemId}`,
      vars: { ...common.vars, categoryLabel: CATEGORY_LABELS[notice.category] },
    });
  }

  async queueResolved(tx: Database, notice: PurchaseProblemResolvedNotice): Promise<void> {
    const common = await this.commonVars(tx, notice);
    if (!common) return;
    await this.deps.email.enqueueInTransaction(tx, {
      template: "bid-purchase-problem-resolved",
      to: common.to,
      userId: common.userId,
      category: "transactional",
      idempotencyKey: `bid-purchase-problem-resolved:${notice.problemId}`,
      vars: common.vars,
    });
  }

  /** Who to write to and what both emails say; null when the reporter has no address to write to. */
  private async commonVars(tx: Database, notice: NoticeBase) {
    if (!notice.reportedByUserId) return null;
    const user = await this.deps.usersFor(tx).findById(notice.reportedByUserId);
    if (!user?.email) return null;
    return {
      to: user.email,
      userId: notice.reportedByUserId,
      vars: {
        userName: user.name,
        reference: purchaseProblemReference(notice.problemId),
        lotTitle: notice.lotTitle,
        purchaseUrl: `${this.deps.webOrigin.replace(/\/$/, "")}/purchases/${notice.lotId}`,
        contactEmail: this.deps.contactEmail,
      },
    };
  }
}
