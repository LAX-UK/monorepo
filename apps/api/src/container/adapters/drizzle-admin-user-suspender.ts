import type { Database } from "@auction/db";
import { bidIdentityDirectory, domainEvent } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { writeBidUserProfile } from "@auction/persistence/bid-user-profile-sync";
import type { IAdminUserSuspender } from "@auction/persistence/interfaces";
import { inArray } from "drizzle-orm";

const SUSPENDED_EVENT = "bid.user_suspended";
const UNSUSPENDED_EVENT = "bid.user_unsuspended";

/**
 * Suspension and its audit trail share one transaction: each account's profile and its
 * `domain_events` row (actor, reason) commit together or not at all. The notification emails are
 * queued afterwards, so a mail failure never undoes a suspension that is already recorded.
 */
export class DrizzleAdminUserSuspender implements IAdminUserSuspender {
  constructor(
    private readonly db: Database,
    private readonly hooks?: {
      emailService?: IEmailService;
      accountSuspendedSupportEmail?: string;
    },
  ) {}

  async suspendMany(input: {
    userIds: string[];
    reason: string;
    actorUserId: string;
    bulk: boolean;
  }): Promise<void> {
    const userIds = [...new Set(input.userIds)];
    if (userIds.length === 0) return;

    const recipients = this.hooks?.emailService
      ? await this.db
          .select({
            subjectId: bidIdentityDirectory.subjectId,
            email: bidIdentityDirectory.email,
            name: bidIdentityDirectory.name,
          })
          .from(bidIdentityDirectory)
          .where(inArray(bidIdentityDirectory.subjectId, userIds))
      : [];

    const suspendedAt = new Date();
    await this.db.transaction(async (tx) => {
      for (const userId of userIds) {
        await writeBidUserProfile(tx, userId, { suspendedAt, suspendedReason: input.reason });
      }
      await tx.insert(domainEvent).values(
        userIds.map((userId) => ({
          aggregateType: "user",
          aggregateId: userId,
          eventType: SUSPENDED_EVENT,
          producer: "apps/api",
          payload: { reason: input.reason, bulk: input.bulk },
          actorUserId: input.actorUserId,
          schemaVersion: 1,
        })),
      );
    });

    const emailService = this.hooks?.emailService;
    if (!emailService) return;
    for (const person of recipients) {
      if (!person.email) continue;
      try {
        await emailService.enqueue({
          template: "account-suspended",
          to: person.email,
          userId: person.subjectId,
          category: "auth",
          vars: {
            userName: person.name,
            supportContactEmail: this.hooks?.accountSuspendedSupportEmail ?? "support@lax.bid",
          },
        });
      } catch {
        // The suspension and its audit entry are committed; a queueing failure must not undo them.
      }
    }
  }

  async unsuspendMany(input: {
    userIds: string[];
    actorUserId: string;
    bulk: boolean;
  }): Promise<void> {
    const userIds = [...new Set(input.userIds)];
    if (userIds.length === 0) return;
    await this.db.transaction(async (tx) => {
      for (const userId of userIds) {
        await writeBidUserProfile(tx, userId, { suspendedAt: null, suspendedReason: null });
      }
      await tx.insert(domainEvent).values(
        userIds.map((userId) => ({
          aggregateType: "user",
          aggregateId: userId,
          eventType: UNSUSPENDED_EVENT,
          producer: "apps/api",
          payload: { bulk: input.bulk },
          actorUserId: input.actorUserId,
          schemaVersion: 1,
        })),
      );
    });
  }
}
