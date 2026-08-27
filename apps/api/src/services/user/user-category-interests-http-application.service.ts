import { isBuyerInterestPersonaEligible } from "@auction/domain";
import type {
  ICategoryInterestsEligibilityReader,
  ICategoryInterestsRepository,
} from "@auction/persistence/interfaces";
import type { IUserCategoryInterestsHttpApplicationService } from "../interfaces/user-routes/user-category-interests-http.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";

function presentCategoryInterests(state: {
  categoryIds: string[];
  onboardingCompletedAt: Date | null;
}) {
  return {
    categoryIds: state.categoryIds,
    onboardingCompleted: state.onboardingCompletedAt !== null,
    onboardingCompletedAt: state.onboardingCompletedAt?.toISOString() ?? null,
  };
}

export class UserCategoryInterestsHttpApplicationService
  implements IUserCategoryInterestsHttpApplicationService
{
  constructor(
    private readonly repository: ICategoryInterestsRepository,
    private readonly eligibilityReader: ICategoryInterestsEligibilityReader,
  ) {}

  async getForUser(input: { userId: string }): Promise<UserHttpJson> {
    const eligibility = await this.assertEligible(input.userId);
    if (eligibility) return eligibility;

    const state = await this.repository.getForUser(input.userId);
    return { status: 200, body: { data: presentCategoryInterests(state) } };
  }

  async replacePreferences(input: {
    userId: string;
    categoryIds: readonly string[];
  }): Promise<UserHttpJson> {
    const eligibility = await this.assertEligible(input.userId);
    if (eligibility) return eligibility;

    const result = await this.repository.replace(input.userId, input.categoryIds);
    if (!result.ok) {
      return {
        status: 422,
        body: {
          error: "One or more categories do not exist",
          code: "category_interests_invalid_category",
          invalidCategoryIds: result.invalidCategoryIds,
        },
      };
    }
    return { status: 200, body: { data: presentCategoryInterests(result.state) } };
  }

  async replaceAndComplete(input: {
    userId: string;
    categoryIds: readonly string[];
  }): Promise<UserHttpJson> {
    const eligibility = await this.assertEligible(input.userId);
    if (eligibility) return eligibility;

    const result = await this.repository.replaceAndComplete(input.userId, input.categoryIds);
    if (!result.ok) {
      return {
        status: 422,
        body: {
          error: "One or more categories do not exist",
          code: "category_interests_invalid_category",
          invalidCategoryIds: result.invalidCategoryIds,
        },
      };
    }
    return { status: 200, body: { data: presentCategoryInterests(result.state) } };
  }

  private async assertEligible(userId: string): Promise<UserHttpJson | null> {
    const profile = await this.eligibilityReader.getProfile(userId);
    if (
      !profile ||
      profile.role !== "client" ||
      profile.suspended ||
      !profile.emailVerified ||
      !isBuyerInterestPersonaEligible(profile.signupPersona)
    ) {
      return {
        status: 403,
        body: {
          error: "Category-interest onboarding is not available for this account",
          code: "category_interests_not_eligible",
        },
      };
    }
    return null;
  }
}
