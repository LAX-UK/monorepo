"use server";

import { replaceServerCategoryInterests } from "@/lib/data/http/category-interests.server";
import {
  type FullBuyerOnboardingSource,
  buyerInterestsCompletionHref,
} from "@/lib/kyc/buyer-onboarding";
import { redirect } from "next/navigation";

export type BuyerInterestsActionState = { error: string | null };

export const INITIAL_BUYER_INTERESTS_ACTION_STATE: BuyerInterestsActionState = { error: null };

export async function completeBuyerInterests(
  _previousState: BuyerInterestsActionState,
  formData: FormData,
): Promise<BuyerInterestsActionState> {
  const next = formData.get("next")?.toString();
  const source: FullBuyerOnboardingSource =
    formData.get("source") === "sign_in_resume" ? "sign_in_resume" : "post_verify";
  const categoryIds =
    formData.get("skip") === "1"
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
    };
  }
  redirect(buyerInterestsCompletionHref(next, categoryIds.length > 0, source));
}
