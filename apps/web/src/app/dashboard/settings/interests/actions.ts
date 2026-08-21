"use server";

import { replaceServerCategoryInterestPreferences } from "@/lib/data/http/category-interests.server";
import { redirect } from "next/navigation";

export type AuctionInterestsSettingsActionState = { error: string | null };

export const INITIAL_AUCTION_INTERESTS_SETTINGS_ACTION_STATE: AuctionInterestsSettingsActionState =
  { error: null };

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
    };
  }
  redirect("/dashboard/settings/interests?saved=1");
}
