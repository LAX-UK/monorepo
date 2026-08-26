export type CategoryInterestsEligibilityProfile = {
  role: string;
  suspended: boolean;
  emailVerified: boolean;
  signupPersona: "individual" | "organisation" | null;
};

/** Narrow profile read used to decide whether category-interest APIs apply. */
export interface ICategoryInterestsEligibilityReader {
  getProfile(userId: string): Promise<CategoryInterestsEligibilityProfile | null>;
}

export type CategoryInterestsState = {
  categoryIds: string[];
  onboardingCompletedAt: Date | null;
};

export type ReplaceCategoryInterestsResult =
  | { ok: true; state: CategoryInterestsState }
  | { ok: false; invalidCategoryIds: string[] };

/** User-scoped persistence required by the category-interests API. */
export interface ICategoryInterestsRepository {
  getForUser(userId: string): Promise<CategoryInterestsState>;
  replace(userId: string, categoryIds: readonly string[]): Promise<ReplaceCategoryInterestsResult>;
  replaceAndComplete(
    userId: string,
    categoryIds: readonly string[],
  ): Promise<ReplaceCategoryInterestsResult>;
}
