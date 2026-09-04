import type { Database } from "@auction/db";
import { bidUserProfile } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { IUserSuspensionChecker } from "../interfaces/user-suspension.checker.js";

export class DrizzleUserSuspensionChecker implements IUserSuspensionChecker {
  constructor(private readonly db: Database) {}

  async isSuspended(userId: string): Promise<boolean> {
    const [profile] = await this.db
      .select({ suspendedAt: bidUserProfile.suspendedAt })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, userId))
      .limit(1);
    return profile?.suspendedAt != null;
  }
}
