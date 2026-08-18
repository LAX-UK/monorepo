import type { UserRole, UserStaffRole } from "@auction/types";

/** Identity subject resolved from session or JWT — no product authorization. */
export type IdentityPrincipal = {
  id: string;
};

/** Bid-owned authorization and access context loaded locally after authentication. */
export type BidUserContext = {
  role: UserRole;
  staffRole?: UserStaffRole | null;
  suspendedAt: Date | null;
  identityDisabledAt: Date | null;
  mergedIntoSubjectId: string | null;
};

export interface IBidUserContextLoader {
  loadContext(userId: string): Promise<BidUserContext | null>;
}
