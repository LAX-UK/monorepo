import type { Database } from "@auction/db";
import { domainEvent, emailOutbox, emailSuppression } from "@auction/db/schema";
import { bidIdentityDirectory } from "@auction/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { writeBidUserProfile } from "../bid-user-profile-sync.js";
import type {
  EmailBlockLiftRecord,
  EmailBlockRecord,
  IEmailBlockRepository,
} from "../interfaces/email-block.repository.js";

export class DrizzleEmailBlockRepository implements IEmailBlockRepository {
  constructor(private readonly db: Database) {}

  async findByHash(emailHash: string): Promise<EmailBlockRecord | null> {
    const [row] = await this.db
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.emailHash, emailHash))
      .limit(1);
    return row ? { emailHash: row.emailHash, reason: row.reason, since: row.createdAt } : null;
  }

  async findUserIdByHash(emailHash: string): Promise<string | null> {
    const [row] = await this.db
      .select({ userId: emailOutbox.userId })
      .from(emailOutbox)
      .where(eq(emailOutbox.toEmailHash, emailHash))
      .orderBy(desc(emailOutbox.createdAt))
      .limit(1);
    return row?.userId ?? null;
  }

  async removeIfUnchangedInTransaction(
    tx: Database,
    input: { emailHash: string; expectedSince: Date },
  ): Promise<EmailBlockRecord | null> {
    // The screen holds the start time to the millisecond; the column keeps microseconds.
    const [row] = await tx
      .delete(emailSuppression)
      .where(
        and(
          eq(emailSuppression.emailHash, input.emailHash),
          sql`date_trunc('milliseconds', ${emailSuppression.createdAt}) = ${input.expectedSince.toISOString()}::timestamptz`,
        ),
      )
      .returning();
    return row ? { emailHash: row.emailHash, reason: row.reason, since: row.createdAt } : null;
  }

  async resetAddressStatusInTransaction(tx: Database, userId: string): Promise<void> {
    await writeBidUserProfile(tx, userId, { emailStatus: "ok", emailStatusChangedAt: new Date() });
  }

  async findLatestLift(userId: string): Promise<EmailBlockLiftRecord | null> {
    const [row] = await this.db
      .select({
        at: domainEvent.occurredAt,
        byUserId: domainEvent.actorUserId,
        byName: bidIdentityDirectory.name,
      })
      .from(domainEvent)
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, domainEvent.actorUserId))
      .where(
        and(eq(domainEvent.eventType, "email.block_lifted"), eq(domainEvent.aggregateId, userId)),
      )
      .orderBy(desc(domainEvent.occurredAt))
      .limit(1);
    return row ?? null;
  }
}
