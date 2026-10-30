import type { AccessRequestStatus } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";

export type AccessRequestRow = {
  id: string;
  legalEntityId: string;
  requesterUserId: string;
  /** The requester's name from the identity directory, when known. */
  requesterName: string | null;
  requestedRole: LegalEntityMemberRole | null;
  requestedCapability: string | null;
  reason: string;
  status: AccessRequestStatus;
  grantedRole: LegalEntityMemberRole | null;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
};

export type NewAccessRequest = {
  legalEntityId: string;
  requesterUserId: string;
  requestedRole: LegalEntityMemberRole | null;
  requestedCapability: string | null;
  reason: string;
};

export type AccessRequestDecision = {
  status: Exclude<AccessRequestStatus, "pending">;
  decidedByUserId: string;
  grantedRole?: LegalEntityMemberRole | null;
  decisionNote?: string | null;
};

/** Requests for more access, one pending request per member and role or capability. */
export interface IAccessRequestRepository {
  /** Opens a request, or returns the member's pending one for the same ask (idempotent). */
  openOrFindPending(input: NewAccessRequest): Promise<{ row: AccessRequestRow; created: boolean }>;
  find(legalEntityId: string, id: string): Promise<AccessRequestRow | null>;
  list(input: {
    legalEntityId: string;
    requesterUserId: string | null;
    status?: AccessRequestStatus | undefined;
    limit: number;
  }): Promise<AccessRequestRow[]>;
  /** Closes a pending request; `null` when it was no longer pending. */
  close(id: string, decision: AccessRequestDecision): Promise<AccessRequestRow | null>;
}

/** The member's membership row in the organisation, for the role change on approval. */
export interface IActiveMemberLookup {
  activeMember(
    legalEntityId: string,
    userId: string,
  ): Promise<{ memberId: string; role: LegalEntityMemberRole } | null>;
}
