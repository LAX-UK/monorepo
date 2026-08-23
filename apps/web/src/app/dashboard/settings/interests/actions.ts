"use server";

import type { AuctionInterestsSettingsActionState } from "@/app/dashboard/settings/interests/action-state";
import {
  CategoryInterestPreferencesSaveError,
  replaceServerCategoryInterestPreferences,
} from "@/lib/data/http/category-interests.server";

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
  } catch (error) {
    const knownError = error instanceof CategoryInterestPreferencesSaveError ? error : null;
    const rootError = knownError?.cause ?? error;
    const diagnostic: NonNullable<AuctionInterestsSettingsActionState["diagnostic"]> = {
      stage: knownError?.stage ?? "unknown",
      status: knownError?.status ?? null,
      apiCode: knownError?.apiCode ?? null,
      errorName: rootError instanceof Error ? rootError.name : typeof rootError,
      errorMessage: rootError instanceof Error ? rootError.message : String(rootError),
      selectedCount: categoryIds.length,
    };
    // #region agent log
    fetch("http://127.0.0.1:7685/ingest/8d553a4b-6759-482a-a6f6-871e111fa1a5", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "547289" },
      body: JSON.stringify({
        sessionId: "547289",
        runId: "pre-fix",
        hypothesisId: "H1-H5",
        location: "interests/actions.ts:catch",
        message: "Auction interest server action returned recoverable failure",
        data: diagnostic,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    console.error("[debug:547289] auction interest save action failed", diagnostic);
    return {
      error: "We couldn’t save your auction interests. Check your connection and try again.",
      redirectTo: null,
      diagnostic,
    };
  }
  return {
    error: null,
    redirectTo: "/dashboard/settings/interests?saved=1",
    diagnostic: null,
  };
}
