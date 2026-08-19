import type { Database } from "@auction/db";
import { bidUserProfile, user } from "@auction/db/schema";
import { normalizeUserRoleOrClient, normalizeUserStaffRole } from "@auction/types";
import { eq } from "drizzle-orm";
import type {
  BidUserContext,
  IBidUserContextLoader,
} from "../services/interfaces/bid-user-context.js";

/** Loads Bid authorization context from `bid_user_profile` with Identity lifecycle from `user`. */
export class DrizzleBidUserContextLoader implements IBidUserContextLoader {
  constructor(private readonly db: Database) {}

  async loadContext(userId: string): Promise<BidUserContext | null> {
    const [row] = await this.db
      .select({
        role: bidUserProfile.role,
        staffRole: bidUserProfile.staffRole,
        suspendedAt: bidUserProfile.suspendedAt,
        profileIdentityDisabledAt: bidUserProfile.identityDisabledAt,
        profileMergedIntoSubjectId: bidUserProfile.mergedIntoSubjectId,
        identityDisabledAt: user.identityDisabledAt,
        mergedIntoSubjectId: user.mergedIntoSubjectId,
      })
      .from(user)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) return null;

    return {
      role: normalizeUserRoleOrClient(row.role ?? "client"),
      staffRole: normalizeUserStaffRole(row.staffRole),
      suspendedAt: row.suspendedAt,
      identityDisabledAt: row.profileIdentityDisabledAt ?? row.identityDisabledAt,
      mergedIntoSubjectId: row.profileMergedIntoSubjectId ?? row.mergedIntoSubjectId,
    };
  }
}

export type { BidUserContext };
