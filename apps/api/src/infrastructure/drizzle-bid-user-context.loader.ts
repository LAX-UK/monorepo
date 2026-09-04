import type { Database } from "@auction/db";
import { bidUserProfile } from "@auction/db/schema";
import { normalizeUserRoleOrClient, normalizeUserStaffRole } from "@auction/types";
import { eq } from "drizzle-orm";
import type {
  BidUserContext,
  IBidUserContextLoader,
} from "../services/interfaces/bid-user-context.js";

/** Loads Bid authorization and projected Identity lifecycle from the Bid-owned profile. */
export class DrizzleBidUserContextLoader implements IBidUserContextLoader {
  constructor(private readonly db: Database) {}

  async loadContext(userId: string): Promise<BidUserContext | null> {
    const [row] = await this.db
      .select({
        role: bidUserProfile.role,
        staffRole: bidUserProfile.staffRole,
        suspendedAt: bidUserProfile.suspendedAt,
        identityDisabledAt: bidUserProfile.identityDisabledAt,
        mergedIntoSubjectId: bidUserProfile.mergedIntoSubjectId,
      })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, userId))
      .limit(1);
    if (!row) return null;

    return {
      role: normalizeUserRoleOrClient(row.role ?? "client"),
      staffRole: normalizeUserStaffRole(row.staffRole),
      suspendedAt: row.suspendedAt,
      identityDisabledAt: row.identityDisabledAt,
      mergedIntoSubjectId: row.mergedIntoSubjectId,
    };
  }
}

export type { BidUserContext };
