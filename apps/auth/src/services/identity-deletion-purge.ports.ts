import type { DeletionBlocker } from "@auction/identity-contracts";

/** A person whose grace period has ended and who has not been erased yet. */
export type DueSubject = {
  id: string;
  requestedAt: Date;
};

/** Where the next page of due people starts; the order is stable, so a page never repeats. */
export type DueCursor = { requestedAt: Date; id: string };

/** What recording a hold changed, so only a new hold tells the person and staff again. */
export type HoldOutcome = "new" | "changed" | "unchanged" | "gone";

/** The storage the daily purge needs. Each method is atomic on its own. */
export interface DeletionPurgeRepository {
  /** People whose request is older than `cutoff`, oldest first, after `after`. */
  listDue(input: { cutoff: Date; after: DueCursor | null; limit: number }): Promise<DueSubject[]>;
  /**
   * Keeps the person's details and records why. Publishes `user.deletion_held` in the same
   * transaction when the hold is new or its reasons changed, so staff see it.
   */
  recordHold(input: {
    subjectId: string;
    reasons: readonly DeletionBlocker[];
    now: Date;
  }): Promise<HoldOutcome>;
  /**
   * Erases the person in one transaction: copies their address into the durable outbox for the
   * confirmation email, scrubs the account, and publishes `user.identity_deleted`. Returns
   * false when someone else got there first or the request was cancelled meanwhile.
   */
  purge(input: { subjectId: string; cutoff: Date; now: Date }): Promise<boolean>;
  /**
   * Marks the reminder as queued for people whose erasure is within `remindWithin` of `now`,
   * who are not yet due and not held, and returns them. Each person is returned once.
   */
  claimReminders(input: {
    now: Date;
    cutoff: Date;
    remindBefore: Date;
    limit: number;
  }): Promise<DueSubject[]>;
}
