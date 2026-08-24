"use server";

import { replaceServerCategoryInterests } from "@/lib/data/http/category-interests.server";
import {
  type FullBuyerOnboardingSource,
  buyerInterestsCompletionHref,
} from "@/lib/kyc/buyer-onboarding";
import type { BuyerInterestsActionState } from "./action-state";

export async function completeBuyerInterests(
  _previousState: BuyerInterestsActionState,
  formData: FormData,
): Promise<BuyerInterestsActionState> {
  const next = formData.get("next")?.toString();
  const source: FullBuyerOnboardingSource =
    formData.get("source") === "sign_in_resume" ? "sign_in_resume" : "post_verify";
  const skipped = formData.get("skip") === "1";
  const categoryIds = skipped
    ? []
    : formData
        .getAll("categoryId")
        .map(String)
        .filter((id) => id.length > 0);
  try {
    await replaceServerCategoryInterests(categoryIds);
  } catch {
    return {
      error: "We couldn’t save your interests. Check your connection and try again.",
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
