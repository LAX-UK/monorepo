import type { SecurityNoticePublisher } from "@auction/auth";
import { accountDeletionDueAt, nextDeletionCheckAfter } from "@auction/identity-contracts";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@auction/identity-contracts";
import type { PurgeEligibility } from "./account-deletion.service.js";
import type { DurableSecurityEffects } from "./durable-security-effects.js";
import type { DeletionPurgeRepository, DueCursor } from "./identity-deletion-purge.ports.js";
import { type SecurityEffectLogger, describeError } from "./settle-security-effect.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The reminder goes out this long before the erasure. */
export const DELETION_REMINDER_LEAD_DAYS = 7;
const PAGE_SIZE = 100;

export type PurgeRunSummary = {
  purged: string[];
  held: number;
  /** Not erased and not held: a product could not be asked, so the person is looked at again. */
  deferred: number;
  reminded: number;
};

export type IdentityDeletionPurgePorts = {
  repository: DeletionPurgeRepository;
  /** The same probe the request used. */
  eligibility: { checkPurgeEligibility(subjectId: string): Promise<PurgeEligibility> };
  /** Tells the person a hold began. Never throws. */
  notices: SecurityNoticePublisher;
  /** The reminder is queued here so a restart cannot lose it. */
  effects: Pick<DurableSecurityEffects, "settle">;
  /** Ends the person's sessions after the scrub. Must not throw. */
  endSessions: (subjectId: string) => Promise<void>;
  log: SecurityEffectLogger;
};

/**
 * The daily deletion run. For everyone whose grace period has ended it asks each product again
 * what the person has open, because the answer at the time of the request can be a month old:
 *
 * - nothing open: the person is erased;
 * - something open: their details are kept, the reason is recorded, the person is told, and
 *   staff see the work. The next run looks again;
 * - a product could not be asked: nobody is erased on silence, so the person waits a day.
 *
 * It also queues the reminder a week before the erasure.
 */
export class IdentityDeletionPurgeService {
  constructor(
    private readonly ports: IdentityDeletionPurgePorts,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(now: Date = this.now()): Promise<PurgeRunSummary> {
    const cutoff = new Date(now.getTime() - ACCOUNT_DELETION_GRACE_DAYS * DAY_MS);
    const summary: PurgeRunSummary = { purged: [], held: 0, deferred: 0, reminded: 0 };
    summary.reminded = await this.sendReminders(now, cutoff);

    let after: DueCursor | null = null;
    for (;;) {
      const page = await this.ports.repository.listDue({ cutoff, after, limit: PAGE_SIZE });
      for (const subject of page) {
        await this.settleOne(subject.id, now, cutoff, summary);
      }
      const last = page[page.length - 1];
      if (!last || page.length < PAGE_SIZE) break;
      after = { requestedAt: last.requestedAt, id: last.id };
    }
    return summary;
  }

  private async sendReminders(now: Date, cutoff: Date): Promise<number> {
    const remindBefore = new Date(
      now.getTime() - (ACCOUNT_DELETION_GRACE_DAYS - DELETION_REMINDER_LEAD_DAYS) * DAY_MS,
    );
    const claimed = await this.ports.repository.claimReminders({
      now,
      cutoff,
      remindBefore,
      limit: PAGE_SIZE,
    });
    for (const subject of claimed) {
      await this.ports.effects.settle("identity-deletion-purge", {
        kind: "send_account_deletion_reminder",
        userId: subject.id,
        effectiveAt: accountDeletionDueAt(subject.requestedAt).toISOString(),
      });
    }
    return claimed.length;
  }

  private async settleOne(
    subjectId: string,
    now: Date,
    cutoff: Date,
    summary: PurgeRunSummary,
  ): Promise<void> {
    try {
      const eligibility = await this.ports.eligibility.checkPurgeEligibility(subjectId);
      if (eligibility.state === "unavailable") {
        summary.deferred += 1;
        this.ports.log.warn({ subjectId }, "identity_deletion_purge_deferred");
        return;
      }
      if (eligibility.state === "blocked") {
        await this.hold(subjectId, eligibility, now);
        summary.held += 1;
        return;
      }
      if (await this.ports.repository.purge({ subjectId, cutoff, now })) {
        await this.ports.endSessions(subjectId);
        summary.purged.push(subjectId);
      }
    } catch (error) {
      // One person's failure must not stop the rest of the run; they are retried tomorrow.
      summary.deferred += 1;
      this.ports.log.error(
        { subjectId, ...describeError(error) },
        "identity_deletion_purge_subject_failed",
      );
    }
  }

  private async hold(
    subjectId: string,
    eligibility: Extract<PurgeEligibility, { state: "blocked" }>,
    now: Date,
  ): Promise<void> {
    const outcome = await this.ports.repository.recordHold({
      subjectId,
      reasons: eligibility.blockers,
      now,
    });
    if (outcome === "new") {
      this.ports.log.warn(
        { subjectId, reasons: eligibility.blockers.map((blocker) => blocker.code) },
        "identity_deletion_held",
      );
      await this.ports.notices.notify({
        kind: "account_deletion_held",
        userId: subjectId,
        at: now,
        reasons: eligibility.blockers.map((blocker) => blocker.message),
        nextCheckAt: nextDeletionCheckAfter(now),
      });
    }
  }
}
