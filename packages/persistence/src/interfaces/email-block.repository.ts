import type { Database } from "@auction/db";
import type { EmailSuppressionReason } from "@auction/db/schema";

export type EmailBlockRecord = {
  emailHash: string;
  reason: EmailSuppressionReason;
  since: Date;
};

export type EmailBlockLiftRecord = {
  at: Date;
  byUserId: string | null;
  byName: string | null;
};

/** Writes and lookups for the block on an address, used when staff lift it. */
export interface IEmailBlockRepository {
  findByHash(emailHash: string): Promise<EmailBlockRecord | null>;
  /** The person an address belongs to, from the latest email sent to it. */
  findUserIdByHash(emailHash: string): Promise<string | null>;
  /**
   * Removes the block only if it still began at `expectedSince`, and returns it. Null means it was
   * already lifted or has been replaced by a newer block.
   */
  removeIfUnchangedInTransaction(
    tx: Database,
    input: { emailHash: string; expectedSince: Date },
  ): Promise<EmailBlockRecord | null>;
  /** Puts the person's email status back to "ok". */
  resetAddressStatusInTransaction(tx: Database, userId: string): Promise<void>;
  /** The latest lift recorded for a person, so a stale lift can say who got there first. */
  findLatestLift(userId: string): Promise<EmailBlockLiftRecord | null>;
}
