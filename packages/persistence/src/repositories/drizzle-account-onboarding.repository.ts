import type { Database } from "@auction/db";
import { bidUserProfile } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { provisionBidUserProfileShell, writeBidUserProfile } from "../bid-user-profile-sync.js";
import type {
  CompleteAccountOnboardingInput,
  IAccountOnboardingRepository,
} from "../interfaces/account-onboarding.repository.js";

export class DrizzleAccountOnboardingRepository implements IAccountOnboardingRepository {
  constructor(private readonly db: Database) {}

  async getStatus(userId: string) {
    const [row] = await this.db
      .select({ termsAcceptedAt: bidUserProfile.termsAcceptedAt })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, userId))
      .limit(1);
    return row ?? null;
  }

  async completeOnboarding(input: CompleteAccountOnboardingInput): Promise<void> {
    const now = input.termsAcceptedAt;
    await provisionBidUserProfileShell(this.db, input.userId, now);
    await writeBidUserProfile(this.db, input.userId, {
      firstName: input.firstName,
      lastName: input.lastName,
      signupPersona: input.persona,
      termsAcceptedAt: input.termsAcceptedAt,
      termsVersion: input.termsVersion,
      ...(input.mobile !== undefined
        ? {
            mobile: input.mobile,
            ...(input.mobileCountry !== undefined ? { mobileCountry: input.mobileCountry } : {}),
          }
        : {}),
      updatedAt: now,
    });
  }
}
