import { INITIAL_BUYER_INTERESTS_ACTION_STATE } from "@/app/(task)/onboarding/interests/action-state";
import { completeBuyerInterests } from "@/app/(task)/onboarding/interests/actions";
import { replaceServerCategoryInterests } from "@/lib/data/http/category-interests.server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/http/category-interests.server", () => ({
  replaceServerCategoryInterests: vi.fn(),
}));

describe("completeBuyerInterests", () => {
  it("returns recoverable feedback when saving fails", async () => {
    vi.mocked(replaceServerCategoryInterests).mockRejectedValueOnce(new Error("offline"));
    const formData = new FormData();
    formData.set("categoryId", "11111111-1111-4111-8111-111111111111");

    await expect(
      completeBuyerInterests(INITIAL_BUYER_INTERESTS_ACTION_STATE, formData),
    ).resolves.toEqual({
      error: "We couldn’t save your interests. Check your connection and try again.",
      redirectTo: null,
      submission: null,
    });
  });

  it("returns a client-navigable completion href after a confirmed save", async () => {
    vi.mocked(replaceServerCategoryInterests).mockResolvedValueOnce({
      categoryIds: ["11111111-1111-4111-8111-111111111111"],
      onboardingCompleted: true,
      onboardingCompletedAt: "2026-08-20T12:00:00.000Z",
    });
    const formData = new FormData();
    formData.set("categoryId", "11111111-1111-4111-8111-111111111111");
    formData.set("next", "/dashboard/watchlist");

    await expect(
      completeBuyerInterests(INITIAL_BUYER_INTERESTS_ACTION_STATE, formData),
    ).resolves.toEqual({
      error: null,
      redirectTo: "/onboarding/recommendations?next=%2Fdashboard%2Fwatchlist&source=post_verify",
      submission: {
        skipped: false,
        selectedCount: 1,
        source: "post_verify",
      },
    });
  });
});
