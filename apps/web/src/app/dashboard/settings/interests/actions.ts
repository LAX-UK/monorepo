"use server";

import type { AuctionInterestsSettingsActionState } from "@/app/dashboard/settings/interests/action-state";
import { replaceServerCategoryInterestPreferences } from "@/lib/data/http/category-interests.server";
import {
  describeCategoryInterestsSaveError,
  parseCategoryInterestIds,
} from "@/lib/onboarding/category-interests-action-error";
import { revalidatePath } from "next/cache";

export async function saveAuctionInterestPreferences(
  _previousState: AuctionInterestsSettingsActionState,
  formData: FormData,
): Promise<AuctionInterestsSettingsActionState> {
  const parsed = parseCategoryInterestIds(formData);
  if ("error" in parsed) {
    return { error: parsed.error, redirectTo: null, savedCategoryIds: null };
  }
  let savedCategoryIds: string[];
  try {
    const saved = await replaceServerCategoryInterestPreferences(parsed);
    savedCategoryIds = saved.categoryIds;
  } catch (error) {
    return {
      error: describeCategoryInterestsSaveError(
        error,
        "We couldn’t save your auction interests. Check your connection and try again.",
      ),
      redirectTo: null,
      savedCategoryIds: null,
    };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/interests");
  return {
    error: null,
    redirectTo: "/dashboard/settings/interests?saved=1",
    savedCategoryIds,
  };
}
