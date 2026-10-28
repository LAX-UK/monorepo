import type { EntityActor } from "@auction/domain";
import type { StaffRoles } from "@auction/types";

export type SubmissionHttpJson = { status: number; body: unknown };

export type SubmissionViewerContext = {
  userId: string;
  role?: string | null | undefined;
  staffRoles?: StaffRoles | undefined;
};

export type SubmissionLegalEntityContext = {
  legalEntityId: string;
  /**
   * The signed-in member and their standing with the account: recorded as a submission's sender,
   * and deciding which of the account's submissions they see.
   */
  member?: { userId: string; actor: EntityActor } | undefined;
};
