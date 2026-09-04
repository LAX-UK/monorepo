import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { IBidActorEligibilityReader } from "../interfaces/bid-actor-eligibility.reader.js";

export class DrizzleBidActorEligibilityReader implements IBidActorEligibilityReader {
  constructor(private readonly db: Database) {}

  async findBidActorEligibility(userId: string) {
    const [row] = await this.db
      .select({
        emailVerified: bidIdentityDirectory.emailVerified,
        kycStatus: bidUserProfile.kycStatus,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);
    if (!row) return null;
    return {
      emailVerified: row.emailVerified,
      kycStatus: row.kycStatus ?? "unverified",
    };
  }
}
