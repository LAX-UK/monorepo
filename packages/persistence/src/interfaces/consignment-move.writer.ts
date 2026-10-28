import type { ItemSubmissionStatus } from "@auction/types";

export type ConsignmentMoveRow = {
  submissionId: string;
  fromLegalEntityId: string;
  toLegalEntityId: string;
  /** The move happens only while the consignment is still in one of these statuses. */
  movableStatuses: readonly ItemSubmissionStatus[];
  /**
   * The seller accepted the agreement personally. The acceptance does not carry over: it is
   * cleared and the same terms are proposed again to the organisation.
   */
  resetAgreementAcceptance: boolean;
  /**
   * The person the personal consignment belongs to. A consignment with no recorded sender is
   * attributed to them, so it stays visible to them as a member of the organisation.
   */
  sellerUserId: string | null;
  movedAt: Date;
};

/** Moves a consignment, with its agreement, from one account to another in one transaction. */
export interface IConsignmentMoveWriter {
  /** `false` when the consignment is no longer in the source account or a movable status. */
  move(row: ConsignmentMoveRow): Promise<boolean>;
}
