import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  CategoryInterestsEligibilityProfile,
  ICategoryInterestsEligibilityReader,
} from "../interfaces/category-interests.repository.js";

export class DrizzleCategoryInterestsEligibilityReader
  implements ICategoryInterestsEligibilityReader
{
  constructor(private readonly db: Database) {}

  async getProfile(userId: string): Promise<CategoryInterestsEligibilityProfile | null> {
    const [row] = await this.db
      .select({
        role: bidUserProfile.role,
        suspendedAt: bidUserProfile.suspendedAt,
        emailVerified: bidIdentityDirectory.emailVerified,
        signupPersona: bidUserProfile.signupPersona,
      })
      .from(bidUserProfile)
      .innerJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, bidUserProfile.userId))
      .where(eq(bidUserProfile.userId, userId))
      .limit(1);

    if (!row) return null;

    return {
      role: row.role,
      suspended: row.suspendedAt !== null,
      emailVerified: row.emailVerified,
      signupPersona:
        row.signupPersona === "individual" || row.signupPersona === "organisation"
          ? row.signupPersona
          : null,
    };
  }
}
