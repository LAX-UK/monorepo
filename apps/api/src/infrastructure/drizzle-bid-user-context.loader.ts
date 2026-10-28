import type { Database } from "@auction/db";
import { bidUserProfile } from "@auction/db/schema";
import type { IStaffRoleAssignmentReader } from "@auction/persistence/interfaces";
import { NO_STAFF_ROLES, normalizeUserRoleOrClient } from "@auction/types";
import { eq } from "drizzle-orm";
import type {
  BidUserContext,
  IBidUserContextLoader,
} from "../services/interfaces/bid-user-context.js";

/**
 * Loads Bid authorization and projected Identity lifecycle from the Bid-owned profile, and the
 * staff roles in force from role assignments. Called once per authenticated request.
 */
export class DrizzleBidUserContextLoader implements IBidUserContextLoader {
  constructor(
    private readonly db: Database,
    private readonly staffRoles: Pick<IStaffRoleAssignmentReader, "listActiveRoles">,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async loadContext(userId: string): Promise<BidUserContext | null> {
    const [row] = await this.db
      .select({
        role: bidUserProfile.role,
        suspendedAt: bidUserProfile.suspendedAt,
        identityDisabledAt: bidUserProfile.identityDisabledAt,
        mergedIntoSubjectId: bidUserProfile.mergedIntoSubjectId,
      })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, userId))
      .limit(1);
    if (!row) return null;

    const role = normalizeUserRoleOrClient(row.role ?? "client");
    return {
      role,
      staffRoles:
        role === "staff"
          ? await this.staffRoles.listActiveRoles(userId, this.clock())
          : NO_STAFF_ROLES,
      suspendedAt: row.suspendedAt,
      identityDisabledAt: row.identityDisabledAt,
      mergedIntoSubjectId: row.mergedIntoSubjectId,
    };
  }
}

export type { BidUserContext };
