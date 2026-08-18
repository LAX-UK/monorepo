import type { Database } from "@auction/db";
import { bidUserProfile, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { emitBidProfileMismatch } from "../bid-user-profile-sync.js";
import type { IUserSuspensionChecker } from "../interfaces/user-suspension.checker.js";

export class DrizzleUserSuspensionChecker implements IUserSuspensionChecker {
  constructor(private readonly db: Database) {}

  async isSuspended(userId: string): Promise<boolean> {
    const [[profile], [legacy]] = await Promise.all([
      this.db
        .select({ suspendedAt: bidUserProfile.suspendedAt })
        .from(bidUserProfile)
        .where(eq(bidUserProfile.userId, userId))
        .limit(1),
      this.db
        .select({ suspendedAt: user.suspendedAt })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1),
    ]);
    if (profile) {
      if (profile.suspendedAt?.getTime() !== legacy?.suspendedAt?.getTime()) {
        emitBidProfileMismatch({
          userId,
          field: "suspendedAt",
          profileValue: profile.suspendedAt,
          legacyValue: legacy?.suspendedAt,
        });
      }
      return profile.suspendedAt != null;
    }
    return legacy?.suspendedAt != null;
  }
}
