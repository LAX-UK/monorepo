import type { Database } from "@auction/db";
import { bidUserProfile, user } from "@auction/db/schema";
import { normalizeUserRoleOrClient, normalizeUserStaffRole } from "@auction/types";
import { eq } from "drizzle-orm";
import type {
  BidUserContext,
  IBidUserContextLoader,
} from "../services/interfaces/bid-user-context.js";

function logProfileMismatch(
  userId: string,
  field: string,
  profileValue: unknown,
  legacyValue: unknown,
) {
  console.warn("[bid_user_profile] dual-read mismatch", {
    userId,
    field,
    profileValue,
    legacyValue,
  });
}

/**
 * Dual-read Bid profile: prefer `bid_user_profile`, fall back to legacy `user` columns
 * during migration. Emits mismatch telemetry when both rows exist but diverge.
 */
export class DrizzleBidUserContextLoader implements IBidUserContextLoader {
  constructor(private readonly db: Database) {}

  async loadContext(userId: string): Promise<BidUserContext | null> {
    const profile = await this.db.query.bidUserProfile.findFirst({
      where: eq(bidUserProfile.userId, userId),
      columns: {
        role: true,
        staffRole: true,
        suspendedAt: true,
        identityDisabledAt: true,
        mergedIntoSubjectId: true,
      },
    });

    const legacy = await this.db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        role: true,
        staffRole: true,
        suspendedAt: true,
        identityDisabledAt: true,
        mergedIntoSubjectId: true,
      },
    });
    if (!legacy && !profile) return null;

    if (profile && legacy) {
      if (profile.role !== legacy.role) {
        logProfileMismatch(userId, "role", profile.role, legacy.role);
      }
      if (profile.staffRole !== legacy.staffRole) {
        logProfileMismatch(userId, "staffRole", profile.staffRole, legacy.staffRole);
      }
      if ((profile.suspendedAt?.getTime() ?? null) !== (legacy.suspendedAt?.getTime() ?? null)) {
        logProfileMismatch(userId, "suspendedAt", profile.suspendedAt, legacy.suspendedAt);
      }
      if (
        (profile.identityDisabledAt?.getTime() ?? null) !==
        (legacy.identityDisabledAt?.getTime() ?? null)
      ) {
        logProfileMismatch(
          userId,
          "identityDisabledAt",
          profile.identityDisabledAt,
          legacy.identityDisabledAt,
        );
      }
      if (profile.mergedIntoSubjectId !== legacy.mergedIntoSubjectId) {
        logProfileMismatch(
          userId,
          "mergedIntoSubjectId",
          profile.mergedIntoSubjectId,
          legacy.mergedIntoSubjectId,
        );
      }
    }

    if (profile) {
      return {
        role: normalizeUserRoleOrClient(profile.role),
        staffRole: normalizeUserStaffRole(profile.staffRole),
        suspendedAt: profile.suspendedAt,
        // Fail closed while the lifecycle projector catches up.
        identityDisabledAt: profile.identityDisabledAt ?? legacy?.identityDisabledAt ?? null,
        mergedIntoSubjectId: profile.mergedIntoSubjectId ?? legacy?.mergedIntoSubjectId ?? null,
      };
    }

    if (!legacy) return null;
    return {
      role: normalizeUserRoleOrClient(legacy.role),
      staffRole: normalizeUserStaffRole(legacy.staffRole),
      suspendedAt: legacy.suspendedAt,
      identityDisabledAt: legacy.identityDisabledAt,
      mergedIntoSubjectId: legacy.mergedIntoSubjectId,
    };
  }
}

export type { BidUserContext };
