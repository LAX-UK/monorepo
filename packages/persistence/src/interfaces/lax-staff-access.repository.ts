import type { LaxStaffAccessProduct } from "@auction/types";

/** One platform role held by a subject, as the owning product last recorded it. */
export type LaxStaffAccessEntry = {
  subjectId: string;
  product: LaxStaffAccessProduct;
  role: string;
  updatedAt: Date;
};

/** A grant or revoke Bid recorded for a subject (invitation acceptance or admin change). */
export type LaxStaffAccessHistoryEntry = {
  eventId: number;
  at: Date;
  product: LaxStaffAccessProduct;
  action: "granted" | "revoked";
  role: string | null;
  actorSubjectId: string;
  invitationId: string | null;
};

export type LaxStaffAccessRequest = {
  subjectId: string;
  product: Exclude<LaxStaffAccessProduct, "bid">;
  actorSubjectId: string;
};

export interface ILaxStaffAccessRepository {
  listForSubjects(subjectIds: readonly string[]): Promise<LaxStaffAccessEntry[]>;
  history(subjectId: string, limit: number): Promise<LaxStaffAccessHistoryEntry[]>;
  /** Asks the owning product to grant `role`; it applies the change asynchronously. */
  requestGrant(input: LaxStaffAccessRequest & { role: string }): Promise<void>;
  requestRevoke(input: LaxStaffAccessRequest): Promise<void>;
}
