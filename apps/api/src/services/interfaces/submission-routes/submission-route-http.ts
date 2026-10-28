import type { EntityActor } from "@auction/domain";

export type SubmissionHttpJson = { status: number; body: unknown };

export type SubmissionViewerContext = {
  userId: string;
  role?: string | null | undefined;
  staffRole?: string | null | undefined;
};

export type SubmissionLegalEntityContext = {
  legalEntityId: string;
  /**
   * The signed-in member and their standing with the account: recorded as a submission's sender,
   * and deciding which of the account's submissions they see.
   */
  member?: { userId: string; actor: EntityActor } | undefined;
};
