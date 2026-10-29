import {
  type SubmissionMutation,
  canSeeSubmission,
  submissionMutationPolicy,
  submissionSenderScope,
} from "@auction/domain";
import type {
  IItemSubmissionRepository,
  SubmissionSenderFilter,
} from "@auction/persistence/interfaces";
import type {
  ISubmissionAccessGuard,
  SubmissionAccount,
  SubmissionMutationAccess,
} from "../interfaces/submission-routes/submission-access.js";

/** Upper bound for the ids a member may see, used to narrow lists keyed by submission. */
const VISIBLE_IDS_LIMIT = 1000;

/** The submission access rule over the submissions repository (see `ISubmissionAccessGuard`). */
export class SubmissionAccessGuard implements ISubmissionAccessGuard {
  constructor(
    private readonly submissions: Pick<
      IItemSubmissionRepository,
      "findById" | "listForLegalEntity"
    >,
  ) {}

  senderFilter(account: SubmissionAccount): SubmissionSenderFilter | undefined {
    if (!account.member) return undefined;
    const scope = submissionSenderScope(account.member.actor);
    return scope === "all" ? undefined : { scope, userId: account.member.userId };
  }

  canSee(account: SubmissionAccount, submission: { submittedByUserId?: string | null }): boolean {
    if (!account.member) return true;
    return canSeeSubmission({
      scope: submissionSenderScope(account.member.actor),
      submittedByUserId: submission.submittedByUserId,
      viewerUserId: account.member.userId,
    });
  }

  async hides(account: SubmissionAccount, submissionId: string): Promise<boolean> {
    if (!this.senderFilter(account)) return false;
    const submission = await this.submissions.findById(submissionId);
    if (!submission || submission.legalEntityId !== account.legalEntityId) return true;
    return !this.canSee(account, submission);
  }

  async authoriseMutation(
    account: SubmissionAccount,
    submissionId: string,
    mutation: SubmissionMutation,
  ): Promise<SubmissionMutationAccess> {
    const { member } = account;
    if (!member) return { kind: "allowed" };
    const submission = await this.submissions.findById(submissionId);
    if (!submission || submission.legalEntityId !== account.legalEntityId) {
      return this.senderFilter(account) ? { kind: "not_found" } : { kind: "allowed" };
    }
    if (!this.canSee(account, submission)) return { kind: "not_found" };
    const decision = submissionMutationPolicy(
      { userId: member.userId, member: member.actor },
      submission,
      mutation,
    );
    return decision.allowed
      ? { kind: "allowed" }
      : { kind: "forbidden", message: decision.message };
  }

  async keepVisible<T extends { submissionId: string }>(
    account: SubmissionAccount,
    rows: readonly T[],
  ): Promise<T[]> {
    const visibleTo = this.senderFilter(account);
    if (!visibleTo) return [...rows];
    const visible = await this.submissions.listForLegalEntity(account.legalEntityId, {
      visibleTo,
      limit: VISIBLE_IDS_LIMIT,
      offset: 0,
    });
    const ids = new Set(visible.map((s) => s.id));
    return rows.filter((row) => ids.has(row.submissionId));
  }
}
