import type { EntityActor, SubmissionMutation } from "@auction/domain";
import type { SubmissionSenderFilter } from "@auction/persistence/interfaces";

/** The account a client request acts for, and the signed-in member's standing with it. */
export type SubmissionAccount = {
  legalEntityId: string;
  /** Absent for callers that predate members; they see every submission of the account. */
  member?: { userId: string; actor: EntityActor } | undefined;
};

/** Whether a member may change a submission, from the domain `submissionMutationPolicy`. */
export type SubmissionMutationAccess =
  | { kind: "allowed" }
  /** The member may not see the submission, so it answers "Not found". */
  | { kind: "not_found" }
  | { kind: "forbidden"; message: string };

/**
 * Decides which of an account's submissions the signed-in member may reach, from the domain rule
 * (`submissionSenderScope`). Every client endpoint keyed by a submission id goes through it, so a
 * hidden submission answers "Not found" everywhere, exactly like one in another account.
 */
export interface ISubmissionAccessGuard {
  /** The list filter for the member; `undefined` when they see every submission. */
  senderFilter(account: SubmissionAccount): SubmissionSenderFilter | undefined;
  /** Whether the member may see a submission already known to belong to the account. */
  canSee(account: SubmissionAccount, submission: { submittedByUserId?: string | null }): boolean;
  /**
   * Whether the submission must answer "Not found" to this member because of who sent it. Members
   * who see every submission are never refused here; account ownership is checked by each use case
   * as before, which keeps staff paths through the same routes working.
   */
  hides(account: SubmissionAccount, submissionId: string): Promise<boolean>;
  /**
   * Whether the member may make `mutation` on the submission: who sent it against their role.
   * A submission they may not see is `not_found`. A submission outside the account is left to
   * the use case, as with `hides`, so staff paths through the same routes keep working.
   */
  authoriseMutation(
    account: SubmissionAccount,
    submissionId: string,
    mutation: SubmissionMutation,
  ): Promise<SubmissionMutationAccess>;
  /** Keeps the rows whose submission the member may see. */
  keepVisible<T extends { submissionId: string }>(
    account: SubmissionAccount,
    rows: readonly T[],
  ): Promise<T[]>;
}
