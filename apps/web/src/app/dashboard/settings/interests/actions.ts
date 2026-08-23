"use server";

import type { AuctionInterestsSettingsActionState } from "@/app/dashboard/settings/interests/action-state";
import { replaceServerCategoryInterestPreferences } from "@/lib/data/http/category-interests.server";

export async function saveAuctionInterestPreferences(
  _previousState: AuctionInterestsSettingsActionState,
  formData: FormData,
): Promise<AuctionInterestsSettingsActionState> {
  const categoryIds = formData
    .getAll("categoryId")
    .map(String)
    .filter((id) => id.length > 0);
  try {
    await replaceServerCategoryInterestPreferences(categoryIds);
  } catch {
    return {
      error: "We couldn’t save your auction interests. Check your connection and try again.",
      redirectTo: null,
    };
  }
  return {
    error: null,
    redirectTo: "/dashboard/settings/interests?saved=1",
  };
}
