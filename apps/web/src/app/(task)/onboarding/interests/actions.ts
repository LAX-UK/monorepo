"use server";

import type { BuyerInterestsActionState } from "@/app/(task)/onboarding/interests/action-state";
import { replaceServerCategoryInterests } from "@/lib/data/http/category-interests.server";
import {
  type FullBuyerOnboardingSource,
  buyerInterestsCompletionHref,
} from "@/lib/kyc/buyer-onboarding";
import {
  describeCategoryInterestsSaveError,
  parseCategoryInterestIds,
} from "@/lib/onboarding/category-interests-action-error";

export async function completeBuyerInterests(
  _previousState: BuyerInterestsActionState,
  formData: FormData,
): Promise<BuyerInterestsActionState> {
  const next = formData.get("next")?.toString();
  const source: FullBuyerOnboardingSource =
    formData.get("source") === "sign_in_resume" ? "sign_in_resume" : "post_verify";
  const skipped = formData.get("skip") === "1";
  const parsed = parseCategoryInterestIds(formData);
  if ("error" in parsed) {
    return { error: parsed.error, redirectTo: null, submission: null };
  }
  const categoryIds = skipped ? [] : parsed;
  try {
    await replaceServerCategoryInterests(categoryIds);
  } catch (error) {
    return {
      error: describeCategoryInterestsSaveError(
        error,
        "We couldn’t save your interests. Check your connection and try again.",
      ),
      redirectTo: null,
      submission: null,
    };
  }
  return {
    error: null,
    redirectTo: buyerInterestsCompletionHref(next, categoryIds.length > 0, source),
    submission: {
      skipped,
      selectedCount: categoryIds.length,
      source,
    },
  };
}
