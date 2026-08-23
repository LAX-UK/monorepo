import { INITIAL_AUCTION_INTERESTS_SETTINGS_ACTION_STATE } from "@/app/dashboard/settings/interests/action-state";
import { saveAuctionInterestPreferences } from "@/app/dashboard/settings/interests/actions";
import { replaceServerCategoryInterestPreferences } from "@/lib/data/http/category-interests.server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/http/category-interests.server", () => ({
  CategoryInterestPreferencesSaveError: class extends Error {},
  replaceServerCategoryInterestPreferences: vi.fn(),
}));

describe("saveAuctionInterestPreferences", () => {
  it("returns recoverable feedback when saving fails", async () => {
    vi.mocked(replaceServerCategoryInterestPreferences).mockRejectedValueOnce(new Error("offline"));
    const formData = new FormData();
    formData.set("categoryId", "11111111-1111-4111-8111-111111111111");

    await expect(
      saveAuctionInterestPreferences(INITIAL_AUCTION_INTERESTS_SETTINGS_ACTION_STATE, formData),
    ).resolves.toEqual({
      error: "We couldn’t save your auction interests. Check your connection and try again.",
      redirectTo: null,
      diagnostic: {
        stage: "unknown",
        status: null,
        apiCode: null,
        errorName: "Error",
        errorMessage: "offline",
        selectedCount: 1,
      },
    });
  });

  it("returns navigation data only after saving succeeds", async () => {
    vi.mocked(replaceServerCategoryInterestPreferences).mockResolvedValueOnce({
      categoryIds: ["11111111-1111-4111-8111-111111111111"],
      onboardingCompleted: true,
      onboardingCompletedAt: new Date().toISOString(),
    });
    const formData = new FormData();
    formData.set("categoryId", "11111111-1111-4111-8111-111111111111");

    await expect(
      saveAuctionInterestPreferences(INITIAL_AUCTION_INTERESTS_SETTINGS_ACTION_STATE, formData),
    ).resolves.toEqual({
      error: null,
      redirectTo: "/dashboard/settings/interests?saved=1",
      diagnostic: null,
    });
  });
});
