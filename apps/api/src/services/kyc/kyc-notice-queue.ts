import type { Database } from "@auction/db";
import type { IEmailService, ITransactionalEmailOutbox } from "@auction/email";
import type {
  INotificationWriteRepository,
  IUserRepository,
} from "@auction/persistence/interfaces";
import type { INotificationFactory } from "../interfaces/notification-factory.js";
import type { KycOutcomeNotice, KycResubmissionNotice } from "./kyc-contracts.js";

/**
 * Queues what a person is told about their identity check, in the transaction that applies the
 * decision. The email goes to the email outbox, which sends it with retries; the in-app notice is
 * written in the same transaction. Either both are stored with the decision or neither is, and a
 * decision that is delivered again is not applied again, so nobody is told twice.
 */
export interface IKycNoticeQueue {
  queueOutcome(tx: Database, notice: KycOutcomeNotice): Promise<void>;
  queueResubmission(tx: Database, notice: KycResubmissionNotice): Promise<void>;
}

export type KycNoticeQueueDeps = {
  /** The user and notification stores bound to the decision's transaction. */
  usersFor: (tx: Database) => Pick<IUserRepository, "findById">;
  notificationsFor: (tx: Database) => INotificationWriteRepository;
  email: ITransactionalEmailOutbox;
  factory: Pick<INotificationFactory, "createKycApproved" | "createKycDeclined">;
  webOrigin: string;
};

/** Names the decision, so the same decision always has the same key. No address is in it. */
function decisionKey(notice: { providerSessionId: string; providerAttemptId: string | null }) {
  return `${notice.providerSessionId}:${notice.providerAttemptId ?? "none"}`;
}

export class KycNoticeQueue implements IKycNoticeQueue {
  constructor(private readonly deps: KycNoticeQueueDeps) {}

  async queueOutcome(tx: Database, notice: KycOutcomeNotice): Promise<void> {
    const { userId, outcome } = notice;
    const user = await this.deps.usersFor(tx).findById(userId);
    if (!user?.email) return;

    const origin = this.origin();
    const idempotencyKey = `kyc-${outcome}:${userId}:${decisionKey(notice)}`;
    if (outcome === "approved") {
      await this.send(tx, {
        template: "kyc-approved",
        to: user.email,
        userId,
        category: "transactional",
        vars: { userName: user.name, registerUrl: `${origin}/sales` },
        idempotencyKey,
      });
      await this.deps
        .notificationsFor(tx)
        .createMany([this.deps.factory.createKycApproved(userId)]);
      return;
    }
    await this.send(tx, {
      template: "kyc-declined",
      to: user.email,
      userId,
      category: "transactional",
      vars: {
        userName: user.name,
        retryUrl: `${origin}/verify-identity`,
        contactUrl: `${origin}/contact`,
      },
      idempotencyKey,
    });
    await this.deps.notificationsFor(tx).createMany([this.deps.factory.createKycDeclined(userId)]);
  }

  async queueResubmission(tx: Database, notice: KycResubmissionNotice): Promise<void> {
    const { userId, feedback } = notice;
    const user = await this.deps.usersFor(tx).findById(userId);
    if (!user?.email) return;

    const issueDetail = feedback.detail;
    await this.send(tx, {
      template: "kyc-resubmission-required",
      to: user.email,
      userId,
      category: "transactional",
      vars: {
        userName: user.name,
        issueDetail,
        verifyUrl: `${this.origin()}/verify-identity`,
      },
      idempotencyKey: `kyc-resubmission-required:${userId}:${decisionKey(notice)}`,
    });
    await this.deps.notificationsFor(tx).createMany([
      {
        userId,
        type: "kyc_resubmission_required",
        // Identity checks are for the person, so the notice is personal.
        legalEntityId: null,
        title: feedback.headline,
        message: issueDetail ?? "Please continue verification and resubmit the missing items.",
      },
    ]);
  }

  private origin(): string {
    return this.deps.webOrigin.replace(/\/$/, "");
  }

  /** Always in the decision's transaction. */
  private async send(tx: Database, input: Parameters<IEmailService["enqueue"]>[0]): Promise<void> {
    await this.deps.email.enqueueInTransaction(tx, input);
  }
}
