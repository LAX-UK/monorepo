import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { IBidActorEligibilityReader } from "../interfaces/bid-actor-eligibility.reader.js";

export class DrizzleBidActorEligibilityReader implements IBidActorEligibilityReader {
  constructor(private readonly db: Database) {}

  async findBidActorEligibility(userId: string) {
    const [row] = await this.db
      .select({
        emailVerified: user.emailVerified,
        kycStatus: user.kycStatus,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row ?? null;
  }
}
